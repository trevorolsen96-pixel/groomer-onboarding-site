import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import crypto from "crypto";

const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function signOtpCookie(otp: string, exp: number): string {
  const secret = process.env.ADMIN_SESSION_SECRET ?? "";
  const data = Buffer.from(JSON.stringify({ otp, exp })).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    const adminEmail = process.env.ADMIN_EMAIL;

    // Always return 200 — don't reveal if email is wrong
    if (
      !adminEmail ||
      typeof email !== "string" ||
      email.trim().toLowerCase() !== adminEmail.toLowerCase()
    ) {
      return NextResponse.json({ ok: true });
    }

    const otp = generateOtp();
    const exp = Date.now() + OTP_EXPIRY_MS;
    const otpCookie = signOtpCookie(otp, exp);

    const appPassword = process.env.GMAIL_APP_PASSWORD;
    if (!appPassword) throw new Error("Missing GMAIL_APP_PASSWORD");

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: { user: "support@wagzly.com", pass: appPassword },
    });

    await transporter.sendMail({
      from: '"Wagzly Admin" <support@wagzly.com>',
      to: adminEmail,
      subject: `Admin login code: ${otp}`,
      text: `Your Wagzly admin login code is: ${otp}\n\nExpires in 5 minutes. Do not share this code.`,
      html: `<div style="font-family:monospace;background:#0f1117;color:#e6edf3;padding:32px;border-radius:12px;max-width:400px;margin:40px auto;">
        <div style="font-size:18px;font-weight:700;color:#3fb950;margin-bottom:24px;">WAGZLY ADMIN</div>
        <div style="font-size:14px;color:#8b949e;margin-bottom:16px;">Your login code:</div>
        <div style="font-size:40px;font-weight:800;letter-spacing:0.2em;color:#e6edf3;background:#161b22;padding:20px;border-radius:8px;border:1px solid #30363d;text-align:center;">${otp}</div>
        <div style="font-size:12px;color:#8b949e;margin-top:16px;">Expires in 5 minutes. Do not share this code.</div>
      </div>`,
    });

    const response = NextResponse.json({ ok: true });
    response.cookies.set("admin_otp_token", otpCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 5, // 5 minutes
      path: "/",
    });

    return response;
  } catch (err) {
    console.error("Admin send-otp error:", err);
    return NextResponse.json({ error: "Failed to send code." }, { status: 500 });
  }
}
