import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// GET /api/book/slots?slug=...&date=YYYY-MM-DD&serviceId=...
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const slug = searchParams.get("slug");
  const date = searchParams.get("date"); // YYYY-MM-DD
  const serviceId = searchParams.get("serviceId");

  if (!slug || !date || !serviceId) {
    return NextResponse.json({ error: "Missing params." }, { status: 400 });
  }

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Invalid date format." }, { status: 400 });
  }

  // Look up business
  const { data: settings } = await supabaseAdmin
    .from("business_settings")
    .select("business_id, sms_timezone")
    .eq("booking_slug", slug)
    .maybeSingle();

  if (!settings) {
    return NextResponse.json({ error: "Groomer not found." }, { status: 404 });
  }

  const businessId = settings.business_id;
  const timezone = settings.sms_timezone ?? "America/Los_Angeles";

  // Day of week: JS 0=Sun…6=Sat → Flutter/DB convention 1=Mon…7=Sun
  const jsDay = new Date(date + "T12:00:00").getDay();
  const flutterDay = jsDay === 0 ? 7 : jsDay;

  const [
    { data: serviceRow },
    { data: hourRow },
    { data: holidays },
    { data: timeBlocks },
    { data: appointments },
  ] = await Promise.all([
    supabaseAdmin
      .from("services")
      .select("duration_minutes")
      .eq("id", serviceId)
      .eq("business_id", businessId)
      .maybeSingle(),
    supabaseAdmin
      .from("business_hours")
      .select("is_open, start_time, end_time")
      .eq("business_id", businessId)
      .eq("day_of_week", flutterDay)
      .maybeSingle(),
    supabaseAdmin
      .from("business_holidays")
      .select("holiday_date, is_open")
      .eq("business_id", businessId)
      .eq("holiday_date", date)
      .eq("is_open", false),
    supabaseAdmin
      .from("business_time_blocks")
      .select("all_day, start_time, end_time, start_date, end_date, is_recurring, recurrence_days")
      .eq("business_id", businessId),
    // Fetch appointments that overlap with the selected date in local time.
    // We fetch a 48-hour window around the date to safely cover any timezone offset.
    supabaseAdmin
      .from("appointments")
      .select("scheduled_at, end_at, total_duration_minutes")
      .eq("business_id", businessId)
      .neq("status", "cancelled")
      .gte("scheduled_at", date + "T00:00:00+00:00")
      .lte("scheduled_at", date + "T23:59:59+00:00"),
  ]);

  // Day is a closed holiday
  if ((holidays ?? []).length > 0) {
    return NextResponse.json({ slots: [] });
  }

  // Business is closed that day
  if (!hourRow?.is_open || !hourRow.start_time || !hourRow.end_time) {
    return NextResponse.json({ slots: [] });
  }

  const serviceDuration = serviceRow?.duration_minutes ?? 60;
  const openMinutes = timeToMinutes(hourRow.start_time);
  const closeMinutes = timeToMinutes(hourRow.end_time);

  // Build blocked ranges from time blocks active on this date
  const blockedRanges: { start: number; end: number }[] = [];
  for (const block of timeBlocks ?? []) {
    if (!appliesToDate(block, date, flutterDay)) continue;
    if (block.all_day) {
      return NextResponse.json({ slots: [] }); // whole day blocked
    }
    if (block.start_time && block.end_time) {
      blockedRanges.push({
        start: timeToMinutes(block.start_time),
        end: timeToMinutes(block.end_time),
      });
    }
  }

  // Build booked ranges from existing appointments (converted to local time)
  const bookedRanges: { start: number; end: number }[] = [];
  for (const appt of appointments ?? []) {
    if (!appt.scheduled_at) continue;
    const startLocal = utcToLocalMinutes(appt.scheduled_at, timezone, date);
    if (startLocal === null) continue;
    const durationMins = appt.total_duration_minutes ?? 60;
    const endLocal = startLocal + durationMins;
    bookedRanges.push({ start: startLocal, end: endLocal });
  }

  // Generate 30-min slots, keeping only those where:
  // 1. slot start >= open time
  // 2. slot start + serviceDuration <= close time
  // 3. slot doesn't overlap any blocked or booked range
  const slots: string[] = [];
  for (let m = openMinutes; m + serviceDuration <= closeMinutes; m += 30) {
    const slotEnd = m + serviceDuration;
    const blocked = [...blockedRanges, ...bookedRanges].some(
      (r) => m < r.end && slotEnd > r.start
    );
    if (!blocked) slots.push(minutesToTime(m));
  }

  return NextResponse.json({ slots });
}

// ── Helpers ──────────────────────────────────────────────────────────

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m ?? 0);
}

function minutesToTime(m: number): string {
  const h = Math.floor(m / 60).toString().padStart(2, "0");
  const min = (m % 60).toString().padStart(2, "0");
  return `${h}:${min}`;
}

function appliesToDate(
  block: {
    start_date: string;
    end_date: string | null;
    is_recurring: boolean;
    recurrence_days: number[];
  },
  date: string,
  flutterDay: number
): boolean {
  if (block.is_recurring) {
    if (date < block.start_date) return false;
    if (block.end_date && date > block.end_date) return false;
    return block.recurrence_days.includes(flutterDay);
  } else {
    const end = block.end_date ?? block.start_date;
    return date >= block.start_date && date <= end;
  }
}

// Convert a UTC ISO timestamp to minutes-since-midnight in the business timezone,
// but only if the local date matches the requested date. Returns null otherwise.
function utcToLocalMinutes(
  utcIso: string,
  timezone: string,
  date: string
): number | null {
  try {
    const d = new Date(utcIso);
    const localStr = d.toLocaleString("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    // en-CA gives "YYYY-MM-DD, HH:MM"
    const [localDate, localTime] = localStr.split(", ");
    if (localDate !== date) return null;
    return timeToMinutes(localTime);
  } catch {
    return null;
  }
}
