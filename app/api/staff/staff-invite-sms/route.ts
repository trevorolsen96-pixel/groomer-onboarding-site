import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import { supabaseAdmin } from "@/lib/supabase-admin";

type StaffInviteSmsPayload = {
  phone?: string;
  staffName?: string;
  link?: string;
};

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization") ?? "";
    const accessToken = authHeader.replace("Bearer ", "").trim();

    if (!accessToken) {
      return NextResponse.json(
        { error: "Missing authorization token." },
        { status: 401 },
      );
    }

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(accessToken);

    if (userError || !user) {
      return NextResponse.json(
        { error: "Invalid authorization token." },
        { status: 401 },
      );
    }

    const body = (await req.json()) as StaffInviteSmsPayload;

    const phone = (body.phone ?? "").trim();
    const staffName = (body.staffName ?? "there").trim() || "there";
    const link = (body.link ?? "").trim();

    if (!phone) {
      return NextResponse.json(
        { error: "Phone number is required." },
        { status: 400 },
      );
    }

    if (!link) {
      return NextResponse.json(
        { error: "Invite link is required." },
        { status: 400 },
      );
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
      return NextResponse.json(
        { error: "Twilio is not configured." },
        { status: 500 },
      );
    }

    const client = twilio(accountSid, authToken);

    await client.messages.create({
      to: phone,
      from: fromNumber,
      body: `Hi ${staffName}, you have been invited to join Wagzly. Create your staff account here: ${link}`,
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("Send staff invite SMS error:", error);

    return NextResponse.json(
      { error: "Failed to send staff invite text message." },
      { status: 500 },
    );
  }
}