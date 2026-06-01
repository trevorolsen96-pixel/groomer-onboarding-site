import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase-admin";

function normalizePhone(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return digits.length >= 7 ? `+1${digits}` : null;
}

export type MoeGoRow = {
  firstName: string;
  lastName: string;
  email: string | null;
  primaryPhone: string | null;
  additionalPhone: string | null;
  address: string;
  notes: string | null;
  status: string;
  pets: { name: string; breed: string | null }[];
  createDate: string | null;
};

export type ImportResult = {
  imported: { wagzlyId: string; name: string; petCount: number }[];
  duplicates: { wagzlyId: string; name: string; phone: string; petCount: number }[];
  skipped: { name: string; reason: string }[];
};

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) {
      return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    }

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData.user) {
      return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("business_id, role")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (profileError || !profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Not authorized." }, { status: 403 });
    }

    const businessId: string = profile.business_id;
    const body = await request.json();
    const rows: MoeGoRow[] = body.rows;

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "No rows provided." }, { status: 400 });
    }

    const result: ImportResult = {
      imported: [],
      duplicates: [],
      skipped: [],
    };

    for (const row of rows) {
      const fullName = [row.firstName, row.lastName].filter(Boolean).join(" ").trim();
      if (!fullName) {
        result.skipped.push({ name: "(no name)", reason: "Missing first and last name" });
        continue;
      }

      const normalizedPhone = normalizePhone(row.primaryPhone);

      // Duplicate check by phone number
      let existingCustomerId: string | null = null;
      if (normalizedPhone) {
        const { data: existing } = await supabaseAdmin
          .from("customers")
          .select("id")
          .eq("business_id", businessId)
          .eq("phone", normalizedPhone)
          .maybeSingle();

        if (existing) {
          existingCustomerId = existing.id;
        }
      }

      if (existingCustomerId) {
        result.duplicates.push({
          wagzlyId: existingCustomerId,
          name: fullName,
          phone: normalizedPhone!,
          petCount: row.pets.length,
        });
        continue;
      }

      // Insert customer
      const customerId = crypto.randomUUID();
      const now = new Date().toISOString();

      const { error: customerError } = await supabaseAdmin
        .from("customers")
        .insert({
          id: customerId,
          business_id: businessId,
          name: fullName,
          phone: normalizedPhone ?? null,
          email: row.email || null,
          address: row.address || "",
          notes: row.notes || null,
          secondary_contact_phone: normalizePhone(row.additionalPhone),
          is_active: row.status?.toLowerCase() === "active",
          deleted: false,
          created_at: row.createDate ? new Date(row.createDate).toISOString() : now,
        });

      if (customerError) {
        result.skipped.push({ name: fullName, reason: customerError.message });
        continue;
      }

      // Insert pets
      let petCount = 0;
      for (const pet of row.pets) {
        if (!pet.name) continue;
        const { error: petError } = await supabaseAdmin
          .from("pets")
          .insert({
            id: crypto.randomUUID(),
            business_id: businessId,
            customer_id: customerId,
            name: pet.name,
            breed: pet.breed || null,
            is_active: true,
            flags: [],
            care_reminder_enabled: false,
            care_reminder_interval_weeks: 4,
            care_reminder_include_siblings: false,
            created_at: now,
          });

        if (!petError) petCount++;
      }

      result.imported.push({ wagzlyId: customerId, name: fullName, petCount });
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Import failed." },
      { status: 500 }
    );
  }
}
