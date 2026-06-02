import { NextResponse } from "next/server";
import crypto from "crypto";
import { signSession } from "../../../../lib/admin-auth";

function verifyOtpCookie(
  cookie: string | undefined,
  submittedOtp: string
): boolean {
  if (!cookie) return false;
  try {
    const secret = process.env.ADMIN_SESSION_SECRET ?? "";
    const [data, sig] = cookie.split(".");
    if (!data || !sig) return false;

    const expected = crypto
      .createHmac("sha256", secret)
      .update(data)
      .digest("base64url");

    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      return false;
    }

    const payload = JSON.parse(
      Buffer.from(data, "base64url").toString("utf8")
    ) as { otp: string; exp: number };

    if (Date.now() > payload.exp) return false;
    if (payload.otp !== submittedOtp.trim()) return false;

    return true;
  } catch {
    return false;
  }
}

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

    // Read OTP cookie from request
    const cookieHeader = req.headers.get("cookie") ?? "";
    const otpCookie = cookieHeader
      .split(";")
      .find((c) => c.trim().startsWith("admin_otp_token="))
      ?.split("=")
      .slice(1)
      .join("=")
      .trim();

    if (!verifyOtpCookie(otpCookie, otp)) {
      return NextResponse.json({ error: "Invalid or expired code." }, { status: 401 });
    }

    const token = signSession({
      admin: true,
      exp: Date.now() + 24 * 60 * 60 * 1000,
    });

    const response = NextResponse.json({ ok: true });

    // Set admin session cookie
    response.cookies.set("admin_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 60 * 24,
      path: "/",
    });

    // Clear OTP cookie
    response.cookies.set("admin_otp_token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 0,
      path: "/",
    });

    return response;
  } catch (err) {
    console.error("Admin verify-otp error:", err);
    return NextResponse.json({ error: "Verification failed." }, { status: 500 });
  }
}
