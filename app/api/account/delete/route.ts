import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase-admin";
import { sendAccountDeletionNotification } from "../../../../lib/email";

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();

    if (!token) {
      return NextResponse.json({ error: "Missing authorization." }, { status: 401 });
    }

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !userData.user) {
      return NextResponse.json({ error: "Invalid or expired session." }, { status: 401 });
    }

    const userId = userData.user.id;

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("business_id, role, full_name")
      .eq("id", userId)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found." }, { status: 404 });
    }

    if (profile.role !== "admin") {
      return NextResponse.json(
        { error: "Only an account admin can delete this business account." },
        { status: 403 }
      );
    }

    const businessId = profile.business_id as string | null;

    if (!businessId) {
      return NextResponse.json(
        { error: "No business is associated with this account." },
        { status: 400 }
      );
    }

    const { data: business } = await supabaseAdmin
      .from("businesses")
      .select("name")
      .eq("id", businessId)
      .maybeSingle();

    // Collect every auth user tied to this business before deleting rows.
    const authUserIds = new Set<string>();

    const { data: businessProfiles } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("business_id", businessId);
    (businessProfiles ?? []).forEach((p) => authUserIds.add(p.id as string));

    const { data: workerRows } = await supabaseAdmin
      .from("workers")
      .select("profile_id")
      .eq("business_id", businessId);
    (workerRows ?? [])
      .map((w) => w.profile_id as string | null)
      .filter((id): id is string => Boolean(id))
      .forEach((id) => authUserIds.add(id));

    // ---------- Delete data, deepest-dependents first ----------

    const idsFrom = async (table: string) => {
      const { data } = await supabaseAdmin
        .from(table)
        .select("id")
        .eq("business_id", businessId);
      return (data ?? []).map((row) => row.id as string);
    };

    const deleteWhereIn = async (table: string, column: string, ids: string[]) => {
      if (!ids.length) return;
      const { error } = await supabaseAdmin.from(table).delete().in(column, ids);
      if (error) {
        console.error(`[delete-account] failed deleting from ${table}:`, error.message);
      }
    };

    const deleteByBusiness = async (table: string) => {
      const { error } = await supabaseAdmin.from(table).delete().eq("business_id", businessId);
      if (error) {
        console.error(`[delete-account] failed deleting from ${table}:`, error.message);
      }
    };

    const appointmentIds = await idsFrom("appointments");
    const conversationIds = await idsFrom("message_conversations");
    const customerIds = await idsFrom("customers");
    const petIds = await idsFrom("pets");

    await deleteWhereIn("appointment_pet_services", "appointment_id", appointmentIds);
    await deleteWhereIn("message_items", "conversation_id", conversationIds);
    await deleteWhereIn("intake_agreement_acceptances", "customer_id", customerIds);
    await deleteWhereIn("onboarding_question_responses", "pet_id", petIds);

    // Tables that reference pets/appointments/customers but also carry business_id
    const directTables = [
      "pet_documents",
      "pet_notes",
      "pet_photos",
      "appointment_payments",
      "appointments",
      "staff_invites",
      "workers",
      "pets",
      "message_items",
      "message_conversations",
      "mass_messages",
      "booking_requests",
      "onboarding_question_responses",
      "onboarding_requests",
      "onboarding_questions",
      "intake_agreement_acceptances",
      "intake_agreements",
      "customers",
      "services",
      "service_groups",
      "vehicles",
      "pet_flags",
      "business_pet_record_types",
      "business_expenses",
      "business_holidays",
      "business_hours",
      "business_payment_methods",
      "business_payment_settings",
      "business_sms_reminder_rules",
      "business_sms_setup",
      "business_settings",
      "user_push_tokens",
    ];

    for (const table of directTables) {
      await deleteByBusiness(table);
    }

    // Profiles (staff + owner) and the business itself
    await deleteByBusiness("profiles");

    const { error: businessDeleteError } = await supabaseAdmin
      .from("businesses")
      .delete()
      .eq("id", businessId);

    if (businessDeleteError) {
      console.error("[delete-account] failed deleting business row:", businessDeleteError.message);
    }

    // Finally, remove every auth user tied to this business.
    for (const id of authUserIds) {
      const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
      if (error) {
        console.error(`[delete-account] failed deleting auth user ${id}:`, error.message);
      }
    }

    sendAccountDeletionNotification({
      businessName: (business?.name as string | null) ?? "Unknown business",
      businessId,
      email: userData.user.email ?? "unknown",
      fullName: (profile.full_name as string | null) ?? "",
      deletedUserCount: authUserIds.size,
    }).catch((err) => console.error("[delete-account] notification email failed:", err));

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[delete-account] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to delete account." },
      { status: 500 }
    );
  }
}
