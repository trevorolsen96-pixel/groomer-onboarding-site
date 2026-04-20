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
};

type AgreementAcceptance = {
  agreement_id: string;
  accepted: boolean;
};

type BrandingResponse = {
  request_id: string;
  business_name: string;
  logo_url: string | null;
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
    async function loadData() {
      try {
        setLoading(true);
        const res = await fetch(`/api/onboarding/${token}`);
        const data: BrandingResponse = await res.json();

        if (!res.ok) throw new Error(data.error);

        setBusinessName(data.business_name);
        setLogoUrl(data.logo_url);
        setAgreements(data.agreements || []);
        setAgreementAcceptances(
          (data.agreements || []).map((a) => ({
            agreement_id: a.id,
            accepted: false,
          }))
        );
      } catch (err: any) {
        setLoadError(err.message || "Failed to load");
      } finally {
        setLoading(false);
      }
    }

    if (token) loadData();
  }, [token]);

  function updateOwnerField(key: string, value: any) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updatePet(index: number, key: keyof PetForm, value: string) {
    const updated = [...pets];
    updated[index][key] = value;
    setPets(updated);
  }

  function updateAgreement(id: string, accepted: boolean) {
    setAgreementAcceptances((prev) =>
      prev.map((a) =>
        a.agreement_id === id ? { ...a, accepted } : a
      )
    );
  }

  function addPet() {
    setPets([...pets, emptyPet()]);
  }

  function removePet(index: number) {
    if (pets.length === 1) return;
    setPets(pets.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError("");

    try {
      const res = await fetch(`/api/onboarding/${token}`, {
        method: "POST",
        body: JSON.stringify({
          ...form,
          pets,
          agreements: agreementAcceptances,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      router.push("/thank-you");
    } catch (err: any) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="p-10 text-center">Loading...</div>;
  if (loadError) return <div className="p-10 text-center">{loadError}</div>;

  return (
    <main className="site-shell min-h-screen px-4 py-10">
      <div className="mx-auto max-w-4xl space-y-6">

        {/* HEADER */}
        <div className="soft-card p-6 text-center">
          {logoUrl && (
            <img src={logoUrl} className="mx-auto mb-4 h-16 rounded-xl" />
          )}
          <h1 className="text-2xl font-bold">{businessName}</h1>
          <p className="text-sm text-[var(--text-secondary)]">
            Please complete your onboarding before your appointment.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="soft-card space-y-8 p-6">

          {/* OWNER */}
          <section>
            <h2 className="text-lg font-semibold">Owner Information</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <input placeholder="First name" required
                value={form.owner_first_name}
                onChange={(e) => updateOwnerField("owner_first_name", e.target.value)}
              />
              <input placeholder="Last name" required
                value={form.owner_last_name}
                onChange={(e) => updateOwnerField("owner_last_name", e.target.value)}
              />
              <input placeholder="Phone" required
                value={form.phone}
                onChange={(e) => updateOwnerField("phone", e.target.value)}
              />
              <input placeholder="Email" required
                value={form.email}
                onChange={(e) => updateOwnerField("email", e.target.value)}
              />
            </div>
          </section>

          {/* PETS */}
          <section>
            <div className="flex justify-between">
              <h2 className="text-lg font-semibold">Pets</h2>
              <button type="button" onClick={addPet} className="secondary-button">
                Add Pet
              </button>
            </div>

            {pets.map((pet, i) => (
              <div key={i} className="soft-section mt-4 p-4">
                <div className="flex justify-between mb-3">
                  <strong>Pet {i + 1}</strong>
                  {pets.length > 1 && (
                    <button onClick={() => removePet(i)}>Remove</button>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <input placeholder="Name"
                    value={pet.pet_name}
                    onChange={(e) => updatePet(i, "pet_name", e.target.value)}
                  />
                  <input placeholder="Breed"
                    value={pet.breed}
                    onChange={(e) => updatePet(i, "breed", e.target.value)}
                  />
                </div>
              </div>
            ))}
          </section>

          {/* AGREEMENTS */}
          <section>
            <h2 className="text-lg font-semibold">Client Agreements</h2>

            {agreements.map((a) => {
              const accepted =
                agreementAcceptances.find(x => x.agreement_id === a.id)?.accepted || false;

              return (
                <div key={a.id} className="soft-section mt-4 p-4">
                  <h3 className="font-semibold">{a.title}</h3>
                  <p className="text-sm text-[var(--text-secondary)] mt-2">
                    {a.agreement_text}
                  </p>

                  <label className="mt-4 flex items-center rounded-xl border bg-white px-4 py-3">
                    <input
                      type="checkbox"
                      className="mr-3 h-4 w-4 accent-[var(--rose-primary)]"
                      checked={accepted}
                      onChange={(e) => updateAgreement(a.id, e.target.checked)}
                    />
                    <span className="text-sm text-[var(--text-secondary)]">
                      I understand {a.is_required && "(required)"}
                    </span>
                  </label>
                </div>
              );
            })}
          </section>

          {/* SMS */}
          <section>
            <h2 className="text-lg font-semibold">SMS Reminders</h2>

            <label className="mt-4 flex items-center rounded-xl border bg-[var(--soft-surface)] px-4 py-3">
              <input
                type="checkbox"
                className="mr-3 h-4 w-4 accent-[var(--rose-primary)]"
                checked={form.sms_opt_in}
                onChange={(e) => updateOwnerField("sms_opt_in", e.target.checked)}
              />
              <span className="text-sm text-[var(--text-secondary)]">
                I agree to receive SMS reminders (required)
              </span>
            </label>
          </section>

          {submitError && (
            <div className="error-banner">{submitError}</div>
          )}

          <button type="submit" className="primary-button w-full">
            {submitting ? "Submitting..." : "Submit"}
          </button>

        </form>
      </div>
    </main>
  );
}
