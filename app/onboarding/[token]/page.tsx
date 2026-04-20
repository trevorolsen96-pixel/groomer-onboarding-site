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

type BrandingResponse = {
  request_id: string;
  business_name: string;
  logo_url: string | null;
  status: string;
  agreements: Agreement[];
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
        setAgreementAcceptances(
          (result.agreements ?? []).map((agreement) => ({
            agreement_id: agreement.id,
            accepted: false,
          }))
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
        item.agreement_id === agreementId ? { ...item, accepted } : item
      )
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
        (item) => item.agreement_id === agreement.id
      );

      return !accepted?.accepted;
    });

    if (missingRequiredAgreement) {
      setSubmitError("Please accept all required client agreements.");
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
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <p className="text-slate-600">Loading onboarding form...</p>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-xl rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <h1 className="text-2xl font-bold text-slate-900">
            Unable to load form
          </h1>
          <p className="mt-3 text-slate-600">{loadError}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={`${businessName} logo`}
                className="h-20 w-20 rounded-xl object-cover ring-1 ring-slate-200"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-slate-100 text-2xl font-bold text-slate-500 ring-1 ring-slate-200">
                {businessName ? businessName.charAt(0).toUpperCase() : "G"}
              </div>
            )}

            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-700">
                Customer onboarding
              </p>
              <h1 className="text-3xl font-bold">{businessName}</h1>
              <p className="mt-2 text-slate-600">
                Please complete your information before your appointment.
              </p>
            </div>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-8 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200"
        >
          <section>
            <h2 className="text-xl font-semibold">Owner information</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <input
                className="rounded-xl border border-slate-300 px-4 py-3"
                placeholder="First name"
                value={form.owner_first_name}
                onChange={(e) =>
                  updateOwnerField("owner_first_name", e.target.value)
                }
                required
              />
              <input
                className="rounded-xl border border-slate-300 px-4 py-3"
                placeholder="Last name"
                value={form.owner_last_name}
                onChange={(e) =>
                  updateOwnerField("owner_last_name", e.target.value)
                }
                required
              />
              <input
                className="rounded-xl border border-slate-300 px-4 py-3"
                placeholder="Phone"
                value={form.phone}
                onChange={(e) => updateOwnerField("phone", e.target.value)}
                required
              />
              <input
                className="rounded-xl border border-slate-300 px-4 py-3"
                placeholder="Email"
                type="email"
                value={form.email}
                onChange={(e) => updateOwnerField("email", e.target.value)}
                required
              />
              <input
                className="sm:col-span-2 rounded-xl border border-slate-300 px-4 py-3"
                placeholder="Address line 1"
                value={form.address_line_1}
                onChange={(e) =>
                  updateOwnerField("address_line_1", e.target.value)
                }
                required
              />
              <input
                className="sm:col-span-2 rounded-xl border border-slate-300 px-4 py-3"
                placeholder="Address line 2 (optional)"
                value={form.address_line_2}
                onChange={(e) =>
                  updateOwnerField("address_line_2", e.target.value)
                }
              />
              <input
                className="rounded-xl border border-slate-300 px-4 py-3"
                placeholder="City"
                value={form.city}
                onChange={(e) => updateOwnerField("city", e.target.value)}
                required
              />
              <input
                className="rounded-xl border border-slate-300 px-4 py-3"
                placeholder="State"
                value={form.state}
                onChange={(e) => updateOwnerField("state", e.target.value)}
                required
              />
              <input
                className="rounded-xl border border-slate-300 px-4 py-3"
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
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              >
                Add another pet
              </button>
            </div>

            <div className="mt-4 space-y-6">
              {pets.map((pet, index) => (
                <div
                  key={index}
                  className="rounded-2xl border border-slate-200 p-4"
                >
                  <div className="mb-4 flex items-center justify-between gap-4">
                    <h3 className="text-lg font-semibold">Pet {index + 1}</h3>
                    {pets.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removePet(index)}
                        className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <input
                      className="rounded-xl border border-slate-300 px-4 py-3"
                      placeholder="Pet name"
                      value={pet.pet_name}
                      onChange={(e) =>
                        updatePetField(index, "pet_name", e.target.value)
                      }
                      required
                    />
                    <input
                      className="rounded-xl border border-slate-300 px-4 py-3"
                      placeholder="Breed"
                      value={pet.breed}
                      onChange={(e) =>
                        updatePetField(index, "breed", e.target.value)
                      }
                      required
                    />
                    <input
                      className="rounded-xl border border-slate-300 px-4 py-3"
                      placeholder="Age"
                      value={pet.age}
                      onChange={(e) =>
                        updatePetField(index, "age", e.target.value)
                      }
                      required
                    />
                    <input
                      className="rounded-xl border border-slate-300 px-4 py-3"
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
                      className="rounded-xl border border-slate-300 px-4 py-3"
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
                      className="rounded-xl border border-slate-300 px-4 py-3"
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

          {agreements.length > 0 ? (
            <section>
              <h2 className="text-xl font-semibold">Client agreements</h2>
              <div className="mt-4 space-y-4">
                {agreements.map((agreement) => {
                  const accepted =
                    agreementAcceptances.find(
                      (item) => item.agreement_id === agreement.id
                    )?.accepted ?? false;

                  return (
                    <div
                      key={agreement.id}
                      className="rounded-2xl border border-slate-200 p-4"
                    >
                      {agreement.title ? (
                        <h3 className="text-base font-semibold text-slate-900">
                          {agreement.title}
                        </h3>
                      ) : null}

                      <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                        {agreement.agreement_text}
                      </p>

                      <label className="mt-4 flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4"
                          checked={accepted}
                          onChange={(e) =>
                            updateAgreement(agreement.id, e.target.checked)
                          }
                          required={agreement.is_required}
                        />
                        <span className="text-sm text-slate-700">
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
            <label className="mt-4 flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4"
                checked={form.sms_opt_in}
                onChange={(e) =>
                  updateOwnerField("sms_opt_in", e.target.checked)
                }
                required
              />
              <span className="text-sm text-slate-700">
                I agree to receive SMS appointment reminders and updates.
                <span className="font-medium">
                  {" "}
                  This is required to complete onboarding.
                </span>
              </span>
            </label>
          </section>

          {submitError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {submitError}
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-slate-500">
              Your information will be used for appointment onboarding.
            </p>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-teal-600 px-5 py-3 font-medium text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting ? "Submitting..." : "Submit onboarding"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}