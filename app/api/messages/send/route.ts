import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase-admin";
import { sendSms } from "../../../../lib/telnyx";
import { normalizeSmsText, smsSegments, splitLongSmsMessage } from "../../../../lib/sms-text";
import { classifySmsError } from "../../../../lib/sms-retry";

const ATTACHMENT_BUCKET = "message-attachments";
const ATTACHMENT_LINK_TTL_SECONDS = 72 * 60 * 60; // 72 hours

// First attempt is always synchronous (most sends succeed in under a
// second, no reason to make the happy path wait on a background queue).
// Only a transient failure on that first attempt gets queued -- a
// permanent one (bad number, opted out) fails immediately and stays the
// existing tap-to-retry UX, since retrying it automatically would just
// burn the retry window on something that will never succeed.
const FIRST_RETRY_DELAY_MINUTES = 5;

type SendAttemptResult =
  | { ok: true; providerMessageId: string }
  | { ok: false; queued: boolean; error: string };

// Sends one SMS (a single text part, or a photo's caption+link), records
// it in message_items on success, and, on a transient failure, leaves a durable trail instead of just letting
// the error bubble up and vanish: a message_items row so the bubble
// survives even if the device that sent it never gets a response back,
// and a sms_outbound_queue row so the process-queue cron picks it back
// up and keeps trying in the background. A permanent failure still
// leaves a message_items row (status 'failed') so it's visible to any
// other staff viewing the same conversation, not just a local-only
// bubble on the sender's own device.
async function sendWithRetryFallback({
  businessId,
  conversationId,
  customerId,
  fromPhone,
  toPhone,
  text,
  sentByWorkerId,
  extraMessageItemFields = {},
}: {
  businessId: string;
  conversationId: string;
  customerId: string | null;
  fromPhone: string;
  toPhone: string;
  text: string;
  sentByWorkerId: string | null;
  extraMessageItemFields?: Record<string, unknown>;
}): Promise<SendAttemptResult> {
  let providerMessageId: string;

  try {
    providerMessageId = await sendSms({ from: fromPhone, to: toPhone, text });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const nowIso = new Date().toISOString();

    if (classifySmsError(err) === "transient") {
      const { data: inserted } = await supabaseAdmin
        .from("message_items")
        .insert({
          business_id: businessId,
          conversation_id: conversationId,
          customer_id: customerId,
          direction: "outbound",
          body: text,
          status: "retrying",
          provider: "telnyx",
          created_at: nowIso,
          sent_by_worker_id: sentByWorkerId,
          ...extraMessageItemFields,
        })
        .select("id")
        .single();

      if (inserted?.id) {
        await supabaseAdmin.from("sms_outbound_queue").insert({
          business_id: businessId,
          customer_id: customerId,
          message_item_id: inserted.id,
          message_type: "direct_message",
          to_phone: toPhone,
          body_rendered: text,
          scheduled_for_utc: new Date(
            Date.now() + FIRST_RETRY_DELAY_MINUTES * 60000
          ).toISOString(),
          status: "pending",
          attempt_count: 1,
          failure_reason: message,
        });
      }

      return { ok: false, queued: true, error: message };
    }

    await supabaseAdmin.from("message_items").insert({
      business_id: businessId,
      conversation_id: conversationId,
      customer_id: customerId,
      direction: "outbound",
      body: text,
      status: "failed",
      provider: "telnyx",
      created_at: nowIso,
      sent_by_worker_id: sentByWorkerId,
      ...extraMessageItemFields,
    });

    return { ok: false, queued: false, error: message };
  }

  // The success path needs its own message_items row too -- it's the only
  // thing the app's thread view reads, and the only thing that counts the
  // send against SMS credits (trg_log_sms_usage_from_message_item). The
  // SMS has already gone out at this point, so a failed insert is logged
  // rather than turned into an error the sender would just retry (and
  // double-text the client).
  const { error: insertError } = await supabaseAdmin.from("message_items").insert({
    business_id: businessId,
    conversation_id: conversationId,
    customer_id: customerId,
    direction: "outbound",
    body: text,
    status: "sent",
    provider: "telnyx",
    provider_message_id: providerMessageId,
    created_at: new Date().toISOString(),
    sent_by_worker_id: sentByWorkerId,
    ...extraMessageItemFields,
  });

  if (insertError) {
    console.error("Failed to record sent message_items row:", insertError);
  }

  return { ok: true, providerMessageId };
}

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

