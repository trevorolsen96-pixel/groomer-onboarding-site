import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabase-admin";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("session_id") ?? "";

  if (!sessionId) {
    return NextResponse.json({ error: "Missing session_id." }, { status: 400 });
  }

  const { data: signup, error } = await supabaseAdmin
    .from("pending_business_signups")
    .select("email, full_name, status")
    .eq("stripe_checkout_session_id", sessionId)
    .maybeSingle();

  if (error || !signup) {
    return NextResponse.json(
      { error: "Signup not found." },
      { status: 404 }
    );
  }

  const firstName = (signup.full_name ?? "").split(" ")[0] || "there";

  return NextResponse.json({
    email: signup.email as string,
    status: signup.status as string,
    firstName,
  });
}
