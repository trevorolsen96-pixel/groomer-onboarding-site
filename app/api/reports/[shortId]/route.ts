import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase-admin";

const BUCKET = "report-card-photos";
const SIGNED_URL_TTL_SECONDS = 5 * 60;

// Public, unauthenticated -- this is what the texted link resolves to.
// Service role is required to read across RLS (there's no logged-in user
// on the client's end) and to mint signed URLs for the private photo
// bucket, same two-tier pattern as app/p/[id]/route.ts.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ shortId: string }> }
) {
  try {
    const { shortId } = await params;
    const cleanShortId = (shortId ?? "").trim();

    if (!cleanShortId) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const { data: reportCard } = await supabaseAdmin
      .from("pet_report_cards")
      .select(
        "id, business_id, pet_id, theme, headline, tag_ids, note, before_photo_path, after_photo_path, status, sent_at, expires_at"
      )
      .eq("short_id", cleanShortId)
      .maybeSingle();

    if (!reportCard || reportCard.status !== "sent") {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    if (reportCard.expires_at && new Date(reportCard.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: "expired" }, { status: 410 });
    }

    const [{ data: pet }, { data: business }] = await Promise.all([
      supabaseAdmin
        .from("pets")
        .select("name, breed, image_url")
        .eq("id", reportCard.pet_id)
        .maybeSingle(),
      supabaseAdmin
        .from("business_settings")
        .select("business_name, logo_url")
        .eq("business_id", reportCard.business_id)
        .maybeSingle(),
    ]);

    // Fetched separately (not part of the Promise.all above) to avoid
    // mixing a conditional Supabase query builder with a plain
    // Promise.resolve() fallback in the same array -- keeps the types
    // simple and easy to verify without a local TypeScript compiler.
    let tags: { id: string; label: string; emoji: string | null }[] = [];
    const tagIds = (reportCard.tag_ids ?? []) as string[];

    if (tagIds.length > 0) {
      const { data: tagRows } = await supabaseAdmin
        .from("pet_report_tags")
        .select("id, label, emoji")
        .in("id", tagIds);
      tags = tagRows ?? [];
    }

    const signedUrl = async (path: string | null) => {
      if (!path) return null;
      const { data } = await supabaseAdmin.storage
        .from(BUCKET)
        .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
      return data?.signedUrl ?? null;
    };

    const [beforePhotoUrl, afterPhotoUrl] = await Promise.all([
      signedUrl(reportCard.before_photo_path),
      signedUrl(reportCard.after_photo_path),
    ]);

    // Preserve the order the groomer picked, not whatever order came back
    // from the `in` query.
    const orderedTags = (reportCard.tag_ids ?? [])
      .map((id: string) => (tags ?? []).find((t) => t.id === id))
      .filter(Boolean);

    return NextResponse.json({
      pet_name: pet?.name ?? "Your pet",
      pet_breed: pet?.breed ?? null,
      pet_image_url: pet?.image_url ?? null,
      business_name: business?.business_name ?? "Your groomer",
      business_logo_url: business?.logo_url ?? null,
      theme: reportCard.theme ?? "rose_petal",
      headline: reportCard.headline ?? null,
      note: reportCard.note ?? null,
      tags: orderedTags,
      before_photo_url: beforePhotoUrl,
      after_photo_url: afterPhotoUrl,
      sent_at: reportCard.sent_at,
      expires_at: reportCard.expires_at,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to load report.",
      },
      { status: 500 }
    );
  }
}
