import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY ?? "";

// Calculates total miles for a vehicle on a specific date using
// non-cancelled appointments via Google Directions API.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace("Bearer ", "").trim();

  if (!token) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData.user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const vehicleId = req.nextUrl.searchParams.get("vehicleId")?.trim();
  const date = req.nextUrl.searchParams.get("date")?.trim(); // YYYY-MM-DD
  const businessId = req.nextUrl.searchParams.get("businessId")?.trim();

  if (!vehicleId || !date || !businessId) {
    return NextResponse.json(
      { error: "vehicleId, date, and businessId are required." },
      { status: 400 }
    );
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("business_id")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (profileError || profile?.business_id !== businessId) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  // Fetch non-cancelled appointments for this vehicle on this date
  const startUtc = `${date}T00:00:00.000Z`;
  const endUtc = `${date}T23:59:59.999Z`;

  const { data: appointments, error } = await supabaseAdmin
    .from("appointments")
    .select("id, scheduled_at, address_snapshot, latitude, longitude")
    .eq("business_id", businessId)
    .eq("vehicle_id", vehicleId)
    .neq("status", "cancelled")
    .gte("scheduled_at", startUtc)
    .lte("scheduled_at", endUtc)
    .order("scheduled_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!appointments || appointments.length === 0) {
    return NextResponse.json({ miles: 0, calculated: true });
  }

  // Build waypoints from lat/lng or address
  type Stop = { lat: number; lng: number };
  const stops: Stop[] = [];

  for (const appt of appointments) {
    if (appt.latitude && appt.longitude) {
      stops.push({ lat: appt.latitude, lng: appt.longitude });
    } else if (appt.address_snapshot) {
      try {
        const geoRes = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(appt.address_snapshot)}&key=${GOOGLE_API_KEY}`
        );
        const geoData = await geoRes.json();
        const loc = geoData?.results?.[0]?.geometry?.location;
        if (loc) stops.push({ lat: loc.lat, lng: loc.lng });
      } catch {
        // skip unresolvable address
      }
    }
  }

  if (stops.length < 2) {
    return NextResponse.json({ miles: 0, calculated: true });
  }

  // Call Google Directions
  try {
    const origin = `${stops[0].lat},${stops[0].lng}`;
    const destination = `${stops[stops.length - 1].lat},${stops[stops.length - 1].lng}`;
    const waypoints =
      stops.length > 2
        ? stops
            .slice(1, -1)
            .map((s) => `${s.lat},${s.lng}`)
            .join("|")
        : null;

    const url = new URL("https://maps.googleapis.com/maps/api/directions/json");
    url.searchParams.set("origin", origin);
    url.searchParams.set("destination", destination);
    if (waypoints) url.searchParams.set("waypoints", waypoints);
    url.searchParams.set("mode", "driving");
    url.searchParams.set("key", GOOGLE_API_KEY);

    const dirRes = await fetch(url.toString());
    const dirData = await dirRes.json();

    if (dirData.status !== "OK") {
      return NextResponse.json({ miles: 0, calculated: true });
    }

    const legs = dirData.routes?.[0]?.legs ?? [];
    const totalMeters = legs.reduce(
      (sum: number, leg: { distance?: { value?: number } }) =>
        sum + (leg.distance?.value ?? 0),
      0
    );
    const totalMiles = Math.round((totalMeters / 1609.344) * 10) / 10;

    return NextResponse.json({ miles: totalMiles, calculated: true });
  } catch {
    return NextResponse.json({ miles: 0, calculated: true });
  }
}
