import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const { data: settings } = await supabaseAdmin
    .from("business_settings")
    .select("business_id")
    .eq("booking_slug", slug)
    .maybeSingle();

  if (!settings) {
    return NextResponse.json({ error: "Groomer not found." }, { status: 404 });
  }

  const businessId = settings.business_id;

  const [{ data: hours }, { data: holidays }] = await Promise.all([
    supabaseAdmin
      .from("business_hours")
      .select("day_of_week, is_open, start_time, end_time")
      .eq("business_id", businessId),
    supabaseAdmin
      .from("business_holidays")
      .select("holiday_date, is_open")
      .eq("business_id", businessId)
      .eq("is_open", false),
  ]);

  return NextResponse.json({
    // dayOfWeek: 1=Mon...7=Sun (matches Flutter convention)
    hours: (hours ?? []).map((h) => ({
      dayOfWeek: h.day_of_week,
      isOpen: h.is_open,
      startTime: h.start_time,
      endTime: h.end_time,
    })),
    // Dates the groomer is closed
    closedDates: (holidays ?? []).map((h) => h.holiday_date as string),
  });
}
