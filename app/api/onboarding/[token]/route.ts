import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendPushToBusinessAsync } from "@/lib/push-notification";

type PetPayload = {
  id?: string;
  pet_name: string;
  breed: string;
  age: string;
  weight_lbs: string;
  sex: string;
  temperament: string;
};

type AgreementAcceptancePayload = {
  agreement_id: string;
  accepted: boolean;
};

type QuestionAnswerPayload = {
  question_id: string;
  response_type: string;
  answer: string | string[];
};

type PetQuestionnairePayload = {
  pet_index: number;
  answers: QuestionAnswerPayload[];
};

type PetRecordUploadPayload = {
  pet_index: number;
  file_key: string;
  document_type: string;
  title: string;
  file_name: string;
  mime_type: string;
  expiry_date?: string;
};

type SubmissionPayload = {
  owner_first_name: string;
  owner_last_name: string;
  phone: string;
  email: string;
  address_line_1: string;
  address_line_2?: string;
  city: string;
  state: string;
  postal_code: string;
  sms_opt_in: boolean;
  secondary_contact_name?: string;
  secondary_contact_phone?: string;
  pets: PetPayload[];
  agreements: AgreementAcceptancePayload[];
  pet_questionnaire: PetQuestionnairePayload[];
  pet_records?: PetRecordUploadPayload[];
};

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function normalizeToken(token: string) {
  return token.trim();
}

function buildCustomerName(firstName: string, lastName: string) {
  return `${firstName.trim()} ${lastName.trim()}`.trim();
}

function cleanFileName(value: string) {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_") || "record";
}

