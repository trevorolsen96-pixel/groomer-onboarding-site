import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase-admin";
import { sendSms } from "../../../../lib/telnyx";
import { normalizeSmsText, smsSegments } from "../../../../lib/sms-text";
import { logOutboundSmsToConversation } from "../../../../lib/sms-conversation-log";
import {
  cleanText,
  normalizePhone,
  firstNameOnly,
  formatDateTime,
  formatTimeOnly,
  formatDateOnly,
  extractPetNames,
  petPossessiveFromNames,
  deletePendingAppointmentReminders,
  upsertAppointmentReminder,
} from "../../../../lib/sms-reminders";

type SmsAction =
  | "schedule_reminder"
  | "reschedule"
  | "cancellation"
  | "cancel_reminder_only"
  | "send_review_request"
  | "appointment_created"
  | "send_eta";

// Formats a plain hour/minute pair (0-23 / 0-59) as "H:MM AM/PM" -- used
// for the ETA feature, which deals in wall-clock times the groomer picks
// directly (e.g. "arrive at 11:00, 1.5hr window") rather than a specific
// calendar date/timezone instant like the rest of this file. No Date
// object or timezone conversion needed since it's pure minutes-since-
// midnight arithmetic.
function formatWallClock(hour: number, minute: number) {
  const normalizedMinute = ((minute % 60) + 60) % 60;
  const normalizedHour = ((hour % 24) + 24) % 24;
  const period = normalizedHour >= 12 ? "PM" : "AM";
  const hour12 = normalizedHour % 12 === 0 ? 12 : normalizedHour % 12;
  return `${hour12}:${normalizedMinute.toString().padStart(2, "0")} ${period}`;
}

