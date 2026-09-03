import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase-admin";
import {
  cleanText,
  normalizePhone,
  firstNameOnly,
  extractPetNames,
  petPossessiveFromNames,
  upsertAppointmentReminder,
} from "../../../../lib/sms-reminders";

// Called by a Supabase Database Webhook on business_sms_reminder_rules
// (insert/update) and business_settings (update) -- see
// docs/recalculate-reminders-webhook.md for the exact trigger setup.
// Editing a business's reminder rules only ever re-queued the ONE
// appointment being booked/edited at that moment (see sms-action's
// schedule_reminder action); every other future appointment on the
// business kept whatever reminder schedule was computed under the *old*
// rules. This re-runs that same per-appointment queue logic across every
// upcoming appointment for a business, triggered straight off the table
// write itself so it works no matter which app/app version made it --
// no client update required.
//
// Validated against a real queue on one business (see the SMS reminder
// recalculation work in project history) before being opened up here to
// every business.

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    const webhookSecret = process.env.RECALC_REMINDERS_WEBHOOK_SECRET;

    const body = await request.json();
    let businessId: string;

    if (webhookSecret && token === webhookSecret) {
      // Trusted call from the Supabase Database Webhook on
      // business_sms_reminder_rules / business_settings -- fires from the
      // database itself the instant either table is written, regardless
      // of which app/app version made the write, so this never depends on
      // a client being updated. Supabase's webhook payload shape is
      // {type, table, schema, record, old_record}.
      businessId = cleanText(
        (body?.record as { business_id?: string } | undefined)?.business_id
      );
    } else {
      // Fallback: a signed-in business owner calling this directly.
      if (!token) {
        return NextResponse.json({ error: "Not signed in." }, { status: 401 });
      }

      const { data: userData, error: userError } =
        await supabaseAdmin.auth.getUser(token);

      if (userError || !userData.user) {
        return NextResponse.json({ error: "Not signed in." }, { status: 401 });
      }

      businessId = cleanText(body.businessId);

      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("business_id")
        .eq("id", userData.user.id)
        .maybeSingle();

      if (!profile || profile.business_id !== businessId) {
        return NextResponse.json({ error: "Not authorized." }, { status: 403 });
      }
    }

    if (!businessId) {
      return NextResponse.json(
        { error: "Missing businessId." },
        { status: 400 }
      );
    }

    const { data: settings } = await supabaseAdmin
      .from("business_settings")
      .select(
        "business_name, sms_enabled, arrival_window_enabled, arrival_window_minutes, sms_timezone"
      )
      .eq("business_id", businessId)
      .maybeSingle();

    // Mirrors sms-action: a business with SMS off shouldn't have anything
    // sitting on the queue at all, whatever the rules say.
    if (settings?.sms_enabled === false) {
      await supabaseAdmin
        .from("sms_outbound_queue")
        .delete()
        .eq("business_id", businessId)
        .eq("message_type", "appointment_reminder")
        .eq("status", "pending");

      return NextResponse.json({
        ok: true,
        status: "skipped",
        reason: "sms_disabled",
      });
    }

    const { data: smsSetup } = await supabaseAdmin
      .from("business_sms_setup")
      .select("status, phone_number")
      .eq("business_id", businessId)
      .maybeSingle();

    if (
      !smsSetup ||
      !["approved", "active"].includes(smsSetup.status ?? "") ||
      !smsSetup.phone_number
    ) {
      // Nothing can send yet regardless of what the rules say -- leave
      // whatever's queued alone rather than erroring, since this can be
      // called right after every settings save.
      return NextResponse.json({
        ok: true,
        status: "skipped",
        reason: "sms_not_active",
      });
    }

    const businessName =
      cleanText(settings?.business_name) || "your grooming business";
    const businessTimezone =
      cleanText(settings?.sms_timezone) || "America/Los_Angeles";
    const arrivalWindowEnabled = settings?.arrival_window_enabled === true;
    const arrivalWindowMinutes = Number(settings?.arrival_window_minutes ?? 60);

    const nowIso = new Date().toISOString();

    const { data: appointments, error: appointmentsError } = await supabaseAdmin
      .from("appointments")
      .select("id, customer_id, scheduled_at")
      .eq("business_id", businessId)
      .neq("status", "cancelled")
      .gt("scheduled_at", nowIso);

    if (appointmentsError) throw new Error(appointmentsError.message);

    let refreshed = 0;
    let noRule = 0;
    let pastDueRemoved = 0;
    let skippedNoPhone = 0;
    const errors: string[] = [];

    for (const appointment of appointments ?? []) {
      try {
        const { data: customer } = await supabaseAdmin
          .from("customers")
          .select("id, name, phone")
          .eq("id", appointment.customer_id)
          .eq("business_id", businessId)
          .maybeSingle();

        if (!customer || !customer.phone) {
          skippedNoPhone++;
          continue;
        }

        const { data: petServiceLines } = await supabaseAdmin
          .from("appointment_pet_services")
          .select("pets(name)")
          .eq("appointment_id", appointment.id)
          .limit(3);

        const petNames = extractPetNames(petServiceLines);

        const result = await upsertAppointmentReminder({
          businessId,
          customerId: customer.id,
          appointmentId: appointment.id,
          appointmentScheduledAt: appointment.scheduled_at,
          customerName: firstNameOnly(cleanText(customer.name)),
          businessName,
          petPossessive: petPossessiveFromNames(petNames),
          toPhone: normalizePhone(customer.phone),
          appointmentDateTime: new Date(appointment.scheduled_at),
          businessTimezone,
          arrivalWindowEnabled,
          arrivalWindowMinutes,
        });

        if (result.status === "refreshed") refreshed++;
        else if (result.status === "no_rule") noRule++;
        else if (result.status === "past_due_removed") pastDueRemoved++;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`${appointment.id}: ${message}`);
      }
    }

    return NextResponse.json({
      ok: true,
      status: "recalculated",
      appointmentsConsidered: appointments?.length ?? 0,
      refreshed,
      noRule,
      pastDueRemoved,
      skippedNoPhone,
      errors,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to recalculate SMS reminders.",
      },
      { status: 400 }
    );
  }
}