function buildAddress(
  address1: string,
  address2: string | undefined,
  city: string,
  state: string,
  postalCode: string,
) {
  const line1 = address1.trim();
  const line2 = address2?.trim();
  const cityStateZip = `${city.trim()} ${state.trim()} ${postalCode.trim()}`.trim();

  return [line1, line2, cityStateZip].filter(Boolean).join(", ");
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await context.params;
    const cleanToken = normalizeToken(token);

    const { data: requestRow, error: requestError } = await supabaseAdmin
      .from("onboarding_requests")
      .select("id, token, status, business_id, client_email, customer_id")
      .eq("token", cleanToken)
      .single();

    if (requestError || !requestRow) {
      return NextResponse.json(
        { error: "Onboarding link not found." },
        { status: 404 },
      );
    }

    if (requestRow.status === "completed") {
      return NextResponse.json(
        { error: "This onboarding link has already been used." },
        { status: 410 },
      );
    }

    const { data: settingsRow, error: settingsError } = await supabaseAdmin
      .from("business_settings")
      .select("business_name, logo_url, require_pet_records_onboarding")
      .eq("business_id", requestRow.business_id)
      .single();

    if (settingsError || !settingsRow) {
      return NextResponse.json(
        { error: "Business settings not found for this onboarding link." },
        { status: 404 },
      );
    }

    const { data: agreementsRows, error: agreementsError } = await supabaseAdmin
      .from("intake_agreements")
      .select("id, title, agreement_text, is_required, sort_order")
      .eq("business_id", requestRow.business_id)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (agreementsError) {
      console.error("Agreement load error:", agreementsError);
      return NextResponse.json(
        { error: "Failed to load client agreements." },
        { status: 500 },
      );
    }

    const { data: questionsRows, error: questionsError } = await supabaseAdmin
      .from("onboarding_questions")
      .select("id, question_text, response_type, options, is_required, sort_order")
      .eq("business_id", requestRow.business_id)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (questionsError) {
      console.error("Question load error:", questionsError);
      return NextResponse.json(
        { error: "Failed to load onboarding questions." },
        { status: 500 },
      );
    }

    const { data: recordTypesRows } = await supabaseAdmin
      .from("business_pet_record_types")
      .select("id, name, has_expiry, sort_order")
      .eq("business_id", requestRow.business_id)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    // Load pre-fill data for update requests
    let preFill = null;
    const isUpdate = !!requestRow.customer_id;

    if (isUpdate) {
      const { data: customer } = await supabaseAdmin
        .from("customers")
        .select("name, phone, email, address, secondary_contact_name, secondary_contact_phone")
        .eq("id", requestRow.customer_id)
        .maybeSingle();

      const { data: pets } = await supabaseAdmin
        .from("pets")
        .select("id, name, breed, age, weight, sex, temperament")
        .eq("customer_id", requestRow.customer_id)
        .eq("is_active", true)
        .order("created_at");

      if (customer && pets) {
        const petIds = (pets ?? []).map((p) => p.id).filter(Boolean);
        const nameParts = (customer.name ?? "").trim().split(/\s+/);
        const firstName = nameParts[0] ?? "";
        const lastName = nameParts.slice(1).join(" ");

        // Parse stored address "line1[, line2], city state zip" back into fields
        const addressParts = (customer.address ?? "").split(", ");
        let addressLine1 = "";
        let addressLine2 = "";
        let city = "";
        let state = "";
        let postalCode = "";

        if (addressParts.length >= 2) {
          const cityStateZip = addressParts[addressParts.length - 1];
          const cityStateZipParts = cityStateZip.trim().split(/\s+/);
          postalCode = cityStateZipParts[cityStateZipParts.length - 1] ?? "";
          state = cityStateZipParts[cityStateZipParts.length - 2] ?? "";
          city = cityStateZipParts.slice(0, -2).join(" ");
          addressLine1 = addressParts[0];
          addressLine2 = addressParts.length === 3 ? addressParts[1] : "";
        } else {
          addressLine1 = customer.address ?? "";
        }

        // Fetch questionnaire answers for existing pets
        const { data: questionResponses } = petIds.length > 0
          ? await supabaseAdmin
              .from("onboarding_question_responses")
              .select("pet_id, question_id, answer")
              .in("pet_id", petIds)
          : { data: [] };

        // Fetch valid (non-expired) pet documents
        const today = new Date().toISOString().split("T")[0];
        const { data: existingDocs } = petIds.length > 0
          ? await supabaseAdmin
              .from("pet_documents")
              .select("pet_id, record_type_id, title, expires_at")
              .in("pet_id", petIds)
              .or(`expires_at.is.null,expires_at.gte.${today}`)
          : { data: [] };

        preFill = {
          owner_first_name: firstName,
          owner_last_name: lastName,
          phone: customer.phone ?? "",
          email: customer.email ?? "",
          address_line_1: addressLine1,
          address_line_2: addressLine2,
          city,
          state,
          postal_code: postalCode,
          secondary_contact_name: customer.secondary_contact_name ?? "",
          secondary_contact_phone: customer.secondary_contact_phone ?? "",
          question_responses: (questionResponses ?? []).map((r) => ({
            pet_id: r.pet_id,
            question_id: r.question_id,
            answer: r.answer,
          })),
          existing_records: (existingDocs ?? []).map((d) => ({
            pet_id: d.pet_id,
            record_type_id: d.record_type_id,
            title: d.title,
            expires_at: d.expires_at ?? null,
          })),
          pets: (pets ?? []).map((p) => ({
            id: p.id,
            pet_name: p.name ?? "",
            breed: p.breed ?? "",
            age: p.age ?? "",
            weight_lbs: p.weight ?? "",
            sex: p.sex ?? "",
            temperament: p.temperament ?? "",
          })),
        };
      }
    }

    return NextResponse.json({
      request_id: requestRow.id,
      business_name: settingsRow.business_name ?? "Your Groomer",
      logo_url: settingsRow.logo_url ?? null,
      status: requestRow.status,
      client_email: requestRow.client_email ?? null,
      agreements: agreementsRows ?? [],
      questions: questionsRows ?? [],
      require_pet_records_onboarding:
        settingsRow.require_pet_records_onboarding ?? false,
      pet_record_types: recordTypesRows ?? [],
      is_update: isUpdate,
      customer_id: requestRow.customer_id ?? null,
      pre_fill: preFill,
    });
  } catch (error) {
    console.error("GET onboarding token error:", error);
    return NextResponse.json(
      { error: "Failed to load onboarding form." },
      { status: 500 },
    );
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await context.params;
    const cleanToken = normalizeToken(token);
    const contentType = req.headers.get("content-type") ?? "";

let body: SubmissionPayload;
let formData: FormData | null = null;

if (contentType.includes("multipart/form-data")) {
  formData = await req.formData();

  const payloadRaw = formData.get("payload");

  if (typeof payloadRaw !== "string") {
    return badRequest("Missing onboarding payload.");
  }

  body = JSON.parse(payloadRaw) as SubmissionPayload;
} else {
  body = (await req.json()) as SubmissionPayload;
}

    if (!body.owner_first_name?.trim()) return badRequest("First name is required.");
    if (!body.owner_last_name?.trim()) return badRequest("Last name is required.");
    if (!body.phone?.trim()) return badRequest("Phone is required.");
    if (!body.email?.trim()) return badRequest("Email is required.");
    if (!body.address_line_1?.trim()) return badRequest("Address line 1 is required.");
    if (!body.city?.trim()) return badRequest("City is required.");
    if (!body.state?.trim()) return badRequest("State is required.");
    if (!body.postal_code?.trim()) return badRequest("ZIP code is required.");
    if (!body.sms_opt_in) return badRequest("SMS consent is required to complete onboarding.");

    if (!Array.isArray(body.pets) || body.pets.length === 0) {
      return badRequest("At least one pet is required.");
    }

    for (const pet of body.pets) {
      if (!pet.pet_name?.trim()) return badRequest("Each pet must have a name.");
      if (!pet.breed?.trim()) return badRequest("Each pet must have a breed.");
      if (!pet.sex?.trim()) return badRequest("Each pet must have a sex.");
    }

    const { data: requestRow, error: requestError } = await supabaseAdmin
      .from("onboarding_requests")
      .select("id, status, business_id, source, customer_id")
      .eq("token", cleanToken)
      .single();

    if (requestError || !requestRow) {
      return NextResponse.json(
        { error: "Onboarding link not found." },
        { status: 404 },
      );
    }

    if (requestRow.status === "completed") {
      return NextResponse.json(
        { error: "This onboarding link has already been submitted." },
        { status: 410 },
      );
    }

    const { data: requiredAgreements, error: requiredAgreementsError } =
      await supabaseAdmin
        .from("intake_agreements")
        .select("id")
        .eq("business_id", requestRow.business_id)
        .eq("is_active", true)
        .eq("is_required", true);

    if (requiredAgreementsError) {
      console.error("Required agreement load error:", requiredAgreementsError);
      return NextResponse.json(
        { error: "Failed to validate client agreements." },
        { status: 500 },
      );
    }

    const acceptedAgreementIds = new Set(
      (body.agreements ?? [])
        .filter((item) => item.accepted && item.agreement_id?.trim())
        .map((item) => item.agreement_id.trim()),
    );

    for (const agreement of requiredAgreements ?? []) {
      if (!acceptedAgreementIds.has(agreement.id)) {
        return badRequest("All required client agreements must be accepted.");
      }
    }

    const { data: settingsValidationRow, error: settingsValidationError } =
  await supabaseAdmin
    .from("business_settings")
    .select("require_pet_records_onboarding")
    .eq("business_id", requestRow.business_id)
    .single();

if (settingsValidationError || !settingsValidationRow) {
  console.error("Settings validation error:", settingsValidationError);
  return NextResponse.json(
    { error: "Failed to validate onboarding settings." },
    { status: 500 },
  );
}

const requirePetRecords =
  settingsValidationRow.require_pet_records_onboarding ?? false;

// Load custom record types for this business
const { data: customRecordTypes } = await supabaseAdmin
  .from("business_pet_record_types")
  .select("id, name, is_required")
  .eq("business_id", requestRow.business_id)
  .eq("is_active", true);

const requiredRecordTypes = (customRecordTypes ?? []).filter((t) => t.is_required);

if (requiredRecordTypes.length > 0) {
  // Validate each required record type per pet
  for (let petIndex = 0; petIndex < body.pets.length; petIndex += 1) {
    for (const recordType of requiredRecordTypes) {
      const hasUpload = (body.pet_records ?? []).some(
        (record) =>
          record.pet_index === petIndex &&
          record.document_type === recordType.id &&
          record.file_key?.trim(),
      );
      if (!hasUpload) {
        return badRequest(
          `Please upload a ${recordType.name} for each pet.`,
        );
      }
    }
  }
} else if (requirePetRecords) {
  // Legacy: no custom types but toggle is on — require at least one record per pet
  for (let petIndex = 0; petIndex < body.pets.length; petIndex += 1) {
    const hasRecord = (body.pet_records ?? []).some(
      (record) => record.pet_index === petIndex && record.file_key?.trim(),
    );
    if (!hasRecord) {
      return badRequest("Please upload at least one record for each pet.");
    }
  }
}

    const { data: requiredQuestions, error: requiredQuestionsError } =
      await supabaseAdmin
        .from("onboarding_questions")
        .select("id")
        .eq("business_id", requestRow.business_id)
        .eq("is_active", true)
        .eq("is_required", true);

    if (requiredQuestionsError) {
      console.error("Required question load error:", requiredQuestionsError);
      return NextResponse.json(
        { error: "Failed to validate onboarding questions." },
        { status: 500 },
      );
    }

    for (let petIndex = 0; petIndex < body.pets.length; petIndex += 1) {
      const petQuestionnaire = (body.pet_questionnaire ?? []).find(
        (item) => item.pet_index === petIndex,
      );

      const answersMap = new Map(
        (petQuestionnaire?.answers ?? []).map((answer) => [
          answer.question_id,
          answer.answer,
        ]),
      );

      for (const question of requiredQuestions ?? []) {
        const answer = answersMap.get(question.id);

        if (
          !answer ||
          (Array.isArray(answer) && answer.length === 0) ||
          (typeof answer === "string" && answer.trim() === "")
        ) {
          return badRequest("Please answer all required questions for each pet.");
        }
      }
    }

    const customerName = buildCustomerName(
      body.owner_first_name,
      body.owner_last_name,
    );

    const customerAddress = buildAddress(
      body.address_line_1,
      body.address_line_2,
      body.city,
      body.state,
      body.postal_code,
    );

    const clientName = `${body.owner_first_name ?? ""} ${body.owner_last_name ?? ""}`.trim();

    if (requestRow.customer_id) {
      // UPDATE REQUEST — auto-apply changes immediately

      // Update customer record
      await supabaseAdmin
        .from("customers")
        .update({
          name: customerName,
          phone: body.phone?.trim() || null,
          email: body.email?.trim().toLowerCase() || null,
          address: customerAddress,
          secondary_contact_name: (body as any).secondary_contact_name?.trim() || null,
          secondary_contact_phone: (body as any).secondary_contact_phone?.trim() || null,
        })
        .eq("id", requestRow.customer_id)
        .eq("business_id", requestRow.business_id);

      // Handle pets — update existing, add new, deactivate removed
      const submittedPets = body.pets ?? [];
      const submittedPetIds = submittedPets
        .map((p: any) => p.id)
        .filter((id: string | undefined) => !!id) as string[];

      // Deactivate pets that were removed
      const { data: existingPets } = await supabaseAdmin
        .from("pets")
        .select("id")
        .eq("customer_id", requestRow.customer_id)
        .eq("business_id", requestRow.business_id)
        .eq("is_active", true);

      const removedPetIds = (existingPets ?? [])
        .map((p) => p.id)
        .filter((id) => !submittedPetIds.includes(id));

      if (removedPetIds.length > 0) {
        await supabaseAdmin
          .from("pets")
          .update({ is_active: false })
          .in("id", removedPetIds);
      }

      // Update or create pets
      for (const pet of submittedPets) {
        const petData = {
          name: (pet as any).pet_name?.trim() || "",
          breed: (pet as any).breed?.trim() || "",
          age: (pet as any).age?.trim() || "",
          weight: (pet as any).weight_lbs?.trim() || "",
          sex: (pet as any).sex?.trim() || "",
          temperament: (pet as any).temperament?.trim() || "",
        };

        if ((pet as any).id) {
          await supabaseAdmin
            .from("pets")
            .update(petData)
            .eq("id", (pet as any).id)
            .eq("business_id", requestRow.business_id);
        } else {
          await supabaseAdmin.from("pets").insert({
            ...petData,
            business_id: requestRow.business_id,
            customer_id: requestRow.customer_id,
            is_active: true,
          });
        }
      }

      // Upsert agreement acceptances
      const rawAgreements = body.agreements ?? [];
      console.log("[agreements] raw payload:", JSON.stringify(rawAgreements));

      const acceptedAgreements = rawAgreements.filter(
        (a) => a.accepted === true && a.agreement_id?.trim(),
      );
      console.log("[agreements] accepted count:", acceptedAgreements.length);

      if (acceptedAgreements.length > 0) {
        const { data: agreementTextRows, error: textError } = await supabaseAdmin
          .from("intake_agreements")
          .select("id, agreement_text")
          .in("id", acceptedAgreements.map((a) => a.agreement_id));

        if (textError) console.error("[agreements] text fetch error:", textError);

        const textMap = new Map(
          (agreementTextRows ?? []).map((r) => [r.id, r.agreement_text ?? ""]),
        );

        const { error: upsertError } = await supabaseAdmin
          .from("intake_agreement_acceptances")
          .upsert(
            acceptedAgreements.map((a) => ({
              onboarding_request_id: requestRow.id,
              customer_id: requestRow.customer_id,
              agreement_id: a.agreement_id.trim(),
              accepted: true,
              accepted_at: new Date().toISOString(),
              accepted_text: textMap.get(a.agreement_id.trim()) ?? null,
            })),
            { onConflict: "customer_id,agreement_id" },
          );

        if (upsertError) console.error("[agreements] upsert error:", upsertError);
        else console.log("[agreements] upsert success");
      }

      // Mark as completed
      await supabaseAdmin
        .from("onboarding_requests")
        .update({
          status: "completed",
          submission_snapshot: { ...body, _customer_name: customerName },
        })
        .eq("id", requestRow.id);

      await sendPushToBusinessAsync({
        businessId: requestRow.business_id,
        title: "Client Info Updated",
        body: `${clientName || "A client"} updated their information.`,
        data: { route: "customers", type: "client_update" },
      });
    } else {
      // NEW CLIENT — send to pending_approval for groomer review
      const customerNotes = `Onboarding form submitted. Email: ${body.email
        .trim()
        .toLowerCase()}. SMS opt-in: Yes`;

      await supabaseAdmin.from("onboarding_requests").update({
        status: "pending_approval",
        submission_snapshot: {
          ...body,
          _customer_name: customerName,
          _customer_address: customerAddress,
          _customer_notes: customerNotes,
        },
      }).eq("id", requestRow.id);

      await sendPushToBusinessAsync({
        businessId: requestRow.business_id,
        title: "New Client Submission",
        body: `${clientName || "A client"} completed the onboarding form.`,
        data: { route: "booking_requests", type: "onboarding_submission" },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST onboarding error:", error);
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
}