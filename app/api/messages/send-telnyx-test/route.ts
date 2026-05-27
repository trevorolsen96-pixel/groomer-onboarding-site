import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { to, text } = await req.json();

    const res = await fetch("https://api.telnyx.com/v2/messages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.TELNYX_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.TELNYX_TEST_FROM,
        to,
        text: text || "Hello from Wagzly + Telnyx",
      }),
    });

    const data = await res.json();

    return NextResponse.json({ ok: res.ok, status: res.status, data });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e.message || String(e) },
      { status: 500 }
    );
  }
}