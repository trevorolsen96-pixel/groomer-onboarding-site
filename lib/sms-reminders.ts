import { supabaseAdmin } from "./supabase-admin";
import { normalizeSmsText } from "./sms-text";

// Shared by the single-appointment sms-action route and the
// recalculate-reminders batch route -- both need to turn "here's an
// appointment + the business's current rules" into the same rendered
// sms_outbound_queue rows, so the wording never drifts between the two
// call sites.

export function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (value.startsWith("+")) return value.replace(/[^\d+]/g, "");
  return value;
}

export function firstNameOnly(value: string) {
  const clean = value.trim();
  if (!clean) return "there";
  return clean.split(/\s+/)[0] || "there";
}

export function formatDateTime(value: Date, timezone: string) {
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

export function formatTimeOnly(value: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone || "America/Los_Angeles",
    hour: "numeric",
    minute: "2-digit",
  }).formatToParts(value);

  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${get("hour")}:${get("minute")} ${get("dayPeriod")}`;
}

export function formatDateOnly(value: Date, timezone: string) {
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

type PetJoinValue = { name: string | null } | { name: string | null }[] | null;

// Pulls deduped pet names off an `appointment_pet_services` query joined
// to `pets(name)` -- shared shape between sms-action (one appointment)
// and the recalculate batch (many), so both render identical wording.
// The pets_id -> pets FK is many-to-one, so it's a single object at
// runtime, but supabase-js can't express that without generated types
// and infers an array here -- handling both keeps this correct either way
// without falling back to `any`.
export function extractPetNames(
  petServiceLines: { pets: PetJoinValue }[] | null
): string[] {
  return (petServiceLines ?? [])
    .map((line) => {
      const pet = Array.isArray(line.pets) ? line.pets[0] : line.pets;
      return cleanText(pet?.name ?? "");
    })
    .filter(Boolean)
    .filter((value, index, all) => all.indexOf(value) === index);
}

// e.g. "Luna's" or "Luna and Milo's" or "your" if there are no pets on
// this appointment.
export function petPossessiveFromNames(petNames: string[]) {
  return petNames.length === 0
    ? "your"
    : petNames.length === 1
    ? `${petNames[0]}'s`
    : `${petNames.slice(0, -1).join(", ")} and ${petNames[petNames.length - 1]}'s`;
}

export async function deletePendingAppointmentReminders({
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

export async function upsertAppointmentReminder({
  businessId,
  customerId,
  appointmentId,
  appointmentScheduledAt,
  customerName,
  businessName,
  petPossessive,
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
  petPossessive: string;
  toPhone: string;
  appointmentDateTime: Date;
  businessTimezone: string;
  arrivalWindowEnabled: boolean;
  arrivalWindowMinutes: number;
}): Promise<{ status: string; queuedCount: number }> {
  // A business can now enable more than one reminder timeframe at once
  // (e.g. 1 week before AND 24 hours before) — each enabled rule gets its
  // own row in sms_outbound_queue, with its own scheduled_for_utc and its
  // own dedupe_key, so every one fires independently.
  const { data: enabledRules } = await supabaseAdmin
    .from("business_sms_reminder_rules")
    .select("rule_type, offset_minutes, enabled, requires_confirmation")
    .eq("business_id", businessId)
    .eq("enabled", true)
    .order("offset_minutes", { ascending: false });

  // Always clear whatever was previously queued for this appointment first
  // — the current set of enabled rules is the source of truth, whether
  // that's zero, one, or several reminders.
  await deletePendingAppointmentReminders({ businessId, appointmentId });

  if (!enabledRules || enabledRules.length === 0) {
    return { status: "no_rule", queuedCount: 0 };
  }

  // Two variants of the same reminder: one that asks the client to reply
  // YES/NO, and a plain heads-up that doesn't. A business can enable
  // several reminders at once (1 week + 2 days, say) but only wants to
  // actually *ask* on the ones it picked in Settings -- and even then, the
  // queue processor swaps a confirm-variant row down to the plain one at
  // send time if the client already confirmed off an earlier reminder, so
  // nobody gets asked twice.
  let confirmMessage: string;
  let plainMessage: string;
  if (arrivalWindowEnabled && arrivalWindowMinutes > 0) {
    const endTime = new Date(appointmentDateTime.getTime() + arrivalWindowMinutes * 60 * 1000);
    const date = formatDateOnly(appointmentDateTime, businessTimezone);
    const start = formatTimeOnly(appointmentDateTime, businessTimezone);
    const end = formatTimeOnly(endTime, businessTimezone);
    confirmMessage =
      `Hi ${customerName}, this is ${businessName}. ` +
      `${petPossessive} appt: ${date}, arrival ${start}-${end}. ` +
      `Reply YES to confirm or NO to cancel.`;
    plainMessage =
      `Hi ${customerName}, this is ${businessName}. ` +
      `Just a reminder: ${petPossessive} appt is ${date}, arrival ${start}-${end}.`;
  } else {
    const appointmentDate = formatDateTime(appointmentDateTime, businessTimezone);
    confirmMessage =
      `Hi ${customerName}, this is ${businessName}. ` +
      `${petPossessive} grooming appt is ${appointmentDate}. ` +
      `Reply YES to confirm or NO to cancel.`;
    plainMessage =
      `Hi ${customerName}, this is ${businessName}. ` +
      `Just a reminder: ${petPossessive} grooming appt is ${appointmentDate}.`;
  }
  confirmMessage = normalizeSmsText(confirmMessage);
  plainMessage = normalizeSmsText(plainMessage);

  const nowIso = new Date().toISOString();
  let queuedCount = 0;

  for (const rule of enabledRules) {
    const scheduledFor = new Date(
      new Date(appointmentScheduledAt).getTime() -
        Number(rule.offset_minutes ?? 0) * 60 * 1000
    );

    // Skip only this rule if its fire time has already passed (e.g. a
    // "1 week before" reminder for an appointment booked 3 days out) —
    // other enabled rules that are still upcoming still get queued.
    if (scheduledFor.getTime() <= Date.now()) continue;

    const asksConfirmation = rule.requires_confirmation !== false;

    const { error: queueError } = await supabaseAdmin
      .from("sms_outbound_queue")
      .upsert(
        {
          business_id: businessId,
          customer_id: customerId,
          appointment_id: appointmentId,
          message_type: "appointment_reminder",
          rule_type: rule.rule_type,
          to_phone: toPhone,
          body_rendered: asksConfirmation ? confirmMessage : plainMessage,
          // Only a confirm-asking rule needs a plain fallback on hand for
          // the queue processor to swap to -- a rule that never asks has
          // nothing to fall back from.
          body_rendered_plain: asksConfirmation ? plainMessage : null,
          scheduled_for_utc: scheduledFor.toISOString(),
          status: "pending",
          dedupe_key: `${appointmentId}:${rule.rule_type}`,
          attempt_count: 0,
          updated_at: nowIso,
        },
        { onConflict: "dedupe_key" }
      );

    if (queueError) {
      throw new Error(
        `Unable to queue ${rule.rule_type} reminder: ${queueError.message}`
      );
    }

    queuedCount++;
  }

  if (queuedCount === 0) {
    return { status: "past_due_removed", queuedCount: 0 };
  }

  return { status: "refreshed", queuedCount };
}
