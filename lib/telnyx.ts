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

export async function purchasePhoneNumber(
  phoneNumber: string
): Promise<{ id: string; phoneNumber: string }> {
  const messagingProfileId = process.env.TELNYX_MESSAGING_PROFILE_ID;

  const data = await telnyxFetch("/phone_numbers", {
    method: "POST",
    body: JSON.stringify({
      phone_number: phoneNumber,
      ...(messagingProfileId
        ? { messaging_profile_id: messagingProfileId }
        : {}),
    }),
  });

  return {
    id: data.data.id as string,
    phoneNumber: data.data.phone_number as string,
  };
}
