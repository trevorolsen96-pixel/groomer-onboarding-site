import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error:
        "Business owner accounts must be created through Stripe checkout first.",
    },
    { status: 410 }
  );
}