import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 3958.8; // miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function GET(req: NextRequest) {
  const zip = req.nextUrl.searchParams.get("zip")?.trim();
  const type = req.nextUrl.searchParams.get("type") ?? "mobile"; // "mobile" | "salon"

  if (!zip || !/^\d{5}$/.test(zip)) {
    return NextResponse.json({ error: "Valid 5-digit zip code required." }, { status: 400 });
  }

  // Geocode the zip via zippopotam.us (free, no key)
  let zipLat: number, zipLng: number;
  try {
    const geoRes = await fetch(`https://api.zippopotam.us/us/${zip}`);
    if (!geoRes.ok) {
      return NextResponse.json({ error: "Zip code not found." }, { status: 404 });
    }
    const geoData = await geoRes.json();
    zipLat = parseFloat(geoData.places[0].latitude);
    zipLng = parseFloat(geoData.places[0].longitude);
  } catch {
    return NextResponse.json({ error: "Could not look up that zip code." }, { status: 500 });
  }

  const isSalon = type === "salon";

  const query = supabaseAdmin
    .from("business_settings")
    .select("business_id, business_name, logo_url, booking_slug, home_lat, home_lng, service_radius_miles, address, business_mode")
    .eq("online_booking_enabled", true)
    .not("home_lat", "is", null)
    .not("home_lng", "is", null)
    .not("booking_slug", "is", null);

  if (isSalon) {
    query.eq("business_mode", "shop");
  } else {
    query.eq("business_mode", "mobile_grooming");
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: "Failed to load groomers." }, { status: 500 });
  }

  const SALON_RADIUS = 60;

  const withDistance = (data ?? [])
    .map((g) => ({
      ...g,
      distanceMiles: haversineDistance(zipLat, zipLng, g.home_lat, g.home_lng),
    }))
    .filter((g) => {
      if (isSalon) return g.distanceMiles <= SALON_RADIUS;
      return g.distanceMiles <= (g.service_radius_miles ?? 25);
    })
    .sort((a, b) => a.distanceMiles - b.distanceMiles);

  const results = withDistance.map((g) => ({
    businessId: g.business_id,
    businessName: g.business_name,
    logoUrl: g.logo_url,
    bookingSlug: g.booking_slug,
    address: g.address ?? null,
    distanceMiles: Math.round(g.distanceMiles * 10) / 10,
  }));

  return NextResponse.json({ results });
}
