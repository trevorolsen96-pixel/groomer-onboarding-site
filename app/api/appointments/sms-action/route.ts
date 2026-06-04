import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase-admin";

type SmsAction =
  | "schedule_reminder"
  | "reschedule"
  | "cancellation"
  | "cancel_reminder_only"
  | "send_review_request"
  | "appointment_created";

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

function firstNameOnly(value: string) {
  const clean = value.trim();
  if (!clean) return "there";
  return clean.split(/\s+/)[0] || "there";
}

function formatDateTime(value: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone || "America/Los_Angeles",
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  }).formatToParts(value);

  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${get("month")}/${get("day")}/${get("year")} ${get("hour")}:${get(
    "minute"
  )} ${get("dayPeriod")}`;
}

function formatTimeOnly(value: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone || "America/Los_Angeles",
    hour: "numeric",
    minute: "2-digit",
  }).formatToParts(value);

  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${get("hour")}:${get("minute")} ${get("dayPeriod")}`;
}

function formatDateOnly(value: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone || "America/Los_Angeles",
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);

  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${get("month")}/${get("day")}/${get("year")}`;
}


async function deletePendingAppointmentReminders({
  businessId,
  appointmentId,
}: {
  businessId: string;
  appointmentId: string;
}) {
  await supabaseAdmin
    .from("sms_outbound_queue")
    .delete()
    .eq("business_id", businessId)
    .eq("appointment_id", appointmentId)
    .eq("message_type", "appointment_reminder")
    .eq("status", "pending");
}

async function queueImmediateSms({
  businessId,
  customerId,
  appointmentId,
  messageType,
  toPhone,
  message,
}: {
  businessId: string;
  customerId: string;
  appointmentId: string;
  messageType: string;
  toPhone: string;
  message: string;
}) {
  const now = new Date().toISOString();

  await supabaseAdmin.from("sms_outbound_queue").insert({
    business_id: businessId,
    customer_id: customerId,
    appointment_id: appointmentId,
    message_type: messageType,
    rule_type: "immediate",
    to_phone: toPhone,
    body_rendered: message,
    scheduled_for_utc: now,
    status: "pending",
    dedupe_key: `${appointmentId}:${messageType}:${Date.now()}`,
    attempt_count: 0,
    updated_at: now,
  });
}

async function upsertAppointmentReminder({
  businessId,
  customerId,
  appointmentId,
  appointmentScheduledAt,
  customerName,
  businessName,
  toPhone,
  appointmentDateTime,
  businessTimezone,
  arrivalWindowEnabled,
  arrivalWindowMinutes,
}: {
  businessId: string;
  customerId: string;
  appointmentId: string;
  appointmentScheduledAt: string;
  customerName: string;
  businessName: string;
  toPhone: string;
  appointmentDateTime: Date;
  businessTimezone: string;
  arrivalWindowEnabled: boolean;
  arrivalWindowMinutes: number;
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
      Number(selectedRule.offset_minutes ?? 0) * 60 * 1000
  );

  await deletePendingAppointmentReminders({ businessId, appointmentId });

  if (scheduledFor.getTime() <= Date.now()) {
    return "past_due_removed";
  }

  let message: string;
  if (arrivalWindowEnabled && arrivalWindowMinutes > 0) {
    const endTime = new Date(appointmentDateTime.getTime() + arrivalWindowMinutes * 60 * 1000);
    const date = formatDateOnly(appointmentDateTime, businessTimezone);
    const start = formatTimeOnly(appointmentDateTime, businessTimezone);
    const end = formatTimeOnly(endTime, businessTimezone);
    message =
      `Hi ${customerName}, this is ${businessName}. ` +
      `Appt: ${date}, arrival ${start}-${end}. ` +
      `Reply YES to confirm or NO to cancel.`;
  } else {
    const appointmentDate = formatDateTime(appointmentDateTime, businessTimezone);
    message =
      `Hi ${customerName}, this is ${businessName}. ` +
      `Your grooming appt is ${appointmentDate}. ` +
      `Reply YES to confirm or NO to cancel.`;
  }

    const { error: queueError } = await supabaseAdmin
    .from("sms_outbound_queue")
    .upsert(
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
        dedupe_key: `${appointmentId}:${selectedRule.rule_type}`,
        attempt_count: 0,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "dedupe_key" }
    );

    if (queueError) {
    throw new Error(`Unable to queue appointment reminder: ${queueError.message}`);
  }

  const { data: queuedRow, error: verifyError } = await supabaseAdmin
    .from("sms_outbound_queue")
    .select("id, appointment_id, message_type, rule_type, scheduled_for_utc, status")
    .eq("business_id", businessId)
    .eq("appointment_id", appointmentId)
    .eq("message_type", "appointment_reminder")
    .maybeSingle();

  if (verifyError) {
    throw new Error(`Unable to verify queued reminder: ${verifyError.message}`);
  }

  if (!queuedRow) {
    throw new Error(
      `Reminder upsert reported success, but no sms_outbound_queue row exists for appointment ${appointmentId}`
    );
  }

  return "refreshed";
}

function calculateSmsSegments(message: string) {
  const length = message.trim().length;
  if (length <= 0) return 1;
  return Math.ceil(length / 160);
}

async function assertSmsCreditsAvailable(
  businessId: string,
  neededCredits: number
) {
  const { data, error } = await supabaseAdmin.rpc("get_sms_credit_summary", {
    p_business_id: businessId,
  });

  if (error) {
    throw new Error("Unable to verify SMS credits.");
  }

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

    if (action === "cancel_reminder_only") {
      await deletePendingAppointmentReminders({ businessId, appointmentId });

      return NextResponse.json({
        ok: true,
        status: "cancelled",
        reminderStatus: "cancelled",
      });
    }

    const { data: smsSetup } = await supabaseAdmin
      .from("business_sms_setup")
      .select("status, phone_number, timezone")
      .eq("business_id", businessId)
      .maybeSingle();

    if (!smsSetup || !["approved", "active"].includes(smsSetup.status ?? "") || !smsSetup.phone_number) {
      return NextResponse.json(
        { error: "Text messaging is not approved for this business yet." },
        { status: 400 }
      );
    }

    const businessTimezone =
      cleanText(smsSetup.timezone) || "America/Los_Angeles";

    const { data: settings } = await supabaseAdmin
      .from("business_settings")
      .select("business_name, sms_enabled, reschedule_sms_enabled, arrival_window_enabled, arrival_window_minutes, review_link")
      .eq("business_id", businessId)
      .maybeSingle();

    if (settings?.sms_enabled === false) {
      await deletePendingAppointmentReminders({ businessId, appointmentId });

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

    const appointmentDateTime = new Date(appointment.scheduled_at);
    const isPastAppointment = appointmentDateTime.getTime() <= Date.now();

    // For reminders and reschedules, skip if the appointment is in the past
    // Cancellations and review requests should still send regardless of appointment time
    if (isPastAppointment && action !== "cancellation" && action !== "send_review_request" && action !== "appointment_created") {
      await deletePendingAppointmentReminders({ businessId, appointmentId });

      return NextResponse.json({
        ok: true,
        status: "skipped",
        reminderStatus: "past_appointment_removed",
      });
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

    const toPhone = normalizePhone(customer.phone);
    const businessName =
      cleanText(settings?.business_name) || "your grooming business";
    const customerName = firstNameOnly(cleanText(customer.name));
    const arrivalWindowEnabled = settings?.arrival_window_enabled === true;
    const arrivalWindowMinutes = Number(settings?.arrival_window_minutes ?? 60);

    if (action === "schedule_reminder") {
      const reminderStatus = await upsertAppointmentReminder({
        businessId,
        customerId: customer.id,
        appointmentId,
        appointmentScheduledAt: appointment.scheduled_at,
        customerName,
        businessName,
        toPhone,
        appointmentDateTime,
        businessTimezone,
        arrivalWindowEnabled,
        arrivalWindowMinutes,
      });

      if (reminderStatus === "no_rule") {
        return NextResponse.json({
          ok: true,
          status: "skipped",
          reminderStatus: "no_rule",
        });
      }

      if (reminderStatus === "past_due_removed") {
        return NextResponse.json({
          ok: true,
          status: "skipped",
          reminderStatus: "past_due_removed",
        });
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
      let message: string;
      if (arrivalWindowEnabled && arrivalWindowMinutes > 0) {
        const endTime = new Date(appointmentDateTime.getTime() + arrivalWindowMinutes * 60 * 1000);
        const date = formatDateOnly(appointmentDateTime, businessTimezone);
        const start = formatTimeOnly(appointmentDateTime, businessTimezone);
        const end = formatTimeOnly(endTime, businessTimezone);
        message =
          `Hi ${customerName}, this is ${businessName}. ` +
          `Updated appt: ${date}, arrival ${start}-${end}. ` +
          `Reply YES to confirm or NO to cancel.`;
      } else {
        const appointmentDate = formatDateTime(appointmentDateTime, businessTimezone);
        message =
          `Hi ${customerName}, this is ${businessName}. ` +
          `Your grooming appt is now ${appointmentDate}. ` +
          `Reply YES to confirm or NO to cancel.`;
      }

      const segments = calculateSmsSegments(message);

      await assertSmsCreditsAvailable(businessId, segments);

      await queueImmediateSms({
        businessId,
        customerId: customer.id,
        appointmentId,
        messageType: "appointment_reschedule",
        toPhone,
        message,
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
        appointmentDateTime,
        businessTimezone,
        arrivalWindowEnabled,
        arrivalWindowMinutes,
      });

      return NextResponse.json({
        ok: true,
        status: "queued",
        reminderStatus,
      });
    }

    if (action === "cancellation") {
      const appointmentDate = formatDateTime(appointmentDateTime, businessTimezone);
      const message =
        `Hi ${customerName}, this is ${businessName}. ` +
        `Your grooming appt on ${appointmentDate} has been cancelled. ` +
        `Questions? Reply here.`;

      const segments = calculateSmsSegments(message);

      await assertSmsCreditsAvailable(businessId, segments);

      await deletePendingAppointmentReminders({ businessId, appointmentId });

      await queueImmediateSms({
        businessId,
        customerId: customer.id,
        appointmentId,
        messageType: "appointment_cancellation",
        toPhone,
        message,
      });

      return NextResponse.json({
        ok: true,
        status: "queued",
        reminderStatus: "cancelled",
      });
    }

    if (action === "appointment_created") {
      const message =
        `Hi ${customerName}! Your grooming appointment with ${businessName} ` +
        `is booked for ${appointmentDate}. We look forward to seeing you!`;

      const segments = calculateSmsSegments(message);
      await assertSmsCreditsAvailable(businessId, segments);

      await queueImmediateSms({
        businessId,
        customerId: customer.id,
        appointmentId,
        messageType: "appointment_created",
        toPhone,
        message,
      });

      return NextResponse.json({ ok: true, status: "queued" });
    }

    if (action === "send_review_request") {
      const reviewLink = cleanText(settings?.review_link);

      if (!reviewLink) {
        return NextResponse.json(
          { error: "No review link set for this business." },
          { status: 400 }
        );
      }

      const message =
        `Hi ${customerName}! Thanks for choosing ${businessName} today 🐾 ` +
        `We'd love your feedback — ${reviewLink}. See you next time!`;

      const segments = calculateSmsSegments(message);
      await assertSmsCreditsAvailable(businessId, segments);

      await queueImmediateSms({
        businessId,
        customerId: customer.id,
        appointmentId,
        messageType: "review_request",
        toPhone,
        message,
      });

      return NextResponse.json({ ok: true, status: "queued" });
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