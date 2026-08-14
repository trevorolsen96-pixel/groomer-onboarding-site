// Shared helpers for logging an outbound SMS that was sent outside the main
// Messages compose flow (onboarding invites, welcome texts, booking
// notifications, payment links, staff invites) so it still counts toward
// the business's SMS credit balance.
//
// Crediting only happens via a database trigger on `message_items` inserts
// (trg_log_sms_usage_from_message_item -> sms_usage_events), so any route
// that calls sendSms() directly without writing to message_items silently
// sends real, billed Telnyx messages that never get counted. These two
// helpers cover the two shapes that come up:
//
//  - logOutboundSmsToConversation: the message is tied to a real customer.
//    Writes to message_items (via find-or-create on message_conversations),
//    which both logs credit usage automatically via the existing trigger
//    AND makes the message show up in that customer's Messages thread --
//    the same treatment already used for "Send Update Request".
//
//  - logOutboundSmsUsageOnly: there's no customer on the other end (a staff
//    invite) or no customer record exists yet (a brand-new-prospect
//    onboarding invite). Logs straight into sms_usage_events so it still
//    counts against the credit balance, without fabricating a fake
//    customer conversation.
//
// Both are meant to be called best-effort (wrapped in try/catch by the
// caller) -- a logging failure should never fail the SMS send itself or
// the enclosing API response.

import { supabaseAdmin } from "./supabase-admin";
import { smsSegments } from "./sms-text";

export async function logOutboundSmsToConversation({
  businessId,
  customerId,
  customerName,
  customerPhone,
  customerImageUrl,
  body,
}: {
  businessId: string;
  customerId: string;
  customerName: string;
  customerPhone?: string | null;
  customerImageUrl?: string | null;
  body: string;
}): Promise<void> {
  const now = new Date().toISOString();

  const { data: existingConversation } = await supabaseAdmin
    .from("message_conversations")
    .select("id")
    .eq("business_id", businessId)
    .eq("customer_id", customerId)
    .eq("contact_type", "primary")
    .maybeSingle();

  let conversationId = existingConversation?.id as string | undefined;

  if (!conversationId) {
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("message_conversations")
      .insert({
        business_id: businessId,
        customer_id: customerId,
        contact_type: "primary",
        customer_name: customerName,
        customer_phone: customerPhone ?? null,
        customer_image_url: customerImageUrl ?? null,
        last_message_body: body,
        last_message_at: now,
        unread_count: 0,
      })
      .select("id")
      .single();

    if (insertError) throw insertError;
    conversationId = inserted?.id;
  }

  if (!conversationId) return;

  await supabaseAdmin.from("message_items").insert({
    business_id: businessId,
    conversation_id: conversationId,
    customer_id: customerId,
    direction: "outbound",
    body,
    status: "sent",
    provider: "telnyx",
    created_at: now,
  });

  await supabaseAdmin
    .from("message_conversations")
    .update({ last_message_body: body, last_message_at: now, is_closed: false })
    .eq("id", conversationId);
}

export async function logOutboundSmsUsageOnly({
  businessId,
  body,
  eventType,
  providerMessageId,
}: {
  businessId: string;
  body: string;
  eventType: string;
  providerMessageId?: string | null;
}): Promise<void> {
  await supabaseAdmin.from("sms_usage_events").insert({
    business_id: businessId,
    message_id: null,
    provider_message_id: providerMessageId ?? null,
    direction: "outbound",
    event_type: eventType,
    body,
    segment_count: smsSegments(body),
    created_at: new Date().toISOString(),
  });
}
