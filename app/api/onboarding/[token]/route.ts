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
  questionnaire: QuestionAnswerPayload[];
};

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function normalizeToken(token: string) {
  return token.trim();
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    const cleanToken = normalizeToken(token);

    const { data: requestRow } = await supabaseAdmin
      .from("onboarding_requests")
      .select("id, status, business_id")
      .eq("token", cleanToken)
      .single();

    if (!requestRow) {
      return NextResponse.json({ error: "Invalid link" }, { status: 404 });
    }

    const { data: settings } = await supabaseAdmin
      .from("business_settings")
      .select("business_name, logo_url")
      .eq("business_id", requestRow.business_id)
      .single();

    const { data: agreements } = await supabaseAdmin
      .from("intake_agreements")
      .select("id, title, agreement_text, is_required, sort_order")
      .eq("business_id", requestRow.business_id)
      .eq("is_active", true);

    const { data: questions } = await supabaseAdmin
      .from("onboarding_questions")
      .select(
        "id, question_text, response_type, options, is_required, sort_order"
      )
      .eq("business_id", requestRow.business_id)
      .eq("is_active", true);

    return NextResponse.json({
      request_id: requestRow.id,
      business_name: settings?.business_name ?? "Your Groomer",
      logo_url: settings?.logo_url ?? null,
      status: requestRow.status,
      agreements: agreements ?? [],
      questions: questions ?? [],
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to load onboarding form." },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    const cleanToken = normalizeToken(token);
    const body = (await req.json()) as SubmissionPayload;

    const { data: requestRow } = await supabaseAdmin
      .from("onboarding_requests")
      .select("id, business_id, status")
      .eq("token", cleanToken)
      .single();

    if (!requestRow) {
      return badRequest("Invalid onboarding link.");
    }

    // ✅ Validate required questions
    const { data: requiredQuestions } = await supabaseAdmin
      .from("onboarding_questions")
      .select("id")
      .eq("business_id", requestRow.business_id)
      .eq("is_required", true)
      .eq("is_active", true);

    const answersMap = new Map(
      (body.questionnaire ?? []).map((q) => [q.question_id, q.answer])
    );

    for (const question of requiredQuestions ?? []) {
      const answer = answersMap.get(question.id);

      if (
        !answer ||
        (Array.isArray(answer) && answer.length === 0) ||
        (typeof answer === "string" && answer.trim() === "")
      ) {
        return badRequest("Please answer all required questions.");
      }
    }

    // ✅ Create customer
    const { data: customer } = await supabaseAdmin
      .from("customers")
      .insert([
        {
          business_id: requestRow.business_id,
          name: `${body.owner_first_name} ${body.owner_last_name}`,
          phone: body.phone,
        },
      ])
      .select("id")
      .single();

    // ✅ Save questionnaire answers
    const questionRows = (body.questionnaire ?? []).map((q) => ({
      onboarding_request_id: requestRow.id,
      question_id: q.question_id,
      answer: q.answer,
    }));

    if (questionRows.length > 0) {
      await supabaseAdmin
        .from("onboarding_question_responses")
        .insert(questionRows);
    }

    // ✅ Mark complete
    await supabaseAdmin
      .from("onboarding_requests")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", requestRow.id);

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Submission failed." }, { status: 400 });
  }
}