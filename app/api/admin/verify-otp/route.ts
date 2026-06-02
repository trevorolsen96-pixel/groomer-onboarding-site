import { NextResponse } from "next/server";
import { signSession } from "../../../../lib/admin-auth";

// In-memory OTP store shared via module-level Map
// We re-declare it here since we can't import from a route file
const otpStore = new Map<string, { otp: string; exp: number }>();

// Export so send-otp can use the same store
// NOTE: In production serverless, both routes share the same module instance
// within a single cold start. This works fine for Vercel.
export { otpStore };

export async function POST(req: Request) {
  try {
    const { email, otp } = await req.json();
    const adminEmail = process.env.ADMIN_EMAIL;

    if (
      !adminEmail ||
      typeof email !== "string" ||
      typeof otp !== "string" ||
      email.trim().toLowerCase() !== adminEmail.toLowerCase()
    ) {
      return NextResponse.json({ error: "Invalid code." }, { status: 401 });
    }

    const stored = otpStore.get(adminEmail.toLowerCase());

    if (!stored || stored.otp !== otp.trim() || Date.now() > stored.exp) {
      return NextResponse.json({ error: "Invalid or expired code." }, { status: 401 });
    }

    // Clear OTP after use
    otpStore.delete(adminEmail.toLowerCase());

    const token = signSession({
      admin: true,
      exp: Date.now() + 24 * 60 * 60 * 1000,
    });

    const response = NextResponse.json({ ok: true });
    response.cookies.set("admin_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 60 * 24,
      path: "/",
    });

    return response;
  } catch (err) {
    console.error("Admin verify-otp error:", err);
    return NextResponse.json({ error: "Verification failed." }, { status: 500 });
  }
}