// Retry protection (see message_send_requests). The app tags each send
// with a clientMessageId so it can safely retry a send whose response was
// lost to a dropped connection: the id is claimed before anyone is texted,
// and a repeat gets the first attempt's response back instead of a second
// text. Requests without an id (older app versions) skip all of this.
type SendClaim =
  | { kind: "claimed" }
  | { kind: "unprotected" }
  | { kind: "replay"; response: NextResponse };

// A request that's still marked in_progress after this long almost
// certainly died mid-flight (function timeout, crash). Whether it texted
// the client is unknown, so it's still never re-sent -- the retry is told
// it's being handled rather than risking a double text.
const STALE_IN_PROGRESS_MS = 2 * 60 * 1000;

async function claimSend(
  businessId: string,
  clientMessageId: string
): Promise<SendClaim> {
  const { error } = await supabaseAdmin.from("message_send_requests").insert({
    business_id: businessId,
    client_message_id: clientMessageId,
    status: "in_progress",
  });

  if (!error) return { kind: "claimed" };
  if (error.code !== "23505") {
    // Fail open: if the table is missing (migration not applied yet) or
    // unreachable, send exactly as before rather than blocking the text.
    // Retry protection is a safety net, never a reason a message fails.
    console.error("message_send_requests unavailable, sending unprotected:", error);
    return { kind: "unprotected" };
  }

  const { data: existing } = await supabaseAdmin
    .from("message_send_requests")
    .select("status, response_status, response_body, updated_at")
    .eq("business_id", businessId)
    .eq("client_message_id", clientMessageId)
    .maybeSingle();

  if (existing?.status === "done") {
    return {
      kind: "replay",
      response: NextResponse.json(existing.response_body ?? { ok: true }, {
        status: existing.response_status ?? 200,
      }),
    };
  }

  if (existing?.status === "failed") {
    // Nothing went out last time, so a resend is safe -- take it over.
    const { data: reclaimed } = await supabaseAdmin
      .from("message_send_requests")
      .update({ status: "in_progress", updated_at: new Date().toISOString() })
      .eq("business_id", businessId)
      .eq("client_message_id", clientMessageId)
      .eq("status", "failed")
      .select("client_message_id");
    if (reclaimed && reclaimed.length > 0) return { kind: "claimed" };
  }

  const updatedAtRaw = existing?.updated_at ?? null;
  const updatedAt = updatedAtRaw ? Date.parse(updatedAtRaw) : 0;

  if (existing?.status === "in_progress" && Date.now() - updatedAt > STALE_IN_PROGRESS_MS) {
    // The request that claimed this id died mid-flight (function timeout,
    // crash) without recording how it ended. Every outcome of a send --
    // sent, queued for retry, or failed -- writes a message_items row
    // tagged with this id, so no row means nothing went out: take the id
    // over and send, rather than reporting "in hand" forever while the
    // message silently never sends. A row means it did go out; record
    // that so later retries replay cleanly.
    const { data: rows, error: rowsError } = await supabaseAdmin
      .from("message_items")
      .select("id")
      .eq("business_id", businessId)
      .eq("client_message_id", clientMessageId)
      .limit(1);

    if (!rowsError && rows && rows.length === 0) {
      // Conditional on updated_at so two simultaneous retries can't both
      // take it over.
      const { data: reclaimed } = await supabaseAdmin
        .from("message_send_requests")
        .update({ status: "in_progress", updated_at: new Date().toISOString() })
        .eq("business_id", businessId)
        .eq("client_message_id", clientMessageId)
        .eq("status", "in_progress")
        .eq("updated_at", updatedAtRaw)
        .select("client_message_id");
      if (reclaimed && reclaimed.length > 0) return { kind: "claimed" };
    }

    if (!rowsError && rows && rows.length > 0) {
      const body = { ok: true, status: "sent" };
      await supabaseAdmin
        .from("message_send_requests")
        .update({
          status: "done",
          response_status: 200,
          response_body: body,
          updated_at: new Date().toISOString(),
        })
        .eq("business_id", businessId)
        .eq("client_message_id", clientMessageId);
      return { kind: "replay", response: NextResponse.json(body) };
    }
  }

  // Another request for this exact message is mid-send right now. Report
  // it as in hand; the outcome reaches the thread through message_items.
  return {
    kind: "replay",
    response: NextResponse.json({ ok: true, status: "processing" }),
  };
}

