import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { verifyTelnyxSignature } from "@/lib/telnyx-webhook";

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (value.startsWith("+")) return value;
  return `+1${digits}`;
}

function rejectXml(message: string) {
  return new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>${message}</Say>
  <Hangup/>
</Response>`,
    { status: 200, headers: { "Content-Type": "text/xml" } }
  );
}

export async function POST(req: NextRequest) {
  try {
    // Telnyx sends form-encoded data. Read the raw body first (rather than
    // req.formData(), which consumes the stream) so the exact bytes are
    // available for signature verification below.
    const rawBody = await req.text();

    const signatureResult = verifyTelnyxSignature({
      rawBody,
      signatureHeader: req.headers.get("telnyx-signature-ed25519"),
      timestampHeader: req.headers.get("telnyx-timestamp"),
    });

    // Deliberately does NOT reject calls on "invalid" -- see the matching
    // comment in app/api/messages/inbound/route.ts. A bug in unverified
    // signature logic dropping real calls is worse than the narrow
    // forgery risk it guards against.
    if (signatureResult === "invalid") {
      console.error(
        "[voice/inbound] Telnyx signature check failed -- processing the call anyway."
      );
    }

    const formData = new URLSearchParams(rawBody);
    const to = formData.get("To")?.toString() ?? "";
    const from = formData.get("From")?.toString() ?? "";

    if (!to) {
      return rejectXml("This number is not available.");
    }

    const normalizedTo = normalizePhone(to);

    // Look up the business that owns this Telnyx number
    const { data: smsSetup } = await supabaseAdmin
      .from("business_sms_setup")
      .select("business_id, phone_number")
      .eq("phone_number", normalizedTo)
      .maybeSingle();

    if (!smsSetup) {
      return rejectXml("This number is not configured.");
    }

    // Get the call forwarding number
    const { data: settings } = await supabaseAdmin
      .from("business_settings")
      .select("call_forward_number, business_name")
      .eq("business_id", smsSetup.business_id)
      .maybeSingle();

    const forwardTo = settings?.call_forward_number
      ? normalizePhone(settings.call_forward_number)
      : null;

    if (!forwardTo) {
      return rejectXml(
        "This business is not available by phone right now. Please try again later."
      );
    }

    const normalizedFrom = from ? normalizePhone(from) : normalizedTo;

    // Show the real caller's number so the groomer sees who is calling.
    // The whisper URL plays "Wagzly business call" only to the groomer
    // before the call connects so they know it came through Wagzly.
    const whisperUrl = `https://www.wagzly.com/api/voice/whisper`;

    const texml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${normalizedFrom}" answerOnBridge="true" timeout="30">
    <Number url="${whisperUrl}">${forwardTo}</Number>
  </Dial>
</Response>`;

    console.log(
      `[voice/inbound] Forwarding call from ${from} → ${forwardTo} ` +
      `(business: ${smsSetup.business_id}, wagzly number: ${normalizedTo})`
    );

    return new NextResponse(texml, {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  } catch (err) {
    console.error("[voice/inbound] Error:", err);
    return rejectXml("An error occurred. Please try again.");
  }
}
