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
    console.error(
      `Failed to assign ${phoneNumber} to 10DLC campaign ${campaignId}:`,
      error
    );
    return { ok: false, error: message };
  }
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

  // Best-effort immediate attempt -- often still too early (see comment on
  // assignPhoneNumberToCampaign), which is exactly why callers must persist
  // campaignAssigned/campaignAssignmentError and a cron retries it later
  // rather than this being the only chance it gets.
  const campaignResult = await assignPhoneNumberToCampaign(orderedPhoneNumber);

  return {
    id: ordered?.id as string,
    phoneNumber: orderedPhoneNumber,
    campaignAssigned: campaignResult.ok,
    campaignAssignmentError: campaignResult.error,
  };
}
