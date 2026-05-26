import { NextResponse } from "next/server";
import { getVercelOidcToken } from "@vercel/oidc";
import { supabaseAdmin } from "../../../../lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanText(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");

  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (value.startsWith("+")) return value.replace(/[^\d+]/g, "");

  return value;
}

function emptyTwimlResponse() {
  return new NextResponse("<Response></Response>", {
    status: 200,
    headers: { "content-type": "text/xml" },
  });
}

async function updateLatestAppointmentConfirmation({
  businessId,
  customerId,
  body,
}: {
  businessId: string;
  customerId: string;
  body: string;
}) {
  const clean = body.trim().toLowerCase();

  const yesValues = new Set(["yes", "y", "confirm", "confirmed"]);
  const noValues = new Set(["no", "n", "reschedule"]);

  let status: string | null = null;

  if (yesValues.has(clean)) {
    status = "confirmed";
  }

  if (noValues.has(clean)) {
    status = "needs_reschedule";
  }

  if (!status) return;

  const now = new Date().toISOString();

  const { data: appointments } = await supabaseAdmin
    .from("appointments")
    .select("id, scheduled_at")
    .eq("business_id", businessId)
    .eq("customer_id", customerId)
    .eq("confirmation_status", "pending")
    .gte("scheduled_at", now)
    .order("scheduled_at", { ascending: true })
    .limit(1);

  const appointment = appointments?.[0];

  if (!appointment?.id) return;

  await supabaseAdmin
    .from("appointments")
    .update({
      confirmation_status: status,
      confirmation_responded_at: now,
    })
    .eq("id", appointment.id)
    .eq("business_id", businessId);

  await supabaseAdmin.from("sms_events").insert({
    business_id: businessId,
    customer_id: customerId,
    appointment_id: appointment.id,
    direction: "inbound",
    event_type:
      status === "confirmed"
        ? "appointment_confirmed"
        : "appointment_needs_reschedule",
    message_body: body,
    created_at: now,
  });
}

export async function GET() {
  return emptyTwimlResponse();
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const fromPhone = normalizePhone(cleanText(formData.get("From")));
    const toPhone = normalizePhone(cleanText(formData.get("To")));
    const body = cleanText(formData.get("Body"));

    if (!fromPhone || !toPhone || !body) {
      return emptyTwimlResponse();
    }

    const { data: smsSetup } = await supabaseAdmin
      .from("business_sms_setup")
      .select("business_id, phone_number, status")
      .eq("phone_number", toPhone)
      .eq("status", "approved")
      .maybeSingle();

    if (!smsSetup?.business_id) {
      return emptyTwimlResponse();
    }

    const businessId = smsSetup.business_id;
    const now = new Date().toISOString();

    const { data: customers } = await supabaseAdmin
      .from("customers")
      .select("id, name, phone, secondary_contact_phone, image_url")
      .eq("business_id", businessId);

    const customer = (customers ?? []).find((item) => {
      return (
        normalizePhone(item.phone ?? "") === fromPhone ||
        normalizePhone(item.secondary_contact_phone ?? "") === fromPhone
      );
    });

    if (!customer) {
      await supabaseAdmin.from("sms_events").insert({
        business_id: businessId,
        direction: "inbound",
        event_type: "unmatched_inbound_message",
        message_body: body,
        from_phone: fromPhone,
        to_phone: toPhone,
        created_at: now,
      });
      

      return emptyTwimlResponse();
    }

    await updateLatestAppointmentConfirmation({
      businessId,
      customerId: customer.id,
      body,
    });

    const { data: existingConversation } = await supabaseAdmin
      .from("message_conversations")
      .select("*")
      .eq("business_id", businessId)
      .eq("customer_id", customer.id)
      .maybeSingle();

    let conversationId = existingConversation?.id as string | undefined;

    if (!conversationId) {
      const { data: insertedConversation, error: insertConversationError } =
        await supabaseAdmin
          .from("message_conversations")
          .insert({
            business_id: businessId,
            customer_id: customer.id,
            customer_name: customer.name,
            customer_phone: customer.phone,
            customer_image_url: customer.image_url,
            last_message_body: body,
            last_message_at: now,
            unread_count: 1,
            created_at: now,
          })
          .select("id")
          .single();

      if (insertConversationError || !insertedConversation) {
        throw new Error(
          insertConversationError?.message ?? "Unable to create conversation."
        );
      }

      conversationId = insertedConversation.id;
    }

    await supabaseAdmin.from("message_items").insert({
      business_id: businessId,
      conversation_id: conversationId,
      customer_id: customer.id,
      direction: "inbound",
      body,
      status: "received",
      provider: "twilio",
      created_at: now,
    });

    await supabaseAdmin
      .from("message_conversations")
      .update({
        last_message_body: body,
        last_message_at: now,
        unread_count: (existingConversation?.unread_count ?? 0) + 1,
      })
      .eq("id", conversationId);

           await supabaseAdmin.from("sms_events").insert({
      business_id: businessId,
      customer_id: customer.id,
      direction: "inbound",
      event_type: "manual_message_reply",
      message_body: body,
      from_phone: fromPhone,
      to_phone: toPhone,
      created_at: now,
    });

    console.log("About to send inbound SMS push", {
      hasConversationId: !!conversationId,
      hasPushUrl: !!process.env.GOOGLE_PUSH_FUNCTION_URL,
      hasPushSecret: !!process.env.WAGZLY_PUSH_SECRET,
    });

        try {
      const pushUrl = process.env.GOOGLE_PUSH_FUNCTION_URL;
      const pushSecret = process.env.WAGZLY_PUSH_SECRET;
      const serviceAccountEmail = process.env.GCP_SERVICE_ACCOUNT_EMAIL;

      if (pushUrl && pushSecret && serviceAccountEmail && conversationId) {
        const vercelToken = await getVercelOidcToken();

        const stsResponse = await fetch("https://sts.googleapis.com/v1/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
            audience:
              "//iam.googleapis.com/projects/443606887092/locations/global/workloadIdentityPools/vercel-pool/providers/vercel-provider",
            scope: "https://www.googleapis.com/auth/cloud-platform",
            requested_token_type:
              "urn:ietf:params:oauth:token-type:access_token",
            subject_token_type: "urn:ietf:params:oauth:token-type:jwt",
            subject_token: vercelToken,
          }),
        });

        const stsJson = await stsResponse.json();

        if (!stsResponse.ok) {
          console.error("Google STS token exchange failed:", stsJson);
          throw new Error("Google STS token exchange failed");
        }

        const iamResponse = await fetch(
          `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${serviceAccountEmail}:generateIdToken`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${stsJson.access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              audience: pushUrl,
              includeEmail: true,
            }),
          }
        );

        const iamJson = await iamResponse.json();

        if (!iamResponse.ok) {
          console.error("Google IAM ID token failed:", iamJson);
          throw new Error("Google IAM ID token failed");
        }

        const pushResponse = await fetch(pushUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${iamJson.token}`,
            "Content-Type": "application/json",
            "x-wagzly-push-secret": pushSecret,
          },
          body: JSON.stringify({
            businessId,
            conversationId,
            customerName: customer.name,
            messageBody: body,
          }),
        });

        const pushText = await pushResponse.text();

        console.log("Push response:", {
          status: pushResponse.status,
          body: pushText,
        });
      }
    } catch (pushError) {
      console.error("Inbound SMS push notification failed:", pushError);
    }

    return emptyTwimlResponse();
  } catch {
    return emptyTwimlResponse();
  }
}