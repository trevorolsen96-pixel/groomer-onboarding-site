import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendPushToBusinessAsync } from "@/lib/push-notification";

type PetPayload = {
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

function documentTypeTitle(type: string) {
  switch (type) {
    case "rabies":
      return "Rabies Certificate";
    case "vaccines":
      return "Vaccine Records";
    case "vet_note":
      return "Vet Note";
    case "medication":
      return "Medication Instructions";
    default:
      return "Other Record";
  }
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
      .select("id, token, status, business_id, client_email")
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
      .select("id, status, business_id, source")
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

if (requirePetRecords) {
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

    const customerNotes = `Onboarding form submitted. Email: ${body.email
      .trim()
      .toLowerCase()}. SMS opt-in: Yes`;

    // All onboarding submissions go to pending_approval for groomer review
    await supabaseAdmin.from("onboarding_requests").update({
      status: "pending_approval",
      submission_snapshot: {
        ...body,
        _customer_name: customerName,
        _customer_address: customerAddress,
        _customer_notes: customerNotes,
      },
    }).eq("id", requestRow.id);

    const clientName = `${body.owner_first_name ?? ""} ${body.owner_last_name ?? ""}`.trim();
    void sendPushToBusinessAsync({
      businessId: requestRow.business_id,
      title: "New Client Submission",
      body: `${clientName || "A client"} completed the onboarding form.`,
      data: { route: "booking_requests", type: "onboarding_submission" },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST onboarding error:", error);
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
}