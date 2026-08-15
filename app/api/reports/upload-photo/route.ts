import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase-admin";

const BUCKET = "report-card-photos";

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function extensionForFileName(fileName: string) {
  const match = /\.([a-zA-Z0-9]+)$/.exec(fileName);
  const ext = (match?.[1] ?? "jpg").toLowerCase();
  return ext === "jpeg" ? "jpg" : ext;
}

function contentTypeForExtension(ext: string) {
  switch (ext) {
    case "png":
      return "image/png";
    case "heic":
      return "image/heic";
    case "webp":
      return "image/webp";
    default:
      return "image/jpeg";
  }
}

// Uploads a before/after photo for a report card. Goes through the
// service role (like message attachments) rather than a direct-from-app
// storage write, so the bucket can stay private with no storage.objects
// RLS policy to get right -- this route is the only thing that ever
// touches it.
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();

    if (!token) {
      return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    }

    const { data: userData, error: userError } =
      await supabaseAdmin.auth.getUser(token);

    if (userError || !userData.user) {
      return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    }

    const body = await request.json();

    const businessId = cleanText(body.businessId);
    const reportCardId = cleanText(body.reportCardId);
    const slot = cleanText(body.slot); // 'before' | 'after'
    const imageBase64 = cleanText(body.imageBase64);
    const imageFileName = cleanText(body.imageFileName) || "photo.jpg";

    if (!businessId || !reportCardId || !imageBase64) {
      return NextResponse.json(
        { error: "Missing photo upload details." },
        { status: 400 }
      );
    }

    if (slot !== "before" && slot !== "after") {
      return NextResponse.json(
        { error: "slot must be 'before' or 'after'." },
        { status: 400 }
      );
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("business_id")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (!profile || profile.business_id !== businessId) {
      return NextResponse.json({ error: "Not authorized." }, { status: 403 });
    }

    const { data: reportCard } = await supabaseAdmin
      .from("pet_report_cards")
      .select("id")
      .eq("id", reportCardId)
      .eq("business_id", businessId)
      .maybeSingle();

    if (!reportCard) {
      return NextResponse.json(
        { error: "Report card not found." },
        { status: 404 }
      );
    }

    const ext = extensionForFileName(imageFileName);
    const path = `${businessId}/${reportCardId}/${slot}-${Date.now()}.${ext}`;
    const bytes = Buffer.from(imageBase64, "base64");

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, bytes, {
        contentType: contentTypeForExtension(ext),
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Unable to upload photo: ${uploadError.message}`);
    }

    const column = slot === "before" ? "before_photo_path" : "after_photo_path";

    await supabaseAdmin
      .from("pet_report_cards")
      .update({ [column]: path, updated_at: new Date().toISOString() })
      .eq("id", reportCardId);

    return NextResponse.json({ ok: true, path });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to upload photo.",
      },
      { status: 400 }
    );
  }
}
