import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabase-admin";
import { sendPasswordSetupEmail } from "../../../lib/email";

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const sessionId = cleanText(body.sessionId);

    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing session ID." },
        { status: 400 }
      );
    }

    const { data: signup, error: signupError } = await supabaseAdmin
      .from("pending_business_signups")
      .select("email, full_name, status")
      .eq("stripe_checkout_session_id", sessionId)
      .maybeSingle();

    if (signupError || !signup) {
      return NextResponse.json(
        { error: "Signup not found." },
        { status: 404 }
      );
    }

    if (signup.status !== "completed") {
      return NextResponse.json(
        { error: "Account setup is still in progress. Please wait a moment and try again." },
        { status: 400 }
      );
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://wagzly.com";

    const { data: linkData, error: linkError } =
      await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email: signup.email as string,
        options: {
          redirectTo: `${siteUrl}/create-account/set-password`,
        },
      });

    if (linkError || !linkData?.properties?.action_link) {
      return NextResponse.json(
        { error: "Unable to generate a new setup link. Please try again." },
        { status: 500 }
      );
    }

    await sendPasswordSetupEmail({
      to: signup.email as string,
      name: signup.full_name as string,
      setupUrl: linkData.properties.action_link,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Something went wrong. Please try again.",
      },
      { status: 500 }
    );
  }
}
