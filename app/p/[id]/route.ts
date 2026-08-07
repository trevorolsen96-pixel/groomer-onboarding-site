import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabase-admin";

const ATTACHMENT_BUCKET = "message-attachments";
// Just needs to outlive the redirect + the browser fetching the image —
// this is separate from the 72-hour life of the wagzly.com/p/<id> link
// itself, which is enforced by the expires_at check below.
const REDIRECT_SIGNED_URL_TTL_SECONDS = 5 * 60;

const EXPIRED_HTML = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Photo link expired</title>
    <style>
      body { font-family: -apple-system, sans-serif; background: #FBF7F8; color: #2E2430; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; text-align: center; padding: 24px; }
      div { max-width: 320px; }
      h1 { font-size: 20px; margin-bottom: 8px; }
      p { color: #7A6B74; line-height: 1.4; }
    </style>
  </head>
  <body>
    <div>
      <h1>This photo link has expired</h1>
      <p>Photo links are only available for 72 hours. Please ask for a new one.</p>
    </div>
  </body>
</html>`;

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  const { data: link, error } = await supabaseAdmin
    .from("message_attachment_links")
    .select("attachment_path, expires_at")
    .eq("id", id)
    .maybeSingle();

  if (error || !link || new Date(link.expires_at).getTime() <= Date.now()) {
    return new NextResponse(EXPIRED_HTML, {
      status: 410,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  const { data: signedData, error: signError } = await supabaseAdmin.storage
    .from(ATTACHMENT_BUCKET)
    .createSignedUrl(link.attachment_path, REDIRECT_SIGNED_URL_TTL_SECONDS);

  if (signError || !signedData?.signedUrl) {
    return new NextResponse(EXPIRED_HTML, {
      status: 410,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  return NextResponse.redirect(signedData.signedUrl, { status: 302 });
}
