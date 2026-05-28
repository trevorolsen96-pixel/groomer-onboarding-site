import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase-admin";
import { sendPasswordResetEmail } from "../../../../lib/email";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

    if (!email) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://wagzly.com";

    // generateLink throws if the user doesn't exist — catch that silently
    // so we never reveal whether an account is registered.
    const { data: linkData, error: linkError } =
      await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email,
        options: {
          redirectTo: `${siteUrl}/create-account/set-password`,
        },
      });

    if (linkError) {
      // Log unexpected errors but not "user not found" — that's expected
      const msg = linkError.message?.toLowerCase() ?? "";
      if (!msg.includes("not found") && !msg.includes("no user")) {
        console.error("forgot-password generateLink error", {
          error: linkError.message,
          email,
        });
      }
      // Either way, return ok — don't leak account existence
      return NextResponse.json({ ok: true });
    }

    if (linkData?.properties?.action_link) {
      // Fetch the user's name for the email greeting
      const { data: userList } = await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 1,
      });
      // getUserByEmail isn't available directly; use getUserById via the link properties
      // The action_link contains the token — just fall back to email as the name if needed
      let name = email;
      try {
        const { data: userData } = await supabaseAdmin.auth.admin.getUserById(
          linkData.user?.id ?? ""
        );
        name = userData?.user?.user_metadata?.full_name ?? email;
      } catch {
        // non-critical — greeting will just use the email address
      }

      try {
        await sendPasswordResetEmail({
          to: email,
          name,
          resetUrl: linkData.properties.action_link,
        });
      } catch (emailError) {
        console.error("Failed to send password reset email", {
          error: emailError instanceof Error ? emailError.message : emailError,
          email,
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("forgot-password unexpected error", {
      error: error instanceof Error ? error.message : error,
    });
    // Still return ok — don't expose internals
    return NextResponse.json({ ok: true });
  }
}