// Sends an appointment-related text right now, synchronously -- as opposed
// to a *reminder*, which genuinely needs to fire at a future time and stays
// on the sms_outbound_queue + 5-minute cron. Confirmations, reschedules,
// cancellations, and review requests were previously routed through that
// same queue for simplicity, but that meant something meant to be
// immediate could sit for up to 5 minutes waiting on the next cron sweep --
// noticeably slower than a manually-typed message, which already sends
// synchronously. This brings those in line with manual sends, and as a
// bonus surfaces a real Telnyx failure back to the app immediately instead
// of silently marking a queue row "failed" after the app already thinks it
// succeeded.
async function sendImmediateSms({
  businessId,
  customerId,
  customerName,
  customerPhone,
  customerImageUrl,
  appointmentId,
  messageType,
  fromPhone,
  toPhone,
  message,
}: {
  businessId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerImageUrl?: string | null;
  appointmentId: string;
  messageType: string;
  fromPhone: string;
  toPhone: string;
  message: string;
}): Promise<string> {
  const providerMessageId = await sendSms({ from: fromPhone, to: toPhone, text: message });

  const nowIso = new Date().toISOString();

  await supabaseAdmin.from("sms_events").insert({
    business_id: businessId,
    appointment_id: appointmentId,
    customer_id: customerId,
    direction: "outbound",
    event_type: messageType,
    message_body: message,
    from_phone: fromPhone,
    to_phone: toPhone,
    created_at: nowIso,
  });

  // Best-effort: log to the customer's Messages thread + credit ledger.
  // Never blocks the caller -- the SMS itself already sent successfully
  // by the time this runs.
  try {
    await logOutboundSmsToConversation({
      businessId,
      customerId,
      customerName,
      customerPhone,
      customerImageUrl,
      body: message,
    });
  } catch (usageLogError) {
    console.error(`Failed to log ${messageType} SMS usage:`, usageLogError);
  }

  return providerMessageId;
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
    // Only used by the "send_eta" action -- wall-clock hour/minute the
    // groomer picked for their estimated arrival, plus how wide a window
    // to quote (both in 30-minute increments, enforced client-side).
    const arrivalHour = Number.isFinite(Number(body.arrivalHour))
      ? Number(body.arrivalHour)
      : null;
    const arrivalMinute = Number.isFinite(Number(body.arrivalMinute))
      ? Number(body.arrivalMinute)
      : null;
    const windowMinutes = Number.isFinite(Number(body.windowMinutes))
      ? Number(body.windowMinutes)
      : null;

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
      .select("status, phone_number")
      .eq("business_id", businessId)
      .maybeSingle();

    if (!smsSetup || !["approved", "active"].includes(smsSetup.status ?? "") || !smsSetup.phone_number) {
      return NextResponse.json(
        { error: "Text messaging is not approved for this business yet." },
        { status: 400 }
      );
    }

    const { data: settings } = await supabaseAdmin
      .from("business_settings")
      .select("business_name, sms_enabled, reschedule_sms_enabled, arrival_window_enabled, arrival_window_minutes, review_link, sms_timezone")
      .eq("business_id", businessId)
      .maybeSingle();

    const businessTimezone =
      cleanText(settings?.sms_timezone) || "America/Los_Angeles";

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
      .select("id, business_id, customer_id, scheduled_at, worker_id")
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
    if (isPastAppointment && action !== "cancellation" && action !== "send_review_request" && action !== "appointment_created" && action !== "send_eta") {
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

    // Fetch pet names for this appointment
    const { data: petServiceLines } = await supabaseAdmin
      .from("appointment_pet_services")
      .select("pets(name)")
      .eq("appointment_id", appointmentId)
      .limit(3);

    const petNames = extractPetNames(petServiceLines);

    // e.g. "Luna's" or "Luna and Milo's"
    const petPossessive = petPossessiveFromNames(petNames);

    if (action === "schedule_reminder") {
      const reminderResult = await upsertAppointmentReminder({
        businessId,
        customerId: customer.id,
        appointmentId,
        appointmentScheduledAt: appointment.scheduled_at,
        customerName,
        businessName,
        petPossessive,
        toPhone,
        appointmentDateTime,
        businessTimezone,
        arrivalWindowEnabled,
        arrivalWindowMinutes,
      });

      if (reminderResult.status === "no_rule") {
        return NextResponse.json({
          ok: true,
          status: "skipped",
          reminderStatus: "no_rule",
        });
      }

      if (reminderResult.status === "past_due_removed") {
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
        reminderStatus: reminderResult.status,
        queuedCount: reminderResult.queuedCount,
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
          `${petPossessive} appt has been rescheduled to ${date}, arrival ${start}-${end}.`;
      } else {
        const appointmentDate = formatDateTime(appointmentDateTime, businessTimezone);
        message =
          `Hi ${customerName}, this is ${businessName}. ` +
          `${petPossessive} grooming appt has been rescheduled to ${appointmentDate}.`;
      }
      message = normalizeSmsText(message);

      const segments = smsSegments(message);

      await assertSmsCreditsAvailable(businessId, segments);

      await sendImmediateSms({
        businessId,
        customerId: customer.id,
        customerName: customer.name,
        customerPhone: customer.phone,
        customerImageUrl: customer.image_url,
        appointmentId,
        messageType: "appointment_reschedule",
        fromPhone: smsSetup.phone_number,
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

      const reminderResult = await upsertAppointmentReminder({
        businessId,
        customerId: customer.id,
        appointmentId,
        appointmentScheduledAt: appointment.scheduled_at,
        customerName,
        businessName,
        petPossessive,
        toPhone,
        appointmentDateTime,
        businessTimezone,
        arrivalWindowEnabled,
        arrivalWindowMinutes,
      });

      return NextResponse.json({
        ok: true,
        status: "sent",
        reminderStatus: reminderResult.status,
        queuedCount: reminderResult.queuedCount,
      });
    }

    if (action === "cancellation") {
      const appointmentDate = formatDateTime(appointmentDateTime, businessTimezone);
      const message = normalizeSmsText(
        `Hi ${customerName}, this is ${businessName}. ` +
        `${petPossessive} grooming appt on ${appointmentDate} has been cancelled. ` +
        `Questions? Reply here.`
      );

      const segments = smsSegments(message);

      await assertSmsCreditsAvailable(businessId, segments);

      await deletePendingAppointmentReminders({ businessId, appointmentId });

      await sendImmediateSms({
        businessId,
        customerId: customer.id,
        customerName: customer.name,
        customerPhone: customer.phone,
        customerImageUrl: customer.image_url,
        appointmentId,
        messageType: "appointment_cancellation",
        fromPhone: smsSetup.phone_number,
        toPhone,
        message,
      });

      return NextResponse.json({
        ok: true,
        status: "sent",
        reminderStatus: "cancelled",
      });
    }

    if (action === "appointment_created") {
      let message: string;
      if (arrivalWindowEnabled && arrivalWindowMinutes > 0) {
        const endTime = new Date(appointmentDateTime.getTime() + arrivalWindowMinutes * 60 * 1000);
        const date = formatDateOnly(appointmentDateTime, businessTimezone);
        const start = formatTimeOnly(appointmentDateTime, businessTimezone);
        const end = formatTimeOnly(endTime, businessTimezone);
        message = normalizeSmsText(
          `Hi ${customerName}! ${petPossessive} grooming appointment with ${businessName} ` +
          `is booked for ${date}, arrival ${start}-${end}. We look forward to seeing you!`
        );
      } else {
        const createdApptDate = formatDateTime(appointmentDateTime, businessTimezone);
        message = normalizeSmsText(
          `Hi ${customerName}! ${petPossessive} grooming appointment with ${businessName} ` +
          `is booked for ${createdApptDate}. We look forward to seeing you!`
        );
      }

      const segments = smsSegments(message);
      await assertSmsCreditsAvailable(businessId, segments);

      await sendImmediateSms({
        businessId,
        customerId: customer.id,
        customerName: customer.name,
        customerPhone: customer.phone,
        customerImageUrl: customer.image_url,
        appointmentId,
        messageType: "appointment_created",
        fromPhone: smsSetup.phone_number,
        toPhone,
        message,
      });

      return NextResponse.json({ ok: true, status: "sent" });
    }

    if (action === "send_eta") {
      if (
        arrivalHour === null ||
        arrivalHour < 0 ||
        arrivalHour > 23 ||
        arrivalMinute === null ||
        arrivalMinute < 0 ||
        arrivalMinute > 59 ||
        windowMinutes === null ||
        windowMinutes <= 0
      ) {
        return NextResponse.json(
          { error: "Missing or invalid ETA details." },
          { status: 400 }
        );
      }

      let groomerLabel = "We";
      if (appointment.worker_id) {
        const { data: worker } = await supabaseAdmin
          .from("workers")
          .select("display_name")
          .eq("id", appointment.worker_id)
          .eq("business_id", businessId)
          .maybeSingle();

        const displayName = cleanText(worker?.display_name);
        if (displayName) {
          // First name only, matching the customer-name convention used
          // elsewhere in this file -- keeps the text short.
          groomerLabel = displayName.split(/\s+/)[0] || "We";
        }
      }

      const startLabel = formatWallClock(arrivalHour, arrivalMinute);
      const endTotalMinutes = arrivalHour * 60 + arrivalMinute + windowMinutes;
      const endHour = Math.floor(endTotalMinutes / 60) % 24;
      const endMinute = endTotalMinutes % 60;
      const endLabel = formatWallClock(endHour, endMinute);

      const message = normalizeSmsText(
        `Hi ${customerName}, this is ${businessName}. ` +
        `${groomerLabel} ${groomerLabel === "We" ? "are" : "is"} estimated to arrive between ${startLabel} and ${endLabel}.`
      );

      const segments = smsSegments(message);
      await assertSmsCreditsAvailable(businessId, segments);

      await sendImmediateSms({
        businessId,
        customerId: customer.id,
        customerName: customer.name,
        customerPhone: customer.phone,
        customerImageUrl: customer.image_url,
        appointmentId,
        messageType: "appointment_eta",
        fromPhone: smsSetup.phone_number,
        toPhone,
        message,
      });

      return NextResponse.json({ ok: true, status: "sent" });
    }

    if (action === "send_review_request") {
      const reviewLink = cleanText(settings?.review_link);

      if (!reviewLink) {
        return NextResponse.json(
          { error: "No review link set for this business." },
          { status: 400 }
        );
      }

      const message = normalizeSmsText(
        `Hi ${customerName}! Thanks for choosing ${businessName} today 🐾 ` +
        `We'd love your feedback — ${reviewLink}. See you next time!`
      );

      const segments = smsSegments(message);
      await assertSmsCreditsAvailable(businessId, segments);

      await sendImmediateSms({
        businessId,
        customerId: customer.id,
        customerName: customer.name,
        customerPhone: customer.phone,
        customerImageUrl: customer.image_url,
        appointmentId,
        messageType: "review_request",
        fromPhone: smsSetup.phone_number,
        toPhone,
        message,
      });

      return NextResponse.json({ ok: true, status: "sent" });
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