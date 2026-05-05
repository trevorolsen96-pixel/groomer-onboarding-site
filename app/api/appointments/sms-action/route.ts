import { NextResponse } from "next/server";
import twilio from "twilio";
import { supabaseAdmin } from "../../../../lib/supabase-admin";

type SmsAction =
  | "schedule_reminder"
  | "reschedule"
  | "cancellation"
  | "cancel_reminder_only";

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (value.startsWith("+")) return value.replace(/[^\d+]/g, "");
  return value;
}

function formatDateTime(value: Date) {
  return value.toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getTwilioClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    throw new Error("Twilio environment variables are missing.");
  }

  return twilio(accountSid, authToken);
}

async function recordOutboundMessage({
  businessId,
  customerId,
  customerName,
  customerPhone,
  customerImageUrl,
  messageBody,
  createdAt,
}: {
  businessId: string;
  customerId: string;
  customerName: string;
  customerPhone: string | null;
  customerImageUrl?: string | null;
  messageBody: string;
  createdAt: string;
}) {
  const { data: existingConversation } = await supabaseAdmin
    .from("message_conversations")
    .select("id")
    .eq("business_id", businessId)
    .eq("customer_id", customerId)
    .maybeSingle();

  let conversationId = existingConversation?.id as string | undefined;

  if (!conversationId) {
    const { data: insertedConversation, error: insertError } =
      await supabaseAdmin
        .from("message_conversations")
        .insert({
          business_id: businessId,
          customer_id: customerId,
          customer_name: customerName || "Client",
          customer_phone: customerPhone,
          customer_image_url: customerImageUrl ?? null,
          last_message_body: messageBody,
          last_message_at: createdAt,
          unread_count: 0,
          created_at: createdAt,
        })
        .select("id")
        .single();

    if (insertError || !insertedConversation) {
      throw new Error(insertError?.message ?? "Unable to create conversation.");
    }

    conversationId = insertedConversation.id;
  }

  await supabaseAdmin.from("message_items").insert({
    business_id: businessId,
    conversation_id: conversationId,
    customer_id: customerId,
    direction: "outbound",
    body: messageBody,
    status: "sent",
    provider: "twilio",
    created_at: createdAt,
  });

  await supabaseAdmin
    .from("message_conversations")
    .update({
      last_message_body: messageBody,
      last_message_at: createdAt,
    })
    .eq("id", conversationId);
}

async function sendNow({
  businessId,
  customerId,
  appointmentId,
  fromPhone,
  toPhone,
  body,
  eventType,
  customerName,
  customerImageUrl,
}: {
  businessId: string;
  customerId: string;
  appointmentId: string;
  fromPhone: string;
  toPhone: string;
  body: string;
  eventType: string;
  customerName: string;
  customerImageUrl?: string | null;
}) {
  const client = getTwilioClient();

  const sent = await client.messages.create({
    from: fromPhone,
    to: toPhone,
    body,
  });

  const now = new Date().toISOString();

  await recordOutboundMessage({
    businessId,
    customerId,
    customerName,
    customerPhone: toPhone,
    customerImageUrl,
    messageBody: body,
    createdAt: now,
  });

  await supabaseAdmin.from("sms_events").insert({
    business_id: businessId,
    customer_id: customerId,
    appointment_id: appointmentId,
    direction: "outbound",
    event_type: eventType,
    message_body: body,
    from_phone: fromPhone,
    to_phone: toPhone,
    created_at: now,
  });

  return sent.sid;
}

