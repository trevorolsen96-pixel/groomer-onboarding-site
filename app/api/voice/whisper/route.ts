import { NextResponse } from "next/server";

export async function POST() {
  const texml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Wagzly business call.</Say>
</Response>`;

  return new NextResponse(texml, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}
