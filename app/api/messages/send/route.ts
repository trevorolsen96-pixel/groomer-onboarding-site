import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase-admin";
import { sendSms } from "../../../../lib/telnyx";

const ATTACHMENT_BUCKET = "message-attachments";
const ATTACHMENT_LINK_TTL_SECONDS = 72 * 60 * 60; // 72 hours

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function extensionForFileName(fileName: string) {
  const match = /\.([a-zA-Z0-9]+)$/.exec(fileName);
  const ext = (match?.[1] ?? "jpg").toLowerCase();
  return ext === "jpeg" ? "jpg" : ext;
}

function contentTypeForExtension(ext: string) {
  switch (ext) {
    case "png":
      return "image/png";
    case "heic":
      return "image/heic";
    case "webp":
      return "image/webp";
    default:
      return "image/jpeg";
  }
}

// Uploads a base64-encoded photo to the private message-attachments bucket
// and mints a 72-hour signed link — that link (not the raw photo) is what
// actually gets texted, since sending it as a plain SMS costs ~$0.008
// instead of Telnyx's MMS rate (~$0.025). The storage path is kept
// separately so the app's own message history can mint a fresh signed URL
// on demand later, even after this 72-hour link has expired for the
// customer.
async function uploadMessageAttachment({
  businessId,
  conversationId,
  imageBase64,
  imageFileName,
}: {
  businessId: string;
  conversationId: string;
  imageBase64: string;
  imageFileName: string;
}): Promise<{ path: string; signedUrl: string; expiresAt: string }> {
  const ext = extensionForFileName(imageFileName || "photo.jpg");
  const path = `${businessId}/${conversationId}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}.${ext}`;

  const bytes = Buffer.from(imageBase64, "base64");

  const { error: uploadError } = await supabaseAdmin.storage
    .from(ATTACHMENT_BUCKET)
    .upload(path, bytes, {
      contentType: contentTypeForExtension(ext),
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Unable to upload photo: ${uploadError.message}`);
  }

  const { data: signedData, error: signError } = await supabaseAdmin.storage
    .from(ATTACHMENT_BUCKET)
    .createSignedUrl(path, ATTACHMENT_LINK_TTL_SECONDS);

  if (signError || !signedData?.signedUrl) {
    throw new Error(
      `Unable to create link for photo: ${signError?.message ?? "unknown error"}`
    );
  }

  const expiresAt = new Date(
    Date.now() + ATTACHMENT_LINK_TTL_SECONDS * 1000
  ).toISOString();

  return { path, signedUrl: signedData.signedUrl, expiresAt };
}

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (value.startsWith("+")) return `+${digits}`;
  return `+1${digits}`;
}

function smsSegmentsForText(body: string) {
  return Math.max(1, Math.ceil(body.length / 160));
}

async function assertSmsCreditsAvailable({
  businessId,
  body,
}: {
  businessId: string;
  body: string;
}) {
  const neededCredits = smsSegmentsForText(body);

  const { data, error } = await supabaseAdmin.rpc("get_sms_credit_summary", {
    p_business_id: businessId,
  });

  if (error) throw new Error(error.message);

  const summary = Array.isArray(data) ? data[0] : data;
  const remainingCredits = Number(summary?.remaining_credits ?? 0);
  const plan = String(summary?.plan ?? "basic").toLowerCase();

  if (remainingCredits < neededCredits) {
    throw new Error(
      `sms_credits_exceeded plan=${plan} needed=${neededCredits} remaining=${remainingCredits}`
    );
  }
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();

    if (!token) {
      return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    }

    const { data: userData, error: userError } =
      await supabaseAdmin.auth.getUser(token);

    if (userError || !userData.user) {
      return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    }

    const body = await request.json();

    const businessId = cleanText(body.businessId);
    const conversationId = cleanText(body.conversationId);
    const customerId = cleanText(body.customerId);
    const messageBody = cleanText(body.body);
    const imageBase64 = cleanText(body.imageBase64);
    const imageFileName = cleanText(body.imageFileName) || "photo.jpg";

    if (
      !businessId ||
      !conversationId ||
      !customerId ||
      (!messageBody && !imageBase64)
    ) {
      return NextResponse.json(
        { error: "Missing message details." },
        { status: 400 }
      );
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("business_id, role")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (profileError || !profile || profile.business_id !== businessId) {
      return NextResponse.json({ error: "Not authorized." }, { status: 403 });
    }

    const { data: smsSetup, error: smsSetupError } = await supabaseAdmin
      .from("business_sms_setup")
      .select("status, phone_number")
      .eq("business_id", businessId)
      .maybeSingle();

    if (
      smsSetupError ||
      !smsSetup ||
      !["active", "approved"].includes(smsSetup.status ?? "") ||
      !smsSetup.phone_number
    ) {
      return NextResponse.json(
        { error: "sms_not_activated" },
        { status: 400 }
      );
    }

    const { data: conversation, error: conversationError } =
      await supabaseAdmin
        .from("message_conversations")
        .select("id, business_id, customer_id, customer_phone")
        .eq("id", conversationId)
        .eq("business_id", businessId)
        .eq("customer_id", customerId)
        .maybeSingle();

    if (conversationError || !conversation) {
      return NextResponse.json(
        { error: "Conversation was not found." },
        { status: 404 }
      );
    }

    const toPhone = normalizePhone(conversation.customer_phone ?? "");

    if (!toPhone) {
      return NextResponse.json(
        { error: "This customer does not have a phone number." },
        { status: 400 }
      );
    }

    const fromPhone = normalizePhone(smsSetup.phone_number);

    let attachmentPath: string | null = null;
    let attachmentExpiresAt: string | null = null;
    let outgoingText = messageBody;

    if (imageBase64) {
      const uploaded = await uploadMessageAttachment({
        businessId,
        conversationId,
        imageBase64,
        imageFileName,
      });

      attachmentPath = uploaded.path;
      attachmentExpiresAt = uploaded.expiresAt;
      outgoingText = messageBody
        ? `${messageBody}\n${uploaded.signedUrl}`
        : `Photo: ${uploaded.signedUrl}`;
    }

    await assertSmsCreditsAvailable({ businessId, body: outgoingText });

    const providerMessageId = await sendSms({
      from: fromPhone,
      to: toPhone,
      text: outgoingText,
    });

    const now = new Date().toISOString();

    await supabaseAdmin.from("message_items").insert({
      business_id: businessId,
      conversation_id: conversationId,
      customer_id: customerId,
      direction: "outbound",
      body: outgoingText,
      status: "sent",
      provider: "telnyx",
      created_at: now,
      attachment_path: attachmentPath,
      attachment_expires_at: attachmentExpiresAt,
      // Kept separately from `body` (which stores the literal text that
      // went out over SMS, link included) so the app's own message history
      // can show just the caption + a rendered image, without needing to
      // parse the signed URL back out of the sent text.
      attachment_caption: attachmentPath ? messageBody || null : null,
    });

    await supabaseAdmin
      .from("message_conversations")
      .update({
        last_message_body: attachmentPath ? "📷 Photo" : outgoingText,
        last_message_at: now,
      })
      .eq("id", conversationId);

    await supabaseAdmin.from("sms_events").insert({
      business_id: businessId,
      customer_id: customerId,
      direction: "outbound",
      event_type: "manual_message",
      message_body: outgoingText,
      from_phone: fromPhone,
      to_phone: toPhone,
      created_at: now,
    });

    return NextResponse.json({ ok: true, providerMessageId });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to send text message.",
      },
      { status: 400 }
    );
  }
}
