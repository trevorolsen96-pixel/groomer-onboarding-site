import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendSms } from "@/lib/telnyx";

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (value.startsWith("+")) return `+${digits}`;
  return `+1${digits}`;
}

function generateToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 48; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

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

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("business_id, role")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Not authorized." }, { status: 403 });
    }

    const body = await request.json();
    const customerId = cleanText(body.customerId);

    if (!customerId) {
      return NextResponse.json({ error: "Missing customer ID." }, { status: 400 });
    }

    // Load customer
    const { data: customer, error: customerError } = await supabaseAdmin
      .from("customers")
      .select("id, name, phone, email, address, secondary_contact_name, secondary_contact_phone, business_id, image_url")
      .eq("id", customerId)
      .eq("business_id", profile.business_id)
      .maybeSingle();

    if (customerError || !customer) {
      return NextResponse.json({ error: "Customer not found." }, { status: 404 });
    }

    if (!customer.phone) {
      return NextResponse.json(
        { error: "This client does not have a phone number on file." },
        { status: 400 }
      );
    }

    // Load active pets
    const { data: pets } = await supabaseAdmin
      .from("pets")
      .select("id, name, breed, age, weight, sex, temperament")
      .eq("customer_id", customerId)
      .eq("business_id", profile.business_id)
      .eq("is_active", true)
      .order("created_at");

    // Load business SMS setup
    const { data: smsSetup } = await supabaseAdmin
      .from("business_sms_setup")
      .select("status, phone_number")
      .eq("business_id", profile.business_id)
      .maybeSingle();

    const smsActive = smsSetup?.phone_number &&
      ["active", "approved"].includes(smsSetup.status ?? "");

    // Generate token
    const onboardingToken = generateToken();

    // Load business name
    const { data: settings } = await supabaseAdmin
      .from("business_settings")
      .select("business_name")
      .eq("business_id", profile.business_id)
      .maybeSingle();

    const businessName = cleanText(settings?.business_name) || "Your groomer";

    // Create onboarding request
    const { error: insertError } = await supabaseAdmin
      .from("onboarding_requests")
      .insert({
        business_id: profile.business_id,
        customer_id: customerId,
        client_email: customer.email ?? null,
        token: onboardingToken,
        status: "pending",
        source: "update_request",
      });

    if (insertError) {
      console.error("Insert onboarding_request error:", insertError);
      return NextResponse.json(
        { error: `Failed to create update request: ${insertError.message}` },
        { status: 500 }
      );
    }

    const onboardingUrl = `https://www.wagzly.com/onboarding/${onboardingToken}`;
    const smsText = `Hi ${customer.name.split(" ")[0] || "there"}, ${businessName} has sent you a link to update your client information. Please review and update here: ${onboardingUrl}`;

    // Send SMS if available
    if (smsActive) {
      try {
        await sendSms({
          from: normalizePhone(smsSetup!.phone_number!),
          to: normalizePhone(customer.phone),
          text: smsText,
        });

        // Log it in the customer's Messages thread too, the same way a
        // manually-sent text would appear — otherwise a groomer has no way
        // to tell from the app whether (or when) an update link went out.
        try {
          const now = new Date().toISOString();

          const { data: existingConversation } = await supabaseAdmin
            .from("message_conversations")
            .select("id, unread_count")
            .eq("business_id", profile.business_id)
            .eq("customer_id", customerId)
            .maybeSingle();

          let conversationId = existingConversation?.id as string | undefined;

          if (!conversationId) {
            const { data: insertedConversation, error: insertConversationError } =
              await supabaseAdmin
                .from("message_conversations")
                .insert({
                  business_id: profile.business_id,
                  customer_id: customerId,
                  customer_name: customer.name,
                  customer_phone: customer.phone,
                  customer_image_url: customer.image_url ?? null,
                  last_message_body: smsText,
                  last_message_at: now,
                  unread_count: 0,
                })
                .select("id")
                .single();

            if (insertConversationError) throw insertConversationError;
            conversationId = insertedConversation?.id;
          }

          if (conversationId) {
            await supabaseAdmin.from("message_items").insert({
              business_id: profile.business_id,
              conversation_id: conversationId,
              customer_id: customerId,
              direction: "outbound",
              body: smsText,
              status: "sent",
              provider: "telnyx",
              created_at: now,
            });

            await supabaseAdmin
              .from("message_conversations")
              .update({
                last_message_body: smsText,
                last_message_at: now,
                is_closed: false,
              })
              .eq("id", conversationId);
          }
        } catch (messageLogError) {
          console.error("Failed to log update-request SMS to Messages:", messageLogError);
          // Don't fail the whole request if this best-effort logging fails —
          // the SMS itself already went out successfully.
        }
      } catch (smsError) {
        console.error("Failed to send update SMS:", smsError);
        // Don't fail the whole request if SMS fails
      }
    }

    return NextResponse.json({
      ok: true,
      smsSent: smsActive,
      onboardingUrl,
    });
  } catch (error) {
    console.error("send-update-request error:", error);
    return NextResponse.json(
      { error: "Failed to send update request." },
      { status: 500 }
    );
  }
}
