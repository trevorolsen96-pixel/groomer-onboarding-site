import { NextResponse } from "next/server";
import { getVercelOidcToken } from "@vercel/oidc";
import { supabaseAdmin } from "../../../../lib/supabase-admin";
import { verifyTelnyxSignature } from "../../../../lib/telnyx-webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ATTACHMENT_BUCKET = "message-attachments";

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

type TelnyxMedia = { url?: string; content_type?: string };

function extensionForContentType(contentType: string) {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("heic")) return "heic";
  if (contentType.includes("gif")) return "gif";
  return "jpg";
}

// Telnyx hosts inbound MMS media at a temporary URL that isn't guaranteed to
// stay available indefinitely, so we pull it down immediately and re-host it
// in our own private bucket — the same one and same attachment_path column
// outbound photos already use, which is why no Flutter changes are needed
// to display these: the existing _MessageBubble attachment rendering just
// works for inbound rows too.
async function downloadAndStoreInboundMedia({
  businessId,
  conversationId,
  media,
}: {
  businessId: string;
  conversationId: string;
  media: TelnyxMedia[];
}): Promise<string | null> {
  const first = media.find((item) => (item?.url ?? "").trim().length > 0);
  if (!first?.url) return null;

  try {
    const res = await fetch(first.url);
    if (!res.ok) return null;

    const bytes = Buffer.from(await res.arrayBuffer());
    const contentType =
      first.content_type || res.headers.get("content-type") || "image/jpeg";
    const ext = extensionForContentType(contentType);
    const path = `${businessId}/${conversationId}/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}.${ext}`;

    const { error } = await supabaseAdmin.storage
      .from(ATTACHMENT_BUCKET)
      .upload(path, bytes, { contentType, upsert: false });

    if (error) {
      console.error("Failed to store inbound MMS media:", error.message);
      return null;
    }

    return path;
  } catch (error) {
    console.error("Failed to download inbound MMS media:", error);
    return null;
  }
}

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");

  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (value.startsWith("+")) return value.replace(/[^\d+]/g, "");

  return value;
}

