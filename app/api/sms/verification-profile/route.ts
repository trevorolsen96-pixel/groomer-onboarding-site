import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase-admin";

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isFullPublicUrl(value: string) {
  return value.startsWith("https://") || value.startsWith("http://");
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

    const userId = userData.user.id;

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("business_id, role")
      .eq("id", userId)
      .maybeSingle();

    if (profileError || !profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Not authorized." }, { status: 403 });
    }

    const body = await request.json();

    const businessId = profile.business_id;

    if (!businessId) {
      return NextResponse.json(
        { error: "Business account was not found." },
        { status: 400 }
      );
    }

    const legalBusinessName = cleanText(body.legalBusinessName);
    const dbaName = cleanText(body.dbaName);
    const businessPhone = cleanText(body.businessPhone);
    const businessEmail = cleanText(body.businessEmail);
    const businessWebsite = cleanText(body.businessWebsite);

    const addressLine1 = cleanText(body.addressLine1);
    const addressLine2 = cleanText(body.addressLine2);
    const city = cleanText(body.city);
    const state = cleanText(body.state);
    const postalCode = cleanText(body.postalCode);

    const contactName = cleanText(body.contactName);
    const contactEmail = cleanText(body.contactEmail);
    const contactPhone = cleanText(body.contactPhone);

    const businessRegistrationNumber = cleanText(
      body.businessRegistrationNumber
    );
    const businessType = cleanText(body.businessType);

    const optInDescription = cleanText(body.optInDescription);
    const sampleMessage1 = cleanText(body.sampleMessage1);
    const sampleMessage2 = cleanText(body.sampleMessage2);

    if (!legalBusinessName) {
      return NextResponse.json(
        { error: "Enter the legal business name." },
        { status: 400 }
      );
    }

    if (!businessPhone) {
      return NextResponse.json(
        { error: "Enter the business phone number." },
        { status: 400 }
      );
    }

    if (!businessEmail || !businessEmail.includes("@")) {
      return NextResponse.json(
        { error: "Enter a valid business email." },
        { status: 400 }
      );
    }

    if (!businessWebsite) {
      return NextResponse.json(
        {
          error:
            "Enter a business website, Facebook page, Yelp page, Google Business Profile, or public business listing.",
        },
        { status: 400 }
      );
    }

    if (!isFullPublicUrl(businessWebsite)) {
      return NextResponse.json(
        {
          error:
            "Enter a full website or public business page link starting with https:// or http://.",
        },
        { status: 400 }
      );
    }

    if (!addressLine1 || !city || !state || !postalCode) {
      return NextResponse.json(
        { error: "Enter the full business address." },
        { status: 400 }
      );
    }

    if (!contactName || !contactEmail || !contactPhone) {
      return NextResponse.json(
        { error: "Enter the business contact details." },
        { status: 400 }
      );
    }

    const { error: profileUpsertError } = await supabaseAdmin
      .from("business_sms_verification_profile")
      .upsert(
        {
          business_id: businessId,

          legal_business_name: legalBusinessName,
          dba_name: dbaName || null,
          business_phone: businessPhone,
          business_email: businessEmail,
          business_website: businessWebsite,

          address_line1: addressLine1,
          address_line2: addressLine2 || null,
          city,
          state,
          postal_code: postalCode,
          country: "US",

          contact_name: contactName,
          contact_email: contactEmail,
          contact_phone: contactPhone,

          business_registration_number: businessRegistrationNumber || null,
          business_type: businessType || null,

          opt_in_description:
            optInDescription ||
            "Customers provide their phone number through Wagzly-powered onboarding, booking, client intake, or direct communication with the grooming business. Messages are used for appointment reminders, onboarding links, scheduling updates, and direct client communication.",
          sample_message_1:
            sampleMessage1 ||
            "Hi {{customer_name}}, this is {{business_name}}. Your grooming appointment is scheduled for {{appointment_date}} at {{appointment_time}}. Reply STOP to opt out.",
          sample_message_2:
            sampleMessage2 ||
            "Hi {{customer_name}}, here is your secure Wagzly onboarding link for {{business_name}}: {{onboarding_link}}. Reply STOP to opt out.",

          updated_at: new Date().toISOString(),
        },
        { onConflict: "business_id" }
      );

    if (profileUpsertError) {
      return NextResponse.json(
        { error: profileUpsertError.message },
        { status: 400 }
      );
    }

    const { error: setupUpdateError } = await supabaseAdmin
      .from("business_sms_setup")
      .upsert(
        {
          business_id: businessId,
          status: "ready_to_submit",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "business_id" }
      );

    if (setupUpdateError) {
      return NextResponse.json(
        { error: setupUpdateError.message },
        { status: 400 }
      );
    }

    const submitUrl = new URL("/api/sms/submit-verification", request.url);

    const submitResponse = await fetch(submitUrl.toString(), {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    const submitResult = await submitResponse.json();

    if (!submitResponse.ok) {
      return NextResponse.json(
        {
          error:
            "Messaging setup could not be completed. Please contact support@wagzly.app and we’ll help finish your texting setup.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      status: submitResult.status,
      phoneNumber: submitResult.phoneNumber,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          "Messaging setup could not be completed. Please contact support@wagzly.app and we’ll help finish your texting setup.",
      },
      { status: 400 }
    );
  }
}