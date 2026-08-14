import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase-admin";
import { sendSms } from "../../../../lib/telnyx";
import { normalizeSmsText, smsSegments, splitLongSmsMessage } from "../../../../lib/sms-text";

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

// Uploads a base64-encoded photo to the private message-attachments bucket.
// Sending it as a plain SMS (rather than a real MMS media attachment) costs
// ~$0.008 instead of Telnyx's MMS rate (~$0.025) — but a raw Supabase signed
// URL is 200+ characters, which alone blows past the 160-character single
// SMS segment. createShortLink() below wraps it in a short wagzly.com
// redirect instead.
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
}): Promise<{ path: string }> {
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

  return { path };
}

const SHORT_ID_ALPHABET =
  "23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ"; // no 0/O/1/l/i — avoids ambiguous characters if anyone types it manually
const SHORT_ID_LENGTH = 8;

function randomShortId(): string {
  let id = "";
  for (let i = 0; i < SHORT_ID_LENGTH; i++) {
    id += SHORT_ID_ALPHABET[
      Math.floor(Math.random() * SHORT_ID_ALPHABET.length)
    ];
  }
  return id;
}

// Wraps a private storage path in a short, branded wagzly.com/p/<id> link
// that redirects to a freshly-minted signed URL on each click — see
// app/p/[id]/route.ts. "https://www.wagzly.com/p/" + 8 chars is ~34
// characters total, comfortably inside one 160-character SMS segment even
// with a caption in front of it.
async function createShortLink({
  businessId,
  attachmentPath,
}: {
  businessId: string;
  attachmentPath: string;
}): Promise<{ url: string; expiresAt: string }> {
  const expiresAt = new Date(
    Date.now() + ATTACHMENT_LINK_TTL_SECONDS * 1000
  ).toISOString();

  // Astronomically unlikely to collide (56^8 ids), but guard against it
  // anyway rather than silently overwriting someone else's link.
  for (let attempt = 0; attempt < 5; attempt++) {
    const id = randomShortId();

    const { error } = await supabaseAdmin.from("message_attachment_links").insert({
      id,
      business_id: businessId,
      attachment_path: attachmentPath,
      expires_at: expiresAt,
    });

    if (!error) {
      return { url: `https://www.wagzly.com/p/${id}`, expiresAt };
    }

    if (error.code !== "23505") {
      // Not a unique-violation — no point retrying.
      throw new Error(`Unable to create photo link: ${error.message}`);
    }
  }

  throw new Error("Unable to create photo link: too many collisions.");
}

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (value.startsWith("+")) return `+${digits}`;
  return `+1${digits}`;
}

async function assertSmsCreditsAvailable({
  businessId,
  neededCredits,
}: {
  businessId: string;
  neededCredits: number;
}) {
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

    const toPhone = normalizePhone(conversation.customer_phone || "");

    if (!toPhone) {
      return NextResponse.json(
        { error: "This customer does not have a phone number." },
        { status: 400 }
      );
    }

    const fromPhone = normalizePhone(smsSetup.phone_number);
    const now = () => new Date().toISOString();

    // Photo messages can't sensibly be split across two texts — validate
    // the (normalized) caption + link fits in one message and send as a
    // single outbound item, same as before.
    if (imageBase64) {
      const uploaded = await uploadMessageAttachment({
        businessId,
        conversationId,
        imageBase64,
        imageFileName,
      });

      const shortLink = await createShortLink({
        businessId,
        attachmentPath: uploaded.path,
      });

      const cleanCaption = normalizeSmsText(messageBody);
      const outgoingText = cleanCaption
        ? `${cleanCaption}\n${shortLink.url}`
        : `Photo: ${shortLink.url}`;

      if (smsSegments(outgoingText) > 10) {
        return NextResponse.json(
          {
            error:
              "Your photo caption is too long to send. Please shorten it and try again.",
          },
          { status: 400 }
        );
      }

      await assertSmsCreditsAvailable({
        businessId,
        neededCredits: smsSegments(outgoingText),
      });

      const providerMessageId = await sendSms({
        from: fromPhone,
        to: toPhone,
        text: outgoingText,
      });

      const nowIso = now();

      await supabaseAdmin.from("message_items").insert({
        business_id: businessId,
        conversation_id: conversationId,
        customer_id: customerId,
        direction: "outbound",
        body: outgoingText,
        status: "sent",
        provider: "telnyx",
        created_at: nowIso,
        attachment_path: uploaded.path,
        attachment_expires_at: shortLink.expiresAt,
        // Kept separately from `body` (which stores the literal text that
        // went out over SMS, link included) so the app's own message
        // history can show just the caption + a rendered image, without
        // needing to parse the signed URL back out of the sent text.
        attachment_caption: cleanCaption || null,
      });

      await supabaseAdmin
        .from("message_conversations")
        .update({ last_message_body: "📷 Photo", last_message_at: nowIso })
        .eq("id", conversationId);

      await supabaseAdmin.from("sms_events").insert({
        business_id: businessId,
        customer_id: customerId,
        direction: "outbound",
        event_type: "manual_message",
        message_body: outgoingText,
        from_phone: fromPhone,
        to_phone: toPhone,
        created_at: nowIso,
      });

      return NextResponse.json({ ok: true, providerMessageId });
    }

    // Plain text — clean up autocorrect typography, then send as one text
    // if it fits, split into two if it's moderately over the limit, or
    // reject with a clear reason if it's too long even for that.
    const splitResult = splitLongSmsMessage(messageBody);

    if (!splitResult.ok) {
      return NextResponse.json({ error: splitResult.error }, { status: 400 });
    }

    const parts = splitResult.parts;
    const totalCredits = parts.reduce((sum, part) => sum + smsSegments(part), 0);

    await assertSmsCreditsAvailable({ businessId, neededCredits: totalCredits });

    let lastProviderMessageId: string | null = null;

    for (const part of parts) {
      lastProviderMessageId = await sendSms({ from: fromPhone, to: toPhone, text: part });

      const nowIso = now();

      await supabaseAdmin.from("message_items").insert({
        business_id: businessId,
        conversation_id: conversationId,
        customer_id: customerId,
        direction: "outbound",
        body: part,
        status: "sent",
        provider: "telnyx",
        created_at: nowIso,
      });

      await supabaseAdmin
        .from("message_conversations")
        .update({ last_message_body: part, last_message_at: nowIso })
        .eq("id", conversationId);

      await supabaseAdmin.from("sms_events").insert({
        business_id: businessId,
        customer_id: customerId,
        direction: "outbound",
        event_type: "manual_message",
        message_body: part,
        from_phone: fromPhone,
        to_phone: toPhone,
        created_at: nowIso,
      });
    }

    return NextResponse.json({ ok: true, providerMessageId: lastProviderMessageId });
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