async function finishSend(
  businessId: string,
  clientMessageId: string,
  status: "done" | "failed",
  response: NextResponse
): Promise<NextResponse> {
  let body: unknown = null;
  try {
    body = await response.clone().json();
  } catch {
    body = null;
  }

  const { error } = await supabaseAdmin
    .from("message_send_requests")
    .update({
      status,
      response_status: response.status,
      response_body: body,
      updated_at: new Date().toISOString(),
    })
    .eq("business_id", businessId)
    .eq("client_message_id", clientMessageId);

  if (error) console.error("Failed to record message send result:", error);
  return response;
}

export async function POST(request: Request) {
  // Set once this request has claimed a clientMessageId, so every exit
  // path below records how it ended. `anythingSent` flips as soon as any
  // part goes out (or is queued for background retry): from then on the
  // claim must end as 'done', never 'failed', or a resend would repeat it.
  let claim: { businessId: string; clientMessageId: string } | null = null;
  let anythingSent = false;

  const respond = async (response: NextResponse) => {
    if (!claim) return response;
    const succeeded = response.status >= 200 && response.status < 300;
    return finishSend(
      claim.businessId,
      claim.clientMessageId,
      succeeded || anythingSent ? "done" : "failed",
      response
    );
  };

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
    // Optional now -- a conversation with an unrecognized phone number (no
    // matching client, deliberately never auto-created into one -- see
    // app/api/messages/inbound/route.ts) has no customer_id at all, but
    // replying to it should still work.
    const customerId = cleanText(body.customerId) || null;
    const messageBody = cleanText(body.body);
    const imageBase64 = cleanText(body.imageBase64);
    const imageFileName = cleanText(body.imageFileName) || "photo.jpg";

    if (
      !businessId ||
      !conversationId ||
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

    // Admins can message any client in their business, same as always. A
    // non-admin (staff/groomer) sender must have messaging explicitly
    // enabled on their own worker row, and must have a non-cancelled
    // appointment (past or future) with the conversation's customer.
    // Resolved worker id (if any) is recorded as sent_by_worker_id below
    // so the admin's thread view can show who actually sent it.
    let sentByWorkerId: string | null = null;

    if (profile.role !== "admin") {
      const { data: worker, error: workerError } = await supabaseAdmin
        .from("workers")
        .select("id, active, can_message_clients")
        .eq("profile_id", userData.user.id)
        .eq("business_id", businessId)
        .maybeSingle();

      if (
        workerError ||
        !worker ||
        !worker.active ||
        !worker.can_message_clients
      ) {
        return NextResponse.json(
          { error: "You don't have permission to message clients." },
          { status: 403 }
        );
      }

      const { data: conversationForPermCheck } = await supabaseAdmin
        .from("message_conversations")
        .select("customer_id")
        .eq("id", conversationId)
        .eq("business_id", businessId)
        .maybeSingle();

      const targetCustomerId = conversationForPermCheck?.customer_id ?? null;

      if (!targetCustomerId) {
        return NextResponse.json(
          { error: "Not authorized." },
          { status: 403 }
        );
      }

      // A non-admin can message a client iff they have a non-cancelled
      // appointment (past or future) with that specific client -- same
      // rule staff_can_message_customer() enforces at the RLS layer for
      // starting the conversation in the first place. This route talks to
      // the database via the service-role client (no real auth.uid()), so
      // the check is re-expressed directly here rather than calling that
      // RPC.
      const { data: sharedAppointment, error: sharedAppointmentError } =
        await supabaseAdmin
          .from("appointments")
          .select("id")
          .eq("customer_id", targetCustomerId)
          .eq("worker_id", worker.id)
          .neq("status", "cancelled")
          .limit(1)
          .maybeSingle();

      if (sharedAppointmentError || !sharedAppointment) {
        return NextResponse.json(
          { error: "You don't have an appointment with this client yet." },
          { status: 403 }
        );
      }

      sentByWorkerId = worker.id;
    }

    const clientMessageId = cleanText(body.clientMessageId).slice(0, 200);
    if (clientMessageId) {
      const result = await claimSend(businessId, clientMessageId);
      if (result.kind === "replay") return result.response;
      if (result.kind === "claimed") claim = { businessId, clientMessageId };
    }

    // Tags the message_items row(s) with the app's id so it can match its
    // local bubble to them. Only when the claim succeeded -- that proves the
    // migration adding message_items.client_message_id has been applied, so
    // an older schema can never make the insert (and the thread row) fail.
    const clientIdFields: Record<string, unknown> = claim
      ? { client_message_id: claim.clientMessageId }
      : {};

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
      return respond(NextResponse.json(
        { error: "sms_not_activated" },
        { status: 400 }
      ));
    }

    // Keyed off conversationId + businessId only -- customer_id can be
    // null for a thread with an unrecognized number, so requiring it to
    // match would 404 every reply on those threads.
    const { data: conversation, error: conversationError } =
      await supabaseAdmin
        .from("message_conversations")
        .select("id, business_id, customer_id, customer_phone")
        .eq("id", conversationId)
        .eq("business_id", businessId)
        .maybeSingle();

    if (conversationError || !conversation) {
      return respond(NextResponse.json(
        { error: "Conversation was not found." },
        { status: 404 }
      ));
    }

    // The conversation's customer_phone is a snapshot taken when the
    // thread was first created -- but a staff member starting a new
    // conversation via the messageable-clients search gets a Customer
    // object with phone deliberately blanked out (privacy: a phone number
    // should never reach a staff device that isn't allowed to see it), so
    // that snapshot can legitimately be empty even though the customer
    // has a real phone on file. This route already runs with full
    // service-role access, so fall back to a live lookup by customer_id
    // rather than failing (or worse, sending a raw empty/invalid "to" to
    // the SMS provider) whenever the snapshot is missing.
    let rawPhone = conversation.customer_phone;
    if (!rawPhone && conversation.customer_id) {
      const { data: customerRow } = await supabaseAdmin
        .from("customers")
        .select("phone")
        .eq("id", conversation.customer_id)
        .eq("business_id", businessId)
        .maybeSingle();
      rawPhone = customerRow?.phone ?? null;
    }

    const toPhone = normalizePhone(rawPhone || "");

    if (!toPhone) {
      return respond(NextResponse.json(
        { error: "This customer does not have a phone number." },
        { status: 400 }
      ));
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
        return respond(NextResponse.json(
          {
            error:
              "Your photo caption is too long to send. Please shorten it and try again.",
          },
          { status: 400 }
        ));
      }

      await assertSmsCreditsAvailable({
        businessId,
        neededCredits: smsSegments(outgoingText),
      });

      const result = await sendWithRetryFallback({
        businessId,
        conversationId,
        customerId,
        fromPhone,
        toPhone,
        text: outgoingText,
        sentByWorkerId,
        extraMessageItemFields: {
          ...clientIdFields,
          attachment_path: uploaded.path,
          attachment_expires_at: shortLink.expiresAt,
          // Kept separately from `body` (which stores the literal text
          // that went out over SMS, link included) so the app's own
          // message history can show just the caption + a rendered
          // image, without needing to parse the signed URL back out of
          // the sent text.
          attachment_caption: cleanCaption || null,
        },
      });

      if (!result.ok) {
        if (result.queued) {
          // Queued for the background retry cron -- it will go out, so a
          // resend from the app must not repeat it.
          anythingSent = true;
          return respond(NextResponse.json({ ok: true, status: "retrying" }));
        }
        return respond(NextResponse.json({ error: result.error }, { status: 400 }));
      }

      anythingSent = true;
      const nowIso = now();

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

      return respond(NextResponse.json({ ok: true, providerMessageId: result.providerMessageId }));
    }

    // Plain text — clean up autocorrect typography, then send as one text
    // if it fits, split into two if it's moderately over the limit, or
    // reject with a clear reason if it's too long even for that.
    const splitResult = splitLongSmsMessage(messageBody);

    if (!splitResult.ok) {
      return respond(NextResponse.json({ error: splitResult.error }, { status: 400 }));
    }

    const parts = splitResult.parts;
    const totalCredits = parts.reduce((sum, part) => sum + smsSegments(part), 0);

    await assertSmsCreditsAvailable({ businessId, neededCredits: totalCredits });

    let lastProviderMessageId: string | null = null;

    for (const part of parts) {
      const result = await sendWithRetryFallback({
        businessId,
        conversationId,
        customerId,
        fromPhone,
        toPhone,
        text: part,
        sentByWorkerId,
        extraMessageItemFields: clientIdFields,
      });

      if (!result.ok) {
        if (result.queued) {
          // Queued for the background retry cron -- it will go out, so a
          // resend from the app must not repeat it.
          anythingSent = true;
          return respond(NextResponse.json({ ok: true, status: "retrying" }));
        }
        return respond(NextResponse.json({ error: result.error }, { status: 400 }));
      }

      anythingSent = true;
      lastProviderMessageId = result.providerMessageId;
      const nowIso = now();

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

    return respond(NextResponse.json({ ok: true, providerMessageId: lastProviderMessageId }));
  } catch (error) {
    return respond(NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to send text message.",
      },
      { status: 400 }
    ));
  }
}
