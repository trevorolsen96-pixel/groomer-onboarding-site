import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase-admin";

function normalizePhone(value: string) {
  return value.replace(/[^\d+]/g, "");
}

function buildReminderBody({
  customerName,
  petName,
  siblingNames,
}: {
  customerName: string;
  petName: string;
  siblingNames: string[];
}) {
  const firstName = customerName.trim().split(/\s+/)[0] || "there";

  if (siblingNames.length > 0) {
    const pets = [petName, ...siblingNames].join(" and ");

    return `Hi ${firstName}! ${petName} is due for grooming. Would you like to schedule ${pets} together?`;
  }

  return `Hi ${firstName}! ${petName} is due for grooming. Would you like to schedule their next visit?`;
}

async function hasFutureAppointmentForPet({
  businessId,
  petId,
}: {
  businessId: string;
  petId: string;
}) {
  const now = new Date().toISOString();

  const { data: lines, error: linesError } = await supabaseAdmin
    .from("appointment_pet_services")
    .select("appointment_id")
    .eq("pet_id", petId);

  if (linesError) throw new Error(linesError.message);

  const appointmentIds = [...new Set((lines ?? []).map((x) => x.appointment_id))];

  if (appointmentIds.length === 0) return false;

  const { data: futureAppointments, error: futureError } = await supabaseAdmin
    .from("appointments")
    .select("id")
    .eq("business_id", businessId)
    .in("id", appointmentIds)
    .eq("status", "scheduled")
    .gt("scheduled_at", now)
    .limit(1);

  if (futureError) throw new Error(futureError.message);

  return (futureAppointments ?? []).length > 0;
}

export async function GET() {
  try {
    const nowIso = new Date().toISOString();

    const { data: duePets, error: duePetsError } = await supabaseAdmin
      .from("pets")
      .select(
        "id, business_id, customer_id, name, is_active, care_reminder_enabled, care_reminder_include_siblings, care_reminder_last_groomed_at, care_reminder_next_due_at, care_reminder_last_sent_at"
      )
      .eq("is_active", true)
      .eq("care_reminder_enabled", true)
      .lte("care_reminder_next_due_at", nowIso)
      .limit(50);

    if (duePetsError) throw new Error(duePetsError.message);

    let queuedCount = 0;
    let skippedCount = 0;

    for (const pet of duePets ?? []) {
      try {
        const businessId = String(pet.business_id ?? "");
        const customerId = String(pet.customer_id ?? "");
        const petId = String(pet.id ?? "");
        const petName = String(pet.name ?? "").trim();

        if (!businessId || !customerId || !petId || !petName) {
          skippedCount++;
          continue;
        }

        const lastGroomedAt = pet.care_reminder_last_groomed_at
          ? new Date(String(pet.care_reminder_last_groomed_at))
          : null;

        const lastSentAt = pet.care_reminder_last_sent_at
          ? new Date(String(pet.care_reminder_last_sent_at))
          : null;

        if (!lastGroomedAt) {
          skippedCount++;
          continue;
        }

        if (lastSentAt && lastSentAt >= lastGroomedAt) {
          skippedCount++;
          continue;
        }

        const { data: customer, error: customerError } = await supabaseAdmin
          .from("customers")
          .select("id, name, phone, is_active")
          .eq("id", customerId)
          .eq("business_id", businessId)
          .maybeSingle();

        if (customerError) throw new Error(customerError.message);

        if (!customer || customer.is_active === false) {
          skippedCount++;
          continue;
        }

        const toPhone = normalizePhone(String(customer.phone ?? ""));

        if (!toPhone) {
          skippedCount++;
          continue;
        }

        const { data: smsSetup } = await supabaseAdmin
          .from("business_sms_setup")
          .select("status, phone_number")
          .eq("business_id", businessId)
          .maybeSingle();

        if (
          !smsSetup ||
          smsSetup.status !== "approved" ||
          !smsSetup.phone_number
        ) {
          skippedCount++;
          continue;
        }

        const alreadyBooked = await hasFutureAppointmentForPet({
          businessId,
          petId,
        });

        if (alreadyBooked) {
          skippedCount++;
          continue;
        }

        let siblingNames: string[] = [];

        if (pet.care_reminder_include_siblings === true) {
          const { data: siblings, error: siblingsError } = await supabaseAdmin
            .from("pets")
            .select("id, name, is_active")
            .eq("business_id", businessId)
            .eq("customer_id", customerId)
            .eq("is_active", true);

          if (siblingsError) throw new Error(siblingsError.message);

          siblingNames = (siblings ?? [])
            .filter((s) => String(s.id) !== petId)
            .map((s) => String(s.name ?? "").trim())
            .filter(Boolean)
            .slice(0, 2);
        }

        const messageBody = buildReminderBody({
          customerName: String(customer.name ?? ""),
          petName,
          siblingNames,
        });

        const { error: queueError } = await supabaseAdmin
          .from("sms_outbound_queue")
          .insert({
            business_id: businessId,
            appointment_id: null,
            customer_id: customerId,
            to_phone: toPhone,
            message_type: "care_reminder",
            rule_type: "pet_care_reminder",
            body_rendered: messageBody,
            scheduled_for_utc: nowIso,
            status: "pending",
            attempt_count: 0,
            created_at: nowIso,
            updated_at: nowIso,
          });

        if (queueError) throw new Error(queueError.message);

        await supabaseAdmin
          .from("pets")
          .update({
            care_reminder_last_sent_at: nowIso,
          })
          .eq("id", petId)
          .eq("business_id", businessId);

        queuedCount++;
      } catch {
        skippedCount++;
      }
    }

    return NextResponse.json({
      ok: true,
      queuedCount,
      skippedCount,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to process pet care reminders.",
      },
      { status: 400 }
    );
  }
}