async function upsertAppointmentReminder({
  businessId,
  customerId,
  appointmentId,
  appointmentScheduledAt,
  customerName,
  businessName,
  toPhone,
  appointmentDate,
}: {
  businessId: string;
  customerId: string;
  appointmentId: string;
  appointmentScheduledAt: string;
  customerName: string;
  businessName: string;
  toPhone: string;
  appointmentDate: string;
}) {
  const { data: selectedRule } = await supabaseAdmin
    .from("business_sms_reminder_rules")
    .select("rule_type, offset_minutes, enabled")
    .eq("business_id", businessId)
    .eq("enabled", true)
    .order("offset_minutes", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!selectedRule) return "no_rule";

  const scheduledFor = new Date(
    new Date(appointmentScheduledAt).getTime() -
      selectedRule.offset_minutes * 60 * 1000
  );

  if (scheduledFor.getTime() <= Date.now()) {
    await supabaseAdmin
      .from("sms_outbound_queue")
      .delete()
      .eq("business_id", businessId)
      .eq("appointment_id", appointmentId)
      .eq("rule_type", selectedRule.rule_type)
      .eq("status", "pending");

    return "past_due_removed";
  }

  const message =
    `Hi ${customerName}, this is ${businessName}. ` +
    `Your grooming appointment is ${appointmentDate}. ` +
    `Reply YES to confirm, or NO if you need to reschedule.`;

      await supabaseAdmin
    .from("sms_outbound_queue")
    .delete()
    .eq("business_id", businessId)
    .eq("appointment_id", appointmentId)
    .eq("status", "pending");

  const dedupeKey = `${appointmentId}:${selectedRule.rule_type}`;

  await supabaseAdmin.from("sms_outbound_queue").upsert(
    {
      business_id: businessId,
      customer_id: customerId,
      appointment_id: appointmentId,
      message_type: "appointment_reminder",
      rule_type: selectedRule.rule_type,
      to_phone: toPhone,
      body_rendered: message,
      scheduled_for_utc: scheduledFor.toISOString(),
      status: "pending",
      dedupe_key: dedupeKey,
      attempt_count: 0,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "dedupe_key" }
  );

  return "refreshed";
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
    const appointmentId = cleanText(body.appointmentId);
    const action = cleanText(body.action) as SmsAction;

    if (!businessId || !appointmentId || !action) {
      return NextResponse.json(
        { error: "Missing appointment SMS details." },
        { status: 400 }
      );
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("business_id")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (!profile || profile.business_id !== businessId) {
      return NextResponse.json({ error: "Not authorized." }, { status: 403 });
    }

    const { data: smsSetup } = await supabaseAdmin
      .from("business_sms_setup")
      .select("status, phone_number")
      .eq("business_id", businessId)
      .maybeSingle();

    if (!smsSetup || smsSetup.status !== "approved" || !smsSetup.phone_number) {
      return NextResponse.json(
        { error: "Text messaging is not approved for this business yet." },
        { status: 400 }
      );
    }

    const { data: settings } = await supabaseAdmin
      .from("business_settings")
      .select("business_name, sms_enabled, reschedule_sms_enabled")
      .eq("business_id", businessId)
      .maybeSingle();

        if (action === "cancel_reminder_only") {
  await supabaseAdmin
    .from("sms_outbound_queue")
    .delete()
    .eq("business_id", businessId)
    .eq("appointment_id", appointmentId)
    .eq("status", "pending");

  return NextResponse.json({
    ok: true,
    status: "cancelled",
    reminderStatus: "cancelled",
  });
}

    if (settings?.sms_enabled === false && action === "schedule_reminder") {
      await supabaseAdmin
        .from("sms_outbound_queue")
        .delete()
        .eq("business_id", businessId)
        .eq("appointment_id", appointmentId)
        .eq("status", "pending");

      return NextResponse.json({
        ok: true,
        status: "skipped",
        reminderStatus: "sms_disabled",
      });
    }

    if (action === "reschedule" && settings?.reschedule_sms_enabled === false) {
      return NextResponse.json(
        { error: "Reschedule texts are turned off for this business." },
        { status: 400 }
      );
    }

    const { data: appointment } = await supabaseAdmin
      .from("appointments")
      .select("id, business_id, customer_id, scheduled_at")
      .eq("id", appointmentId)
      .eq("business_id", businessId)
      .maybeSingle();

    if (!appointment) {
      return NextResponse.json(
        { error: "Appointment was not found." },
        { status: 404 }
      );
    }

    const { data: customer } = await supabaseAdmin
      .from("customers")
      .select("id, name, phone, image_url")
      .eq("id", appointment.customer_id)
      .eq("business_id", businessId)
      .maybeSingle();

    if (!customer || !customer.phone) {
      return NextResponse.json(
        { error: "This customer does not have a phone number." },
        { status: 400 }
      );
    }

    const fromPhone = normalizePhone(smsSetup.phone_number);
    const toPhone = normalizePhone(customer.phone);
    const businessName =
      cleanText(settings?.business_name) || "your grooming business";
    const customerName = cleanText(customer.name) || "there";
    const appointmentDate = formatDateTime(new Date(appointment.scheduled_at));

    if (action === "schedule_reminder") {
      const reminderStatus = await upsertAppointmentReminder({
        businessId,
        customerId: customer.id,
        appointmentId,
        appointmentScheduledAt: appointment.scheduled_at,
        customerName,
        businessName,
        toPhone,
        appointmentDate,
      });

      if (reminderStatus === "no_rule") {
        return NextResponse.json(
          { error: "No reminder timing is enabled." },
          { status: 400 }
        );
      }

      if (reminderStatus === "past_due_removed") {
        return NextResponse.json(
          { error: "This reminder time has already passed." },
          { status: 400 }
        );
      }

      await supabaseAdmin
        .from("appointments")
        .update({
          confirmation_status: "pending",
          confirmation_requested_at: new Date().toISOString(),
          confirmation_responded_at: null,
        })
        .eq("id", appointmentId)
        .eq("business_id", businessId);

      return NextResponse.json({
        ok: true,
        status: "queued",
        reminderStatus,
      });
    }

    if (action === "reschedule") {
      const message =
        `Hi ${customerName}, this is ${businessName}. ` +
        `Your grooming appointment has been updated to ${appointmentDate}. ` +
        `Reply YES to confirm, or NO if you need to reschedule.`;

      const providerMessageId = await sendNow({
        businessId,
        customerId: customer.id,
        appointmentId,
        fromPhone,
        toPhone,
        body: message,
        eventType: "appointment_reschedule",
        customerName,
        customerImageUrl: customer.image_url,
      });

      await supabaseAdmin
        .from("appointments")
        .update({
          confirmation_status: "pending",
          confirmation_requested_at: new Date().toISOString(),
          confirmation_responded_at: null,
        })
        .eq("id", appointmentId)
        .eq("business_id", businessId);

      const reminderStatus = await upsertAppointmentReminder({
        businessId,
        customerId: customer.id,
        appointmentId,
        appointmentScheduledAt: appointment.scheduled_at,
        customerName,
        businessName,
        toPhone,
        appointmentDate,
      });

      return NextResponse.json({
        ok: true,
        status: "sent",
        reminderStatus,
        providerMessageId,
      });
    }

    if (action === "cancellation") {
      const message =
        `Hi ${customerName}, this is ${businessName}. ` +
        `Your grooming appointment on ${appointmentDate} has been cancelled. ` +
        `Please contact us if you have any questions.`;

      const providerMessageId = await sendNow({
        businessId,
        customerId: customer.id,
        appointmentId,
        fromPhone,
        toPhone,
        body: message,
        eventType: "appointment_cancellation",
        customerName,
        customerImageUrl: customer.image_url,
      });

      await supabaseAdmin
        .from("sms_outbound_queue")
        .delete()
        .eq("business_id", businessId)
        .eq("appointment_id", appointmentId)
        .eq("status", "pending");

      return NextResponse.json({
        ok: true,
        status: "sent",
        reminderStatus: "cancelled",
        providerMessageId,
      });
    }

    return NextResponse.json(
      { error: "Unsupported SMS action." },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to process appointment SMS.",
      },
      { status: 400 }
    );
  }
}