import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

type SignupPayload = {
  email: string;
  password: string;
};

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function normalizeToken(token: string) {
  return token.trim();
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await context.params;
    const cleanToken = normalizeToken(token);

    const { data: inviteRow, error: inviteError } = await supabaseAdmin
      .from("staff_invites")
      .select("id, business_id, worker_id, email, phone, token, status, expires_at")
      .eq("token", cleanToken)
      .single();

    if (inviteError || !inviteRow) {
      return NextResponse.json(
        { error: "Staff invite link not found." },
        { status: 404 },
      );
    }

    if (inviteRow.status === "accepted") {
      return NextResponse.json(
        { error: "This staff invite has already been accepted." },
        { status: 410 },
      );
    }

    if (inviteRow.expires_at && new Date(inviteRow.expires_at) < new Date()) {
      return NextResponse.json(
        {
          error:
            "This staff invite has expired. Please ask the business owner to resend it.",
        },
        { status: 410 },
      );
    }

    const { data: workerRow, error: workerError } = await supabaseAdmin
      .from("workers")
      .select("id, display_name, email, phone, profile_id, is_admin, active")
      .eq("id", inviteRow.worker_id)
      .single();

    if (workerError || !workerRow) {
      return NextResponse.json(
        { error: "Staff member not found for this invite." },
        { status: 404 },
      );
    }

    if (workerRow.profile_id) {
      return NextResponse.json(
        { error: "This staff member already has an account." },
        { status: 410 },
      );
    }

    const { data: settingsRow } = await supabaseAdmin
      .from("business_settings")
      .select("business_name, logo_url")
      .eq("business_id", inviteRow.business_id)
      .single();

    return NextResponse.json({
      invite_id: inviteRow.id,
      business_id: inviteRow.business_id,
      business_name: settingsRow?.business_name ?? "Wagzly",
      logo_url: settingsRow?.logo_url ?? null,
      staff_name: workerRow.display_name,
      email: inviteRow.email ?? workerRow.email ?? "",
      phone: inviteRow.phone ?? workerRow.phone ?? "",
      status: inviteRow.status,
    });
  } catch (error) {
    console.error("GET staff invite error:", error);
    return NextResponse.json(
      { error: "Failed to load staff invite." },
      { status: 500 },
    );
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await context.params;
    const cleanToken = normalizeToken(token);
    const body = (await req.json()) as SignupPayload;

    const email = body.email?.trim().toLowerCase();
    const password = body.password;

    if (!email) return badRequest("Email is required.");

    if (!password || password.length < 8) {
      return badRequest("Password must be at least 8 characters.");
    }

    if (!/[A-Za-z]/.test(password)) {
      return badRequest("Password must include at least one letter.");
    }

    if (!/[0-9]/.test(password)) {
      return badRequest("Password must include at least one number.");
    }

    const { data: inviteRow, error: inviteError } = await supabaseAdmin
      .from("staff_invites")
      .select("id, business_id, worker_id, status, expires_at")
      .eq("token", cleanToken)
      .single();

    if (inviteError || !inviteRow) {
      return NextResponse.json(
        { error: "Staff invite link not found." },
        { status: 404 },
      );
    }

    if (inviteRow.status === "accepted") {
      return NextResponse.json(
        { error: "This staff invite has already been accepted." },
        { status: 410 },
      );
    }

    if (inviteRow.expires_at && new Date(inviteRow.expires_at) < new Date()) {
      return NextResponse.json(
        {
          error:
            "This staff invite has expired. Please ask the business owner to resend it.",
        },
        { status: 410 },
      );
    }

    const { data: workerRow, error: workerError } = await supabaseAdmin
      .from("workers")
      .select("id, business_id, display_name, profile_id, is_admin, active")
      .eq("id", inviteRow.worker_id)
      .single();

    if (workerError || !workerRow) {
      return NextResponse.json(
        { error: "Staff member not found for this invite." },
        { status: 404 },
      );
    }

    if (workerRow.profile_id) {
      return NextResponse.json(
        { error: "This staff member already has an account." },
        { status: 410 },
      );
    }

    const { data: authResult, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: workerRow.display_name,
          business_id: inviteRow.business_id,
          role: workerRow.is_admin ? "admin" : "worker",
        },
      });

    if (authError || !authResult.user) {
      console.error("Staff auth create error:", authError);
      return NextResponse.json(
        { error: authError?.message ?? "Failed to create staff account." },
        { status: 500 },
      );
    }

    const authUserId = authResult.user.id;

    const { error: profileError } = await supabaseAdmin.from("profiles").insert({
      id: authUserId,
      business_id: inviteRow.business_id,
      full_name: workerRow.display_name,
      role: workerRow.is_admin ? "admin" : "worker",
    });

    if (profileError) {
      console.error("Staff profile insert error:", profileError);

      await supabaseAdmin.auth.admin.deleteUser(authUserId);

      return NextResponse.json(
        { error: "Account created, but failed to create staff profile." },
        { status: 500 },
      );
    }

    const { error: workerUpdateError } = await supabaseAdmin
      .from("workers")
      .update({
        profile_id: authUserId,
        email,
        invite_status: "accepted",
        active: true,
      })
      .eq("id", inviteRow.worker_id);

    if (workerUpdateError) {
      console.error("Worker link error:", workerUpdateError);
      return NextResponse.json(
        { error: "Account created, but failed to link staff record." },
        { status: 500 },
      );
    }

    const { error: inviteUpdateError } = await supabaseAdmin
      .from("staff_invites")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
        email,
      })
      .eq("id", inviteRow.id);

    if (inviteUpdateError) {
      console.error("Invite accept update error:", inviteUpdateError);
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("POST staff invite error:", error);
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
}