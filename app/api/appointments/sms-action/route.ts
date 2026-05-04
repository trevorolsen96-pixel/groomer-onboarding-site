import { NextResponse } from "next/server";
import twilio from "twilio";
import { supabaseAdmin } from "../../../../lib/supabase-admin";

type SmsAction = "schedule_reminder" | "reschedule" | "cancellation";

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

async function sendNow({
  businessId,
  customerId,
  appointmentId,
  fromPhone,
  toPhone,
  body,
  eventType,
}: {
  businessId: string;
  customerId: string;
  appointmentId: string;
  fromPhone: string;
  toPhone: string;
  body: string;
  eventType: string;
}) {
  const client = getTwilioClient();

  const sent = await client.messages.create({
    from: fromPhone,
    to: toPhone,
    body,
  });

  const now = new Date().toISOString();

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

    if (settings?.sms_enabled === false) {
      return NextResponse.json(
        { error: "SMS reminders are turned off for this business." },
        { status: 400 }
      );
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
      .select("id, name, phone")
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
    const appointmentDate = formatDateTime(new Date(appointment.scheduled_at));

    if (action === "schedule_reminder") {
      const { data: selectedRule } = await supabaseAdmin
        .from("business_sms_reminder_rules")
        .select("rule_type, offset_minutes, enabled")
        .eq("business_id", businessId)
        .eq("enabled", true)
        .order("offset_minutes", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!selectedRule) {
        return NextResponse.json(
          { error: "No reminder timing is enabled." },
          { status: 400 }
        );
      }

      const scheduledFor = new Date(
        new Date(appointment.scheduled_at).getTime() -
          selectedRule.offset_minutes * 60 * 1000
      );

      if (scheduledFor.getTime() <= Date.now()) {
        return NextResponse.json(
          { error: "This reminder time has already passed." },
          { status: 400 }
        );
      }

      const message =
        `Hi ${customer.name}, this is ${businessName}. ` +
        `Your grooming appointment is ${appointmentDate}. ` +
        `Reply YES to confirm, or NO if you need to reschedule.`;

      const dedupeKey = `${appointmentId}:${selectedRule.rule_type}`;

      await supabaseAdmin.from("sms_outbound_queue").upsert(
        {
          business_id: businessId,
          customer_id: customer.id,
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

      await supabaseAdmin
        .from("appointments")
        .update({
          confirmation_status: "pending",
          confirmation_requested_at: new Date().toISOString(),
          confirmation_responded_at: null,
        })
        .eq("id", appointmentId)
        .eq("business_id", businessId);

      return NextResponse.json({ ok: true, status: "queued" });
    }

    if (action === "reschedule") {
      const message =
        `Hi ${customer.name}, this is ${businessName}. ` +
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

      return NextResponse.json({ ok: true, status: "sent", providerMessageId });
    }

    if (action === "cancellation") {
      const message =
        `Hi ${customer.name}, this is ${businessName}. ` +
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
      });

      return NextResponse.json({ ok: true, status: "sent", providerMessageId });
    }

    return NextResponse.json({ error: "Unsupported SMS action." }, { status: 400 });
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