async function updateLatestAppointmentConfirmation({
  businessId,
  customerId,
  body,
}: {
  businessId: string;
  customerId: string;
  body: string;
}) {
  const clean = body.trim().toLowerCase();

  const yesValues = new Set(["yes", "y", "confirm", "confirmed"]);
  const noValues  = new Set(["no", "n", "cancel", "reschedule"]);

  const isYes = yesValues.has(clean);
  const isNo  = noValues.has(clean);

  if (!isYes && !isNo) return;

  const now = new Date().toISOString();

  const { data: appointments } = await supabaseAdmin
    .from("appointments")
    .select("id, scheduled_at")
    .eq("business_id", businessId)
    .eq("customer_id", customerId)
    .eq("confirmation_status", "pending")
    .gte("scheduled_at", now)
    .order("scheduled_at", { ascending: true })
    .limit(1);

  const appointment = appointments?.[0];
  if (!appointment?.id) return;

  if (isYes) {
    // Client confirmed — mark confirmed
    await supabaseAdmin
      .from("appointments")
      .update({
        confirmation_status: "confirmed",
        confirmation_responded_at: now,
      })
      .eq("id", appointment.id)
      .eq("business_id", businessId);

    await supabaseAdmin.from("sms_events").insert({
      business_id: businessId,
      customer_id: customerId,
      appointment_id: appointment.id,
      direction: "inbound",
      event_type: "appointment_confirmed",
      message_body: body,
      created_at: now,
    });
  } else {
    // Client cancelled — cancel the appointment and remove pending reminders
    await supabaseAdmin
      .from("appointments")
      .update({
        status: "cancelled",
        confirmation_status: "declined",
        confirmation_responded_at: now,
      })
      .eq("id", appointment.id)
      .eq("business_id", businessId);

    // Remove any pending reminder texts for this appointment
    await supabaseAdmin
      .from("sms_outbound_queue")
      .delete()
      .eq("business_id", businessId)
      .eq("appointment_id", appointment.id)
      .eq("status", "pending");

    await supabaseAdmin.from("sms_events").insert({
      business_id: businessId,
      customer_id: customerId,
      appointment_id: appointment.id,
      direction: "inbound",
      event_type: "appointment_cancelled_by_client",
      message_body: body,
      created_at: now,
    });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();

    const signatureResult = verifyTelnyxSignature({
      rawBody,
      signatureHeader: request.headers.get("telnyx-signature-ed25519"),
      timestampHeader: request.headers.get("telnyx-timestamp"),
    });

    if (signatureResult === "invalid") {
      return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
    }

    const json = JSON.parse(rawBody);

    const payload = json?.data?.payload;

    const fromPhone = normalizePhone(
      cleanText(payload?.from?.phone_number ?? "")
    );
    const toPhone = normalizePhone(
      cleanText(payload?.to?.[0]?.phone_number ?? "")
    );
    const body = cleanText(payload?.text ?? "");
    const media: TelnyxMedia[] = Array.isArray(payload?.media)
      ? payload.media
      : [];

    if (!fromPhone || !toPhone || (!body && media.length === 0)) {
      return NextResponse.json({ ok: true });
    }

    const { data: smsSetup } = await supabaseAdmin
      .from("business_sms_setup")
      .select("business_id, phone_number, status")
      .eq("phone_number", toPhone)
      .in("status", ["active", "approved"])
      .maybeSingle();

    if (!smsSetup?.business_id) {
      return NextResponse.json({ ok: true });
    }

    const businessId = smsSetup.business_id;
    const now = new Date().toISOString();

    const { data: customers } = await supabaseAdmin
      .from("customers")
      .select(
        "id, name, phone, secondary_contact_name, secondary_contact_phone, image_url"
      )
      .eq("business_id", businessId);

    // A phone number matching MORE than one customer record isn't rare --
    // it happens any time a household shares a number (one person's own
    // phone is also registered as someone else's secondary contact,
    // roommates, family, etc). Collect every match instead of taking the
    // first one blindly.
    const matches = (customers ?? []).filter((item) => {
      return (
        normalizePhone(item.phone ?? "") === fromPhone ||
        normalizePhone(item.secondary_contact_phone ?? "") === fromPhone
      );
    });

    if (matches.length === 0) {
      await supabaseAdmin.from("sms_events").insert({
        business_id: businessId,
        direction: "inbound",
        event_type: "unmatched_inbound_message",
        message_body: body,
        from_phone: fromPhone,
        to_phone: toPhone,
        created_at: now,
      });

      return NextResponse.json({ ok: true });
    }

    // A secondary contact texting in gets routed to their own thread,
    // separate from the primary contact's — matched by which phone number
    // this message actually came from.
    const contactTypeForMatch = (item: (typeof matches)[number]) =>
      normalizePhone(item.secondary_contact_phone ?? "") === fromPhone &&
      normalizePhone(item.phone ?? "") !== fromPhone
        ? "secondary"
        : "primary";

    let customer = matches[0];
    let contactType: "primary" | "secondary" = contactTypeForMatch(customer);

    if (matches.length > 1) {
      // Genuinely ambiguous -- this exact number matches more than one
      // customer record in this business. Picking the "first" one
      // arbitrarily is what caused a real incident: a client's real
      // appointment-confirmation "NO" reply got filed under a completely
      // unrelated customer's thread and never cancelled the actual
      // appointment, because that unrelated customer happened to come
      // back first from the database. Break the tie by preferring
      // whichever match's own conversation thread was texted most
      // recently -- that's almost always the thread a reply is actually
      // responding to (e.g. the confirmation request that was just sent).
      const candidates = matches.map((item) => ({
        item,
        contactType: contactTypeForMatch(item),
      }));

      const { data: conversations } = await supabaseAdmin
        .from("message_conversations")
        .select("customer_id, contact_type, last_message_at")
        .eq("business_id", businessId)
        .in(
          "customer_id",
          candidates.map((c) => c.item.id)
        );

      let best = candidates[0];
      let bestTimestamp = -Infinity;

      for (const candidate of candidates) {
        const conversation = (conversations ?? []).find(
          (c) =>
            c.customer_id === candidate.item.id &&
            c.contact_type === candidate.contactType
        );
        const timestamp = conversation?.last_message_at
          ? new Date(conversation.last_message_at).getTime()
          : -Infinity;

        if (timestamp > bestTimestamp) {
          bestTimestamp = timestamp;
          best = candidate;
        }
      }

      customer = best.item;
      contactType = best.contactType;
    }

    const isFromSecondary = contactType === "secondary";

    await updateLatestAppointmentConfirmation({
      businessId,
      customerId: customer.id,
      body,
    });

    const { data: existingConversation } = await supabaseAdmin
      .from("message_conversations")
      .select("*")
      .eq("business_id", businessId)
      .eq("customer_id", customer.id)
      .eq("contact_type", contactType)
      .maybeSingle();

    let conversationId = existingConversation?.id as string | undefined;

    if (!conversationId) {
      const { data: insertedConversation, error: insertConversationError } =
        await supabaseAdmin
          .from("message_conversations")
          .insert({
            business_id: businessId,
            customer_id: customer.id,
            contact_type: contactType,
            customer_name: isFromSecondary
              ? `${cleanText(customer.secondary_contact_name) || "Secondary Contact"} (Secondary)`
              : customer.name,
            customer_phone: isFromSecondary
              ? customer.secondary_contact_phone
              : customer.phone,
            customer_image_url: isFromSecondary ? null : customer.image_url,
            last_message_body: body,
            last_message_at: now,
            unread_count: 1,
            created_at: now,
          })
          .select("id")
          .single();

      if (insertConversationError || !insertedConversation) {
        throw new Error(
          insertConversationError?.message ?? "Unable to create conversation."
        );
      }

      conversationId = insertedConversation.id;
    }

    if (!conversationId) {
      throw new Error("Missing conversation id after lookup/create.");
    }

    const attachmentPath =
      media.length > 0
        ? await downloadAndStoreInboundMedia({
            businessId,
            conversationId,
            media,
          })
        : null;

    // Falls back to a friendly label for the conversation preview/push
    // notification when a photo arrives with no caption text.
    const displayBody = body || (attachmentPath ? "📷 Photo" : "");

    await supabaseAdmin.from("message_items").insert({
      business_id: businessId,
      conversation_id: conversationId,
      customer_id: customer.id,
      direction: "inbound",
      body: displayBody,
      status: "received",
      provider: "telnyx",
      created_at: now,
      attachment_path: attachmentPath,
      attachment_caption: attachmentPath ? body || null : null,
    });

    await supabaseAdmin
      .from("message_conversations")
      .update({
        last_message_body: displayBody,
        last_message_at: now,
        unread_count: (existingConversation?.unread_count ?? 0) + 1,
        is_closed: false,
      })
      .eq("id", conversationId);

    await supabaseAdmin.from("sms_events").insert({
      business_id: businessId,
      customer_id: customer.id,
      direction: "inbound",
      event_type: "manual_message_reply",
      message_body: body,
      from_phone: fromPhone,
      to_phone: toPhone,
      created_at: now,
    });

    try {
      const pushUrl = process.env.GOOGLE_PUSH_FUNCTION_URL;
      const pushSecret = process.env.WAGZLY_PUSH_SECRET;
      const serviceAccountEmail = process.env.GCP_SERVICE_ACCOUNT_EMAIL;

      if (pushUrl && pushSecret && serviceAccountEmail && conversationId) {
        const vercelToken = await getVercelOidcToken();

        const stsResponse = await fetch("https://sts.googleapis.com/v1/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type:
              "urn:ietf:params:oauth:grant-type:token-exchange",
            audience:
              "//iam.googleapis.com/projects/443606887092/locations/global/workloadIdentityPools/vercel-pool/providers/vercel-provider",
            scope: "https://www.googleapis.com/auth/cloud-platform",
            requested_token_type:
              "urn:ietf:params:oauth:token-type:access_token",
            subject_token_type:
              "urn:ietf:params:oauth:token-type:jwt",
            subject_token: vercelToken,
          }),
        });

        const stsJson = await stsResponse.json();

        if (!stsResponse.ok) throw new Error("Google STS token exchange failed");

        const iamResponse = await fetch(
          `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${serviceAccountEmail}:generateIdToken`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${stsJson.access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ audience: pushUrl, includeEmail: true }),
          }
        );

        const iamJson = await iamResponse.json();

        if (!iamResponse.ok) throw new Error("Google IAM ID token failed");

        await fetch(pushUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${iamJson.token}`,
            "Content-Type": "application/json",
            "x-wagzly-push-secret": pushSecret,
          },
          body: JSON.stringify({
            businessId,
            conversationId,
            customerName: customer.name,
            messageBody: displayBody,
          }),
        });
      }
    } catch (pushError) {
      console.error("Inbound SMS push notification failed:", pushError);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Telnyx inbound route failed:", error);
    return NextResponse.json({ ok: true });
  }
}
