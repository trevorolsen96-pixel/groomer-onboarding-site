import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase-admin";

function normalizePhone(value: string) {
  return value.replace(/[^\d+]/g, "");
}

function cleanTime(value: unknown) {
  const raw = String(value ?? "09:00").trim();
  return raw.slice(0, 5);
}

function localMinutesForTimezone(timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");

  return hour * 60 + minute;
}

function timeToMinutes(value: string) {
  const [hourRaw, minuteRaw] = value.split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return 9 * 60;

  return hour * 60 + minute;
}

function isWithinSendWindow({
  timezone,
  sendTimeLocal,
}: {
  timezone: string;
  sendTimeLocal: string;
}) {
  const localNow = localMinutesForTimezone(timezone);
  const target = timeToMinutes(sendTimeLocal);

  const diff = localNow - target;

  return diff >= 0 && diff < 15;
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

  const appointmentIds = [
    ...new Set((lines ?? []).map((x) => x.appointment_id).filter(Boolean)),
  ];

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

async function processBusinessCareReminders({
  businessId,
}: {
  businessId: string;
}) {
  const nowIso = new Date().toISOString();

  const { data: duePets, error: duePetsError } = await supabaseAdmin
    .from("pets")
    .select(
      "id, business_id, customer_id, name, is_active, care_reminder_enabled, care_reminder_include_siblings, care_reminder_last_groomed_at, care_reminder_next_due_at, care_reminder_last_sent_at"
    )
    .eq("business_id", businessId)
    .eq("is_active", true)
    .eq("care_reminder_enabled", true)
    .lte("care_reminder_next_due_at", nowIso)
    .limit(50);

  if (duePetsError) throw new Error(duePetsError.message);

  let queuedCount = 0;
  let skippedCount = 0;

  for (const pet of duePets ?? []) {
    try {
      const customerId = String(pet.customer_id ?? "");
      const petId = String(pet.id ?? "");
      const petName = String(pet.name ?? "").trim();

      if (!customerId || !petId || !petName) {
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

      const { data: customer } = await supabaseAdmin
        .from("customers")
        .select("id, name, phone, is_active")
        .eq("id", customerId)
        .eq("business_id", businessId)
        .maybeSingle();

      if (!customer || customer.is_active === false) {
        skippedCount++;
        continue;
      }

      const toPhone = normalizePhone(String(customer.phone ?? ""));

      if (!toPhone) {
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
        const { data: siblings } = await supabaseAdmin
          .from("pets")
          .select("id, name, is_active")
          .eq("business_id", businessId)
          .eq("customer_id", customerId)
          .eq("is_active", true);

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

  return { queuedCount, skippedCount };
}

export async function GET() {
  try {
    const { data: setups, error: setupsError } = await supabaseAdmin
      .from("business_sms_setup")
      .select("business_id, status, timezone, care_reminder_send_time_local")
      .eq("status", "approved");

    if (setupsError) throw new Error(setupsError.message);

    let businessesChecked = 0;
    let businessesInWindow = 0;
    let queuedCount = 0;
    let skippedCount = 0;

    for (const setup of setups ?? []) {
      businessesChecked++;

      const businessId = String(setup.business_id ?? "").trim();
      const timezone = String(setup.timezone ?? "America/Los_Angeles").trim();
      const sendTimeLocal = cleanTime(setup.care_reminder_send_time_local);

      if (!businessId) continue;

      if (
        !isWithinSendWindow({
          timezone,
          sendTimeLocal,
        })
      ) {
        continue;
      }

      businessesInWindow++;

      const result = await processBusinessCareReminders({ businessId });

      queuedCount += result.queuedCount;
      skippedCount += result.skippedCount;
    }

    return NextResponse.json({
      ok: true,
      businessesChecked,
      businessesInWindow,
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