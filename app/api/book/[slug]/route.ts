import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const { data: settings, error } = await supabaseAdmin
    .from("business_settings")
    .select("business_id, business_name, logo_url, booking_slug, online_booking_enabled, phone, website, facebook, instagram")
    .eq("booking_slug", slug)
    .maybeSingle();

  if (error || !settings) {
    return NextResponse.json({ error: "Groomer not found." }, { status: 404 });
  }

  if (!settings.online_booking_enabled) {
    return NextResponse.json({ error: "This groomer is not accepting online bookings." }, { status: 403 });
  }

  // Load their active services (category = 'service' only, no add-ons)
  const { data: services } = await supabaseAdmin
    .from("services")
    .select("id, name, description, duration_minutes, base_price")
    .eq("business_id", settings.business_id)
    .eq("is_active", true)
    .eq("category", "service")
    .order("sort_order");

  return NextResponse.json({
    businessId: settings.business_id,
    businessName: settings.business_name,
    logoUrl: settings.logo_url,
    bookingSlug: settings.booking_slug,
    phone: settings.phone ?? null,
    website: settings.website ?? null,
    facebook: settings.facebook ?? null,
    instagram: settings.instagram ?? null,
    services: services ?? [],
  });
}
