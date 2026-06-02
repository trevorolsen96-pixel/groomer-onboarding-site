import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

// In-memory OTP store: email -> { otp, exp }
const otpStore = new Map<string, { otp: string; exp: number }>();

// Rate limit store: ip -> { count, windowStart }
const rateLimitStore = new Map<string, { count: number; windowStart: number }>();

const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(ip);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitStore.set(ip, { count: 1, windowStart: now });
    return false;
  }

  if (entry.count >= RATE_LIMIT_MAX) return true;

  entry.count++;
  return false;
}

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(req: Request) {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

    if (isRateLimited(ip)) {
      // Return generic 200 so we don't reveal rate limiting
      return NextResponse.json({ ok: true });
    }

    const { email } = await req.json();
    const adminEmail = process.env.ADMIN_EMAIL;

    // Always return 200 — don't reveal if email is wrong
    if (!adminEmail || typeof email !== "string" || email.trim().toLowerCase() !== adminEmail.toLowerCase()) {
      return NextResponse.json({ ok: true });
    }

    const otp = generateOtp();
    otpStore.set(adminEmail.toLowerCase(), {
      otp,
      exp: Date.now() + OTP_EXPIRY_MS,
    });

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

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Admin send-otp error:", err);
    return NextResponse.json({ error: "Failed to send code." }, { status: 500 });
  }
}

// Export store for use in verify-otp
export { otpStore };
