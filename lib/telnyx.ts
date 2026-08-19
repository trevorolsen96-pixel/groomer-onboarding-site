const TELNYX_API_BASE = "https://api.telnyx.com/v2";

function getApiKey() {
  const key = process.env.TELNYX_API_KEY;
  if (!key) throw new Error("TELNYX_API_KEY is not configured.");
  return key;
}

async function telnyxFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${TELNYX_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
  });

  const data = await res.json();

  if (!res.ok) {
    const msg =
      data?.errors?.[0]?.detail ??
      data?.errors?.[0]?.title ??
      "Telnyx request failed.";
    console.error("Telnyx error:", JSON.stringify(data));
    throw new Error(msg);
  }

  return data;
}

export async function sendSms({
  from,
  to,
  text,
}: {
  from: string;
  to: string;
  text: string;
}): Promise<string> {
  const messagingProfileId = process.env.TELNYX_MESSAGING_PROFILE_ID;

  const data = await telnyxFetch("/messages", {
    method: "POST",
    body: JSON.stringify({
      from,
      to,
      text,
      ...(messagingProfileId
        ? { messaging_profile_id: messagingProfileId }
        : {}),
    }),
  });

  return data.data.id as string;
}

export async function searchAvailableNumber(
  areaCode?: string
): Promise<string | null> {
  const params = new URLSearchParams({
    "filter[country_code]": "US",
    "filter[features][]": "sms",
    "filter[limit]": "1",
  });

  if (areaCode) {
    params.set("filter[national_destination_code]", areaCode);
  }

  const data = await telnyxFetch(
    `/available_phone_numbers?${params.toString()}`,
    { method: "GET", headers: {} }
  );

  return (data?.data?.[0]?.phone_number as string) ?? null;
}

// Toll-free numbers (800/833/844/855/866/877/888) never go through 10DLC --
// they use a separate toll-free verification process entirely. Assigning
// one to a 10DLC campaign can never succeed, so this must be checked before
// ever attempting it (otherwise a toll-free number retries forever, every
// cron run, hitting Telnyx's API for something that can never work).
const TOLL_FREE_AREA_CODES = new Set([
  "800", "833", "844", "855", "866", "877", "888",
]);

function isTollFreeNumber(phoneNumber: string): boolean {
  const digits = phoneNumber.replace(/\D/g, "");
  const areaCode =
    digits.length === 11 && digits.startsWith("1")
      ? digits.slice(1, 4)
      : digits.slice(0, 3);
  return TOLL_FREE_AREA_CODES.has(areaCode);
}

// +15555555555 is a placeholder number on the Wagzly Demo Grooming account
// (used for app store review) -- it's not a real Telnyx number and will
// permanently fail 10DLC assignment with "not found" no matter how many
// times it's retried. Skip this specific number rather than trying and
// failing on it forever.
const PLACEHOLDER_NUMBERS = new Set(["+15555555555"]);

function isPlaceholderNumber(phoneNumber: string): boolean {
  return PLACEHOLDER_NUMBERS.has(phoneNumber);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Links a number to the 10DLC campaign so it's allowed to carry A2P SMS
// traffic. Exported (rather than just called internally) so callers can
// retry this on its own -- a newly-ordered number often isn't queryable as
// a resource by Telnyx's API for a few seconds after the order call
// returns, so the very first attempt right after purchase can legitimately
// fail with a "not found" error even though the order itself succeeded.
// Returns whether it succeeded so callers can persist that outcome and
// retry later instead of the failure just vanishing into a server log.
export async function assignPhoneNumberToCampaign(
  phoneNumber: string
): Promise<{ ok: boolean; error?: string }> {
  if (isTollFreeNumber(phoneNumber) || isPlaceholderNumber(phoneNumber)) {
    // Nothing to do -- toll-free numbers don't need (or support) 10DLC
    // campaign assignment, and the placeholder number can never be a real
    // one. Treating this as "ok" is what stops the retry cron from trying
    // it again forever.
    return { ok: true };
  }

  const campaignId = process.env.TELNYX_10DLC_CAMPAIGN_ID;
  if (!campaignId) return { ok: false, error: "TELNYX_10DLC_CAMPAIGN_ID is not configured." };

  try {
    await telnyxFetch("/10dlc/phone_number_campaigns", {
      method: "POST",
      body: JSON.stringify({ phoneNumber, campaignId }),
    });
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";

    // Telnyx returns this as an error rather than a no-op success when the
    // number is already linked to the campaign -- functionally that IS
    // success (the desired end state already holds), so treat it as one
    // instead of retrying something that already worked forever.
    if (/already assigned/i.test(message)) {
      return { ok: true };
    }

    console.error(
      `Failed to assign ${phoneNumber} to 10DLC campaign ${campaignId}:`,
      error
    );
    return { ok: false, error: message };
  }
}

// Retries the immediate post-purchase assignment a few times with a short
// backoff, since the usual cause of failure (Telnyx not yet treating the
// number as a queryable resource) normally clears within a few seconds --
// this covers that common case within the same request, so a new business
// can text right away instead of waiting on the next cron run. The retry
// cron (app/api/telnyx/retry-campaign-assignment) is still there as a
// backstop for the rarer case where it takes longer than this window.
async function assignPhoneNumberToCampaignWithRetry(
  phoneNumber: string
): Promise<{ ok: boolean; error?: string }> {
  const waitsMs = [0, 3000, 6000];
  let result: { ok: boolean; error?: string } = { ok: false };

  for (const waitMs of waitsMs) {
    if (waitMs > 0) await delay(waitMs);
    result = await assignPhoneNumberToCampaign(phoneNumber);
    if (result.ok) return result;
  }

  return result;
}

export async function purchasePhoneNumber(
  phoneNumber: string
): Promise<{ id: string; phoneNumber: string; campaignAssigned: boolean; campaignAssignmentError?: string }> {
  const messagingProfileId = process.env.TELNYX_MESSAGING_PROFILE_ID;
  const connectionId = process.env.TELNYX_VOICE_CONNECTION_ID;

  const data = await telnyxFetch("/number_orders", {
    method: "POST",
    body: JSON.stringify({
      phone_numbers: [{ phone_number: phoneNumber }],
      ...(messagingProfileId
        ? { messaging_profile_id: messagingProfileId }
        : {}),
      ...(connectionId ? { connection_id: connectionId } : {}),
    }),
  });

  const ordered = data.data.phone_numbers?.[0];
  const orderedPhoneNumber = ordered?.phone_number as string;

  // Retries a few times over ~9s -- covers the common case where Telnyx
  // just hasn't caught up to the order yet. Callers must still persist
  // campaignAssigned/campaignAssignmentError and let the retry cron pick up
  // the rarer case where even that isn't enough time.
  const campaignResult =
    await assignPhoneNumberToCampaignWithRetry(orderedPhoneNumber);

  return {
    id: ordered?.id as string,
    phoneNumber: orderedPhoneNumber,
    campaignAssigned: campaignResult.ok,
    campaignAssignmentError: campaignResult.error,
  };
}
