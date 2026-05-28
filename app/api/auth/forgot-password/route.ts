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

    // Always return ok — never reveal whether the email exists.
    // Generate link only if the user actually exists.
    const { data: userList } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = userList?.users.find(
      (u) => u.email?.toLowerCase() === email
    );

    if (existingUser) {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://wagzly.com";

      const { data: linkData, error: linkError } =
        await supabaseAdmin.auth.admin.generateLink({
          type: "recovery",
          email,
          options: {
            redirectTo: `${siteUrl}/create-account/set-password`,
          },
        });

      if (!linkError && linkData?.properties?.action_link) {
        try {
          await sendPasswordResetEmail({
            to: email,
            name: existingUser.user_metadata?.full_name ?? email,
            resetUrl: linkData.properties.action_link,
          });
        } catch (emailError) {
          console.error("Failed to send password reset email", {
            error: emailError instanceof Error ? emailError.message : emailError,
            email,
          });
        }
      }
    }

    // Always return success so we don't leak whether the account exists.
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to send reset email.",
      },
      { status: 400 }
    );
  }
}
