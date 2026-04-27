"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type PetForm = {
  pet_name: string;
  breed: string;
  age: string;
  weight_lbs: string;
  sex: string;
  temperament: string;
};

type Agreement = {
  id: string;
  title: string | null;
  agreement_text: string;
  is_required: boolean;
  sort_order: number;
};

type AgreementAcceptance = {
  agreement_id: string;
  accepted: boolean;
};

type OnboardingQuestion = {
  id: string;
  question_text: string;
  response_type: "text" | "yes_no" | "dropdown_single" | "dropdown_multi";
  options: string[];
  is_required: boolean;
  sort_order: number;
};

type QuestionAnswer = {
  question_id: string;
  response_type: string;
  answer: string | string[];
};

type BrandingResponse = {
  request_id: string;
  business_name: string;
  logo_url: string | null;
  status: string;
  agreements: Agreement[];
  questions: OnboardingQuestion[];
  error?: string;
};

const emptyPet = (): PetForm => ({
  pet_name: "",
  breed: "",
  age: "",
  weight_lbs: "",
  sex: "",
  temperament: "",
});

export default function OnboardingTokenPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const token = params.token;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [agreementAcceptances, setAgreementAcceptances] = useState<
    AgreementAcceptance[]
  >([]);

  const [questions, setQuestions] = useState<OnboardingQuestion[]>([]);
  const [questionAnswers, setQuestionAnswers] = useState<QuestionAnswer[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const [form, setForm] = useState({
    owner_first_name: "",
    owner_last_name: "",
    phone: "",
    email: "",
    address_line_1: "",
    address_line_2: "",
    city: "",
    state: "",
    postal_code: "",
    sms_opt_in: false,
  });

  const [pets, setPets] = useState<PetForm[]>([emptyPet()]);

  useEffect(() => {
    async function loadBranding() {
      try {
        setLoading(true);
        setLoadError("");

        const response = await fetch(`/api/onboarding/${token}`);
        const result: BrandingResponse = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Failed to load onboarding page.");
        }

        setBusinessName(result.business_name);
        setLogoUrl(result.logo_url);
        setAgreements(result.agreements ?? []);
        setQuestions(result.questions ?? []);

        setAgreementAcceptances(
          (result.agreements ?? []).map((agreement) => ({
            agreement_id: agreement.id,
            accepted: false,
          })),
        );

        setQuestionAnswers(
          (result.questions ?? []).map((question) => ({
            question_id: question.id,
            response_type: question.response_type,
            answer: question.response_type === "dropdown_multi" ? [] : "",
          })),
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to load onboarding page.";
        setLoadError(message);
      } finally {
        setLoading(false);
      }
    }

    if (token) {
      loadBranding();
    }
  }, [token]);

  function updateOwnerField(key: string, value: string | boolean) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function updatePetField(index: number, key: keyof PetForm, value: string) {
    setPets((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        [key]: value,
      };
      return next;
    });
  }

  function updateAgreement(agreementId: string, accepted: boolean) {
    setAgreementAcceptances((prev) =>
      prev.map((item) =>
        item.agreement_id === agreementId ? { ...item, accepted } : item,
      ),
    );
  }

  function updateQuestionAnswer(questionId: string, answer: string | string[]) {
    setQuestionAnswers((prev) =>
      prev.map((item) =>
        item.question_id === questionId ? { ...item, answer } : item,
      ),
    );
  }

  function toggleMultiSelectAnswer(questionId: string, option: string) {
    setQuestionAnswers((prev) =>
      prev.map((item) => {
        if (item.question_id !== questionId) return item;

        const current = Array.isArray(item.answer) ? item.answer : [];
        const exists = current.includes(option);

        return {
          ...item,
          answer: exists
            ? current.filter((value) => value !== option)
            : [...current, option],
        };
      }),
    );
  }

  function addPet() {
    setPets((prev) => [...prev, emptyPet()]);
  }

  function removePet(index: number) {
    setPets((prev) => {
      if (prev.length === 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  }

  function validateRequiredQuestions() {
    return questions.every((question) => {
      if (!question.is_required) return true;

      const answer = questionAnswers.find(
        (item) => item.question_id === question.id,
      )?.answer;

      if (Array.isArray(answer)) {
        return answer.length > 0;
      }

      return String(answer ?? "").trim().length > 0;
    });
  }

  function renderQuestionInput(question: OnboardingQuestion) {
    const answerItem = questionAnswers.find(
      (item) => item.question_id === question.id,
    );

    const answer = answerItem?.answer ?? "";

    if (question.response_type === "yes_no") {
      return (
        <select
          value={typeof answer === "string" ? answer : ""}
          onChange={(e) => updateQuestionAnswer(question.id, e.target.value)}
          required={question.is_required}
        >
          <option value="">Select an answer</option>
          <option value="Yes">Yes</option>
          <option value="No">No</option>
        </select>
      );
    }

    if (question.response_type === "dropdown_single") {
      return (
        <select
          value={typeof answer === "string" ? answer : ""}
          onChange={(e) => updateQuestionAnswer(question.id, e.target.value)}
          required={question.is_required}
        >
          <option value="">Select an answer</option>
          {question.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
    }

    if (question.response_type === "dropdown_multi") {
      const selected = Array.isArray(answer) ? answer : [];

      return (
        <div className="space-y-2">
          {question.options.map((option) => (
            <label
              key={option}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--divider-soft)] bg-[var(--cream-background)] px-4 py-3"
            >
              <input
                type="checkbox"
                className="h-4 w-4 shrink-0"
                checked={selected.includes(option)}
                onChange={() => toggleMultiSelectAnswer(question.id, option)}
              />
              <span className="text-sm text-[var(--text-secondary)]">
                {option}
              </span>
            </label>
          ))}
        </div>
      );
    }

    return (
      <textarea
        placeholder="Type your answer"
        value={typeof answer === "string" ? answer : ""}
        onChange={(e) => updateQuestionAnswer(question.id, e.target.value)}
        required={question.is_required}
        className="min-h-28"
      />
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError("");

    if (!form.sms_opt_in) {
      setSubmitError("SMS consent is required to complete onboarding.");
      setSubmitting(false);
      return;
    }

    const missingRequiredAgreement = agreements.some((agreement) => {
      if (!agreement.is_required) return false;

      const accepted = agreementAcceptances.find(
        (item) => item.agreement_id === agreement.id,
      );

      return !accepted?.accepted;
    });

    if (missingRequiredAgreement) {
      setSubmitError("Please accept all required client agreements.");
      setSubmitting(false);
      return;
    }

    if (!validateRequiredQuestions()) {
      setSubmitError("Please answer all required questionnaire items.");
      setSubmitting(false);
      return;
    }

    try {
      const response = await fetch(`/api/onboarding/${token}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...form,
          pets,
          agreements: agreementAcceptances,
          questionnaire: questionAnswers,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to submit onboarding form.");
      }

      router.push("/thank-you");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to submit onboarding form.";
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="site-shell flex min-h-screen items-center justify-center px-4">
        <div className="soft-card w-full max-w-xl p-8 text-center">
          <p className="text-[var(--text-secondary)]">
            Loading onboarding form...
          </p>
        </div>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="site-shell flex min-h-screen items-center justify-center px-4">
        <div className="soft-card w-full max-w-xl p-8 text-center">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">
            Unable to load form
          </h1>
          <p className="mt-3 text-[var(--text-secondary)]">{loadError}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="site-shell min-h-screen px-4 py-10 text-[var(--text-primary)]">
      <div className="mx-auto max-w-4xl">
        <div className="soft-card mb-8 p-6">
          <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={`${businessName} logo`}
                className="h-20 w-20 rounded-xl object-cover ring-1 ring-[var(--divider-soft)]"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-[var(--soft-surface)] text-2xl font-bold text-[var(--text-secondary)] ring-1 ring-[var(--divider-soft)]">
                {businessName ? businessName.charAt(0).toUpperCase() : "G"}
              </div>
            )}

            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--rose-primary)]">
                Customer onboarding
              </p>
              <h1 className="text-3xl font-bold">{businessName}</h1>
              <p className="mt-2 text-[var(--text-secondary)]">
                Please complete your information before your appointment.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="soft-card space-y-8 p-6">
          <section>
            <h2 className="text-xl font-semibold">Owner information</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <input
                placeholder="First name"
                value={form.owner_first_name}
                onChange={(e) =>
                  updateOwnerField("owner_first_name", e.target.value)
                }
                required
              />
              <input
                placeholder="Last name"
                value={form.owner_last_name}
                onChange={(e) =>
                  updateOwnerField("owner_last_name", e.target.value)
                }
                required
              />
              <input
                placeholder="Phone"
                value={form.phone}
                onChange={(e) => updateOwnerField("phone", e.target.value)}
                required
              />
              <input
                placeholder="Email"
                type="email"
                value={form.email}
                onChange={(e) => updateOwnerField("email", e.target.value)}
                required
              />
              <input
                className="sm:col-span-2"
                placeholder="Address line 1"
                value={form.address_line_1}
                onChange={(e) =>
                  updateOwnerField("address_line_1", e.target.value)
                }
                required
              />
              <input
                className="sm:col-span-2"
                placeholder="Address line 2 (optional)"
                value={form.address_line_2}
                onChange={(e) =>
                  updateOwnerField("address_line_2", e.target.value)
                }
              />
              <input
                placeholder="City"
                value={form.city}
                onChange={(e) => updateOwnerField("city", e.target.value)}
                required
              />
              <input
                placeholder="State"
                value={form.state}
                onChange={(e) => updateOwnerField("state", e.target.value)}
                required
              />
              <input
                placeholder="ZIP code"
                value={form.postal_code}
                onChange={(e) =>
                  updateOwnerField("postal_code", e.target.value)
                }
                required
              />
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-semibold">Pet information</h2>
              <button
                type="button"
                onClick={addPet}
                className="secondary-button px-4 py-2 text-sm"
              >
                Add another pet
              </button>
            </div>

            <div className="mt-4 space-y-6">
              {pets.map((pet, index) => (
                <div
                  key={index}
                  className="rounded-[22px] border border-[var(--divider-soft)] bg-[var(--soft-surface)] p-4"
                >
                  <div className="mb-4 flex items-center justify-between gap-4">
                    <h3 className="text-lg font-semibold">Pet {index + 1}</h3>
                    {pets.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removePet(index)}
                        className="rounded-lg border border-[rgba(184,92,114,0.2)] px-3 py-2 text-sm font-medium text-[var(--error-rose)] transition hover:bg-[rgba(184,92,114,0.08)]"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <input
                      placeholder="Pet name"
                      value={pet.pet_name}
                      onChange={(e) =>
                        updatePetField(index, "pet_name", e.target.value)
                      }
                      required
                    />
                    <input
                      placeholder="Breed"
                      value={pet.breed}
                      onChange={(e) =>
                        updatePetField(index, "breed", e.target.value)
                      }
                      required
                    />
                    <input
                      placeholder="Age"
                      value={pet.age}
                      onChange={(e) =>
                        updatePetField(index, "age", e.target.value)
                      }
                      required
                    />
                    <input
                      placeholder="Weight (lbs)"
                      type="number"
                      min="0"
                      step="0.1"
                      value={pet.weight_lbs}
                      onChange={(e) =>
                        updatePetField(index, "weight_lbs", e.target.value)
                      }
                      required
                    />
                    <select
                      value={pet.sex}
                      onChange={(e) =>
                        updatePetField(index, "sex", e.target.value)
                      }
                      required
                    >
                      <option value="">Select sex</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </select>
                    <input
                      placeholder="Temperament"
                      value={pet.temperament}
                      onChange={(e) =>
                        updatePetField(index, "temperament", e.target.value)
                      }
                      required
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {questions.length > 0 ? (
            <section>
              <h2 className="text-xl font-semibold">Questionnaire</h2>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                Please answer the following questions before submitting.
              </p>

              <div className="mt-4 space-y-4">
                {questions.map((question) => (
                  <div
                    key={question.id}
                    className="rounded-[22px] border border-[var(--divider-soft)] bg-[var(--soft-surface)] p-4"
                  >
                    <label className="block">
                      <span className="text-base font-semibold text-[var(--text-primary)]">
                        {question.question_text}
                        {question.is_required ? (
                          <span className="text-[var(--rose-primary)]"> *</span>
                        ) : null}
                      </span>

                      <div className="mt-3">{renderQuestionInput(question)}</div>
                    </label>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {agreements.length > 0 ? (
            <section>
              <h2 className="text-xl font-semibold">Client agreements</h2>
              <div className="mt-4 space-y-4">
                {agreements.map((agreement) => {
                  const accepted =
                    agreementAcceptances.find(
                      (item) => item.agreement_id === agreement.id,
                    )?.accepted ?? false;

                  return (
                    <div
                      key={agreement.id}
                      className="rounded-[22px] border border-[var(--divider-soft)] bg-[var(--soft-surface)] p-4"
                    >
                      {agreement.title ? (
                        <h3 className="text-base font-semibold text-[var(--text-primary)]">
                          {agreement.title}
                        </h3>
                      ) : null}

                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--text-secondary)]">
                        {agreement.agreement_text}
                      </p>

                      <label className="mt-4 inline-flex max-w-full cursor-pointer items-center gap-2 rounded-lg border border-[var(--divider-soft)] bg-[var(--cream-background)] px-4 py-3">
                        <input
                          type="checkbox"
                          className="h-4 w-4 shrink-0"
                          checked={accepted}
                          onChange={(e) =>
                            updateAgreement(agreement.id, e.target.checked)
                          }
                          required={agreement.is_required}
                        />
                        <span className="text-sm leading-5 text-[var(--text-secondary)]">
                          I understand
                          {agreement.is_required ? " (required)" : ""}
                        </span>
                      </label>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          <section>
            <h2 className="text-xl font-semibold">SMS reminders</h2>
            <label className="mt-4 inline-flex max-w-full cursor-pointer items-start gap-2 rounded-lg border border-[var(--divider-soft)] bg-[var(--cream-background)] px-4 py-3">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 shrink-0"
                checked={form.sms_opt_in}
                onChange={(e) =>
                  updateOwnerField("sms_opt_in", e.target.checked)
                }
                required
              />
              <span className="text-sm leading-5 text-[var(--text-secondary)]">
                I agree to receive SMS appointment reminders and updates.
                <span className="font-medium text-[var(--text-primary)]">
                  {" "}
                  This is required to complete onboarding.
                </span>
              </span>
            </label>
          </section>

          {submitError ? (
            <div className="error-banner px-4 py-3 text-sm">{submitError}</div>
          ) : null}

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[var(--text-secondary)]">
              Your information will be used for appointment onboarding.
            </p>
            <button
              type="submit"
              disabled={submitting}
              className="primary-button px-5 py-3"
            >
              {submitting ? "Submitting..." : "Submit onboarding"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}