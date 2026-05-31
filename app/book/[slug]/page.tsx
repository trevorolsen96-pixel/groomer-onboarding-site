"use client";

import Image from "next/image";
import { FormEvent, useEffect, useState } from "react";

type Service = {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number | null;
  base_price: number | null;
};

type Pet = {
  id: string;
  name: string;
  breed: string | null;
};

type GroomerProfile = {
  businessId: string;
  businessName: string | null;
  logoUrl: string | null;
  bookingSlug: string;
  services: Service[];
};

type Step = "email" | "code" | "booking" | "done";

export default function GroomerBookingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const [slug, setSlug] = useState<string | null>(null);
  const [groomer, setGroomer] = useState<GroomerProfile | null>(null);
  const [loadError, setLoadError] = useState("");

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpError, setOtpError] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);

  const [customerId, setCustomerId] = useState<string | null>(null);
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [existingPets, setExistingPets] = useState<Pet[]>([]);
  const [selectedPetIds, setSelectedPetIds] = useState<string[]>([]);
  const [newPetName, setNewPetName] = useState("");
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [requestedDate, setRequestedDate] = useState("");
  const [requestedTime, setRequestedTime] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    params.then((p) => setSlug(p.slug));
  }, [params]);

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/book/${slug}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setLoadError(data.error);
        } else {
          setGroomer(data);
        }
      })
      .catch(() => setLoadError("Failed to load groomer page."));
  }, [slug]);

  async function handleSendOtp(e: FormEvent) {
    e.preventDefault();
    if (!email || !groomer) return;
    setOtpSending(true);
    setOtpError("");

    const res = await fetch("/api/book/otp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, businessId: groomer.businessId }),
    });

    setOtpSending(false);
    if (!res.ok) {
      const d = await res.json();
      setOtpError(d.error ?? "Failed to send code.");
      return;
    }
    setStep("code");
  }

  async function handleVerifyOtp(e: FormEvent) {
    e.preventDefault();
    if (!groomer) return;
    setOtpVerifying(true);
    setOtpError("");

    const res = await fetch("/api/book/otp/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code: otpCode, businessId: groomer.businessId }),
    });

    const data = await res.json();
    setOtpVerifying(false);

    if (!res.ok) {
      setOtpError(data.error ?? "Invalid code.");
      return;
    }

    if (data.customer) {
      setCustomerId(data.customer.id);
      setClientName(data.customer.name ?? "");
      setClientPhone(data.customer.phone ?? "");
      setExistingPets(data.pets ?? []);
    }

    setStep("booking");
  }

  function togglePet(id: string) {
    setSelectedPetIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!groomer) return;

    const petIds = selectedPetIds.length > 0
      ? selectedPetIds
      : newPetName.trim()
      ? [`new:${newPetName.trim()}`]
      : [];

    if (petIds.length === 0) {
      setSubmitError("Please select or enter a pet.");
      return;
    }
    if (!selectedServiceId) {
      setSubmitError("Please select a service.");
      return;
    }
    if (!requestedDate) {
      setSubmitError("Please choose a preferred date.");
      return;
    }

    setSubmitting(true);
    setSubmitError("");

    const res = await fetch("/api/book/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessId: groomer.businessId,
        customerId,
        petIds,
        serviceId: selectedServiceId,
        requestedDate,
        requestedTime: requestedTime || null,
        clientName,
        clientEmail: email,
        clientPhone,
      }),
    });

    setSubmitting(false);

    if (!res.ok) {
      const d = await res.json();
      setSubmitError(d.error ?? "Failed to submit request.");
      return;
    }

    setStep("done");
  }

  if (loadError) {
    return (
      <main className="site-shell">
        <section className="mx-auto max-w-lg px-6 py-20 text-center">
          <p className="text-lg font-bold text-[var(--text-primary)]">Page not available</p>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">{loadError}</p>
        </section>
      </main>
    );
  }

  if (!groomer) {
    return (
      <main className="site-shell">
        <section className="mx-auto max-w-lg px-6 py-20 text-center">
          <p className="text-[var(--text-secondary)]">Loading...</p>
        </section>
      </main>
    );
  }

  return (
    <main className="site-shell">
      <section className="mx-auto max-w-lg px-6 py-12">

        {/* Groomer header */}
        <div className="mb-8 flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[var(--soft-surface)]">
            {groomer.logoUrl ? (
              <Image
                src={groomer.logoUrl}
                alt={groomer.businessName ?? "Groomer"}
                width={64}
                height={64}
                className="h-16 w-16 object-cover"
              />
            ) : (
              <span className="text-3xl">🐾</span>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--rose-primary)]">
              Online Booking
            </p>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">
              {groomer.businessName ?? "Wagzly Groomer"}
            </h1>
          </div>
        </div>

        {/* Step: email */}
        {step === "email" && (
          <div className="soft-card p-7">
            <h2 className="text-lg font-bold text-[var(--text-primary)]">
              Let&apos;s get started
            </h2>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              Enter your email address. We&apos;ll send you a quick code to verify it&apos;s you and check if you&apos;re an existing client.
            </p>
            <form onSubmit={handleSendOtp} className="mt-6 space-y-4">
              <div>
                <label className="text-sm font-semibold text-[var(--text-primary)]">
                  Email address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setOtpError(""); }}
                  placeholder="name@email.com"
                  required
                  className="mt-2"
                />
              </div>
              {otpError ? (
                <p className="error-banner px-4 py-3 text-sm font-semibold">{otpError}</p>
              ) : null}
              <button type="submit" disabled={otpSending} className="primary-button w-full">
                {otpSending ? "Sending code..." : "Send verification code"}
              </button>
            </form>
          </div>
        )}

        {/* Step: OTP code */}
        {step === "code" && (
          <div className="soft-card p-7">
            <h2 className="text-lg font-bold text-[var(--text-primary)]">
              Check your email
            </h2>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              We sent a 6-digit code to <strong>{email}</strong>. Enter it below — it expires in 10 minutes.
            </p>
            <form onSubmit={handleVerifyOtp} className="mt-6 space-y-4">
              <div>
                <label className="text-sm font-semibold text-[var(--text-primary)]">
                  Verification code
                </label>
                <input
                  value={otpCode}
                  onChange={(e) => { setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setOtpError(""); }}
                  placeholder="123456"
                  className="mt-2 text-center text-xl tracking-widest font-bold"
                  maxLength={6}
                />
              </div>
              {otpError ? (
                <p className="error-banner px-4 py-3 text-sm font-semibold">{otpError}</p>
              ) : null}
              <button type="submit" disabled={otpVerifying || otpCode.length < 6} className="primary-button w-full">
                {otpVerifying ? "Verifying..." : "Continue"}
              </button>
              <button
                type="button"
                onClick={() => { setStep("email"); setOtpCode(""); setOtpError(""); }}
                className="w-full text-center text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                Use a different email
              </button>
            </form>
          </div>
        )}

        {/* Step: booking details */}
        {step === "booking" && (
          <form onSubmit={handleSubmit} className="soft-card space-y-6 p-7">
            <div>
              <h2 className="text-lg font-bold text-[var(--text-primary)]">
                {customerId ? "Welcome back!" : "Tell us about yourself"}
              </h2>
              {customerId ? (
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  We found your profile. Select your pet(s) and pick a service below.
                </p>
              ) : (
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  You&apos;re not yet a client of this groomer — fill in a few details and they&apos;ll set you up when they confirm your booking.
                </p>
              )}
            </div>

            {/* Name + phone (shown for new clients or pre-filled for existing) */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-semibold text-[var(--text-primary)]">Your name</label>
                <input
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Your name"
                  required
                  className="mt-2"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-[var(--text-primary)]">Phone (optional)</label>
                <input
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  placeholder="(555) 555-5555"
                  className="mt-2"
                />
              </div>
            </div>

            {/* Pets */}
            <div>
              <label className="text-sm font-semibold text-[var(--text-primary)]">
                {existingPets.length > 0 ? "Select pet(s)" : "Pet name"}
              </label>
              {existingPets.length > 0 ? (
                <div className="mt-2 space-y-2">
                  {existingPets.map((pet) => (
                    <label
                      key={pet.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-3.5 transition ${
                        selectedPetIds.includes(pet.id)
                          ? "border-[var(--rose-primary)] bg-[var(--soft-surface)]"
                          : "border-[var(--divider-soft)] bg-white"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedPetIds.includes(pet.id)}
                        onChange={() => togglePet(pet.id)}
                      />
                      <span className="font-semibold text-[var(--text-primary)]">{pet.name}</span>
                      {pet.breed ? (
                        <span className="text-sm text-[var(--text-secondary)]">{pet.breed}</span>
                      ) : null}
                    </label>
                  ))}
                </div>
              ) : (
                <input
                  value={newPetName}
                  onChange={(e) => setNewPetName(e.target.value)}
                  placeholder="Your pet's name"
                  className="mt-2"
                />
              )}
            </div>

            {/* Service */}
            <div>
              <label className="text-sm font-semibold text-[var(--text-primary)]">Service</label>
              <div className="mt-2 space-y-2">
                {groomer.services.map((svc) => (
                  <label
                    key={svc.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3.5 transition ${
                      selectedServiceId === svc.id
                        ? "border-[var(--rose-primary)] bg-[var(--soft-surface)]"
                        : "border-[var(--divider-soft)] bg-white"
                    }`}
                  >
                    <input
                      type="radio"
                      name="service"
                      value={svc.id}
                      checked={selectedServiceId === svc.id}
                      onChange={() => setSelectedServiceId(svc.id)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <span className="font-semibold text-[var(--text-primary)]">{svc.name}</span>
                      {svc.description ? (
                        <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{svc.description}</p>
                      ) : null}
                    </div>
                    {svc.base_price != null ? (
                      <span className="shrink-0 text-sm font-bold text-[var(--text-primary)]">
                        ${svc.base_price.toFixed(2)}
                      </span>
                    ) : null}
                  </label>
                ))}
                {groomer.services.length === 0 ? (
                  <p className="text-sm text-[var(--text-secondary)]">
                    This groomer hasn&apos;t listed services yet. Submit a general request and they&apos;ll follow up.
                  </p>
                ) : null}
              </div>
            </div>

            {/* Date + time */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-semibold text-[var(--text-primary)]">
                  Preferred date
                </label>
                <input
                  type="date"
                  value={requestedDate}
                  onChange={(e) => setRequestedDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                  required
                  className="mt-2"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-[var(--text-primary)]">
                  Preferred time (optional)
                </label>
                <input
                  type="time"
                  value={requestedTime}
                  onChange={(e) => setRequestedTime(e.target.value)}
                  className="mt-2"
                />
              </div>
            </div>

            {submitError ? (
              <p className="error-banner px-4 py-3 text-sm font-semibold">{submitError}</p>
            ) : null}

            <button type="submit" disabled={submitting} className="primary-button w-full">
              {submitting ? "Submitting..." : "Request appointment"}
            </button>

            <p className="text-center text-xs text-[var(--text-secondary)]">
              This is a request, not a confirmed booking. The groomer will confirm, suggest a different time, or reach out.
            </p>
          </form>
        )}

        {/* Step: done */}
        {step === "done" && (
          <div className="soft-card p-8 text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--soft-surface)]">
              <span className="text-3xl">🐾</span>
            </div>
            <h2 className="text-xl font-bold text-[var(--text-primary)]">Request sent!</h2>
            <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
              Your booking request has been sent to{" "}
              <strong>{groomer.businessName ?? "your groomer"}</strong>. They&apos;ll review it and reach out to confirm or adjust the time.
            </p>
            <p className="mt-4 text-sm text-[var(--text-secondary)]">
              We&apos;ll be in touch at <strong>{email}</strong>.
            </p>
          </div>
        )}

      </section>
    </main>
  );
}
