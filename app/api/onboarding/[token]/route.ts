import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

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
      .select("id, token, status, business_id")
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
      .select("business_name, logo_url")
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
      agreements: agreementsRows ?? [],
      questions: questionsRows ?? [],
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
    const body = (await req.json()) as SubmissionPayload;

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
      .select("id, status, business_id")
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

    const { data: customerRow, error: customerError } = await supabaseAdmin
      .from("customers")
      .insert([
        {
          business_id: requestRow.business_id,
          name: customerName,
          phone: body.phone.trim(),
          address: customerAddress,
          notes: customerNotes,
          image_url: null,
        },
      ])
      .select("id")
      .single();

    if (customerError || !customerRow) {
      console.error("Customer insert error:", customerError);
      return NextResponse.json(
        { error: "Failed to create customer." },
        { status: 500 },
      );
    }

    const petRows = body.pets.map((pet) => ({
      business_id: requestRow.business_id,
      customer_id: customerRow.id,
      name: pet.pet_name.trim(),
      breed: pet.breed.trim(),
      age: pet.age?.trim() || null,
      weight: pet.weight_lbs?.trim() || null,
      sex: pet.sex.trim(),
      temperament: pet.temperament?.trim() || null,
      notes: null,
      image_url: null,
      is_active: true,
    }));

    const { data: createdPets, error: petsError } = await supabaseAdmin
      .from("pets")
      .insert(petRows)
      .select("id");

    if (petsError || !createdPets) {
      console.error("Pet insert error:", petsError);
      return NextResponse.json(
        { error: "Customer created, but failed to create pets." },
        { status: 500 },
      );
    }

    const agreementAcceptanceRows = (body.agreements ?? [])
      .filter((item) => item.accepted && item.agreement_id?.trim())
      .map((item) => ({
        onboarding_request_id: requestRow.id,
        customer_id: customerRow.id,
        agreement_id: item.agreement_id.trim(),
        accepted: true,
      }));

    if (agreementAcceptanceRows.length > 0) {
      const { error: agreementAcceptancesError } = await supabaseAdmin
        .from("intake_agreement_acceptances")
        .insert(agreementAcceptanceRows);

      if (agreementAcceptancesError) {
        console.error("Agreement acceptance insert error:", agreementAcceptancesError);
        return NextResponse.json(
          { error: "Customer created, but failed to save agreement acceptances." },
          { status: 500 },
        );
      }
    }

    const questionResponseRows = (body.pet_questionnaire ?? []).flatMap(
      (petQuestionnaire) => {
        const createdPet = createdPets[petQuestionnaire.pet_index];

        if (!createdPet?.id) return [];

        return (petQuestionnaire.answers ?? [])
          .filter((answer) => {
            if (!answer.question_id?.trim()) return false;
            if (Array.isArray(answer.answer)) return answer.answer.length > 0;
            return String(answer.answer ?? "").trim().length > 0;
          })
          .map((answer) => ({
            request_id: requestRow.id,
            pet_id: createdPet.id,
            question_id: answer.question_id.trim(),
            answer: answer.answer,
          }));
      },
    );

    if (questionResponseRows.length > 0) {
      const { error: questionResponsesError } = await supabaseAdmin
        .from("onboarding_question_responses")
        .insert(questionResponseRows);

      if (questionResponsesError) {
        console.error("Question response insert error:", questionResponsesError);
        return NextResponse.json(
          { error: "Customer and pets created, but failed to save questionnaire answers." },
          { status: 500 },
        );
      }
    }

    const { error: updateError } = await supabaseAdmin
      .from("onboarding_requests")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", requestRow.id);

    if (updateError) {
      console.error("Request status update error:", updateError);
    }

    return NextResponse.json({
      success: true,
      customer_id: customerRow.id,
    });
  } catch (error) {
    console.error("POST onboarding error:", error);
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
}