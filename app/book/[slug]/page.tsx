"use client";

import React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
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
  phone: string | null;
  website: string | null;
  facebook: string | null;
  instagram: string | null;
  address: string | null;
  accentColor: string | null;
  services: Service[];
};

type BusinessHour = {
  dayOfWeek: number; // 1=Mon...7=Sun
  isOpen: boolean;
  startTime: string | null;
  endTime: string | null;
};

type TimeBlock = {
  reason: string;
  allDay: boolean;
  startTime: string | null;
  endTime: string | null;
  startDate: string;
  endDate: string | null;
  isRecurring: boolean;
  recurrenceDays: number[]; // 1=Mon...7=Sun
};

type Availability = {
  hours: BusinessHour[];
  closedDates: string[];
  timeBlocks: TimeBlock[];
};

type Step = "email" | "code" | "booking" | "done";

export default function GroomerBookingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const router = useRouter();
  const [slug, setSlug] = useState<string | null>(null);
  const [groomer, setGroomer] = useState<GroomerProfile | null>(null);
  const [loadError, setLoadError] = useState("");

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpError, setOtpError] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);

  const [otpId, setOtpId] = useState<string | null>(null);
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
  const [availability, setAvailability] = useState<Availability | null>(null);

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

    fetch(`/api/book/${slug}/availability`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) setAvailability(data);
      })
      .catch(() => {});
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
      setOtpId(data.otpId ?? null);
      setCustomerId(data.customer.id);
      setClientName(data.customer.name ?? "");
      setClientPhone(data.customer.phone ?? "");
      setExistingPets(data.pets ?? []);
      setStep("booking");
    } else {
      // New client — redirect to groomer's onboarding form
      const tokenRes = await fetch("/api/book/onboarding-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: groomer!.businessId, clientEmail: email }),
      });
      const tokenData = await tokenRes.json();
      if (!tokenRes.ok || !tokenData.token) {
        setOtpError("Failed to start onboarding. Please try again.");
        return;
      }
      router.push(`/onboarding/${tokenData.token}`);
    }
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
        otpId,
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

  // Inject accent color as CSS variable override if set
  const accentStyle = groomer.accentColor
    ? ({ "--rose-primary": groomer.accentColor, "--rose-primary-dark": groomer.accentColor } as React.CSSProperties)
    : undefined;

  return (
    <main className="site-shell" style={accentStyle}>
      <section className="mx-auto max-w-lg px-6 py-12">

        {/* Groomer header */}
        <div className="mb-8">
          <div className="flex items-center gap-4">
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

          {/* Contact info — only renders fields that are set */}
          {(groomer.phone || groomer.address || groomer.website || groomer.instagram || groomer.facebook) ? (
            <div className="mt-4 flex flex-wrap gap-3">
              {groomer.phone ? (
                <a
                  href={`tel:${groomer.phone}`}
                  className="flex items-center gap-1.5 rounded-full bg-[var(--soft-surface)] px-3.5 py-1.5 text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--divider-soft)] transition"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0 text-[var(--rose-primary)]">
                    <path fillRule="evenodd" d="M2 3.5A1.5 1.5 0 0 1 3.5 2h1.148a1.5 1.5 0 0 1 1.465 1.175l.716 3.223a1.5 1.5 0 0 1-1.052 1.767l-.933.267c-.41.117-.643.555-.48.95a11.542 11.542 0 0 0 6.254 6.254c.395.163.833-.07.95-.48l.267-.933a1.5 1.5 0 0 1 1.767-1.052l3.223.716A1.5 1.5 0 0 1 18 15.352V16.5a1.5 1.5 0 0 1-1.5 1.5H15c-1.149 0-2.263-.15-3.326-.43A13.022 13.022 0 0 1 2.43 8.326 13.019 13.019 0 0 1 2 5V3.5Z" clipRule="evenodd" />
                  </svg>
                  {groomer.phone}
                </a>
              ) : null}

              {groomer.address ? (
                <span className="flex items-center gap-1.5 rounded-full bg-[var(--soft-surface)] px-3.5 py-1.5 text-sm font-semibold text-[var(--text-primary)]">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0 text-[var(--rose-primary)]">
                    <path fillRule="evenodd" d="m9.69 18.933.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 0 0 .281-.14c.186-.096.446-.24.757-.433.62-.384 1.445-.966 2.274-1.765C15.302 14.988 17 12.493 17 9A7 7 0 1 0 3 9c0 3.492 1.698 5.988 3.355 7.584a13.731 13.731 0 0 0 2.273 1.765 11.842 11.842 0 0 0 .937.527l.02.008.007.003ZM10 11.25a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5Z" clipRule="evenodd" />
                  </svg>
                  {groomer.address}
                </span>
              ) : null}

              {groomer.website ? (
                <a
                  href={groomer.website.startsWith("http") ? groomer.website : `https://${groomer.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-full bg-[var(--soft-surface)] px-3.5 py-1.5 text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--divider-soft)] transition"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0 text-[var(--rose-primary)]">
                    <path d="M10 1a9 9 0 1 0 0 18A9 9 0 0 0 10 1ZM6.94 5.5a14.18 14.18 0 0 0-.4 1.5H4.62a7.522 7.522 0 0 1 2.32-1.5ZM4.062 8.5h2.21a17.476 17.476 0 0 0-.172 1.5H3.798a7.48 7.48 0 0 1 .264-1.5ZM3.798 11.5h2.302c.028.508.085 1.012.172 1.5H4.062a7.48 7.48 0 0 1-.264-1.5ZM4.62 14.5h1.92c.12.534.265 1.034.44 1.5A7.522 7.522 0 0 1 4.62 14.5ZM9.25 15.698A10.627 10.627 0 0 1 8 14.5h2.5a10.627 10.627 0 0 1-1.25 1.198ZM8 5.5h4a10.63 10.63 0 0 1 .898 1.5H7.102A10.63 10.63 0 0 1 8 5.5ZM7.102 8.5h5.796c.1.49.163.993.18 1.5H6.922c.017-.507.08-1.01.18-1.5ZM6.922 11.5h6.156c-.017.507-.08 1.01-.18 1.5H7.102a14.6 14.6 0 0 1-.18-1.5ZM7.102 14.5H12.9A10.63 10.63 0 0 1 12 16h-4a10.63 10.63 0 0 1-.898-1.5ZM13.06 16c.175-.466.32-.966.44-1.5h1.92a7.522 7.522 0 0 1-2.36 1.5ZM15.938 13h-2.21a17.56 17.56 0 0 0 .172-1.5h2.302a7.48 7.48 0 0 1-.264 1.5ZM16.202 10h-2.104a17.476 17.476 0 0 0-.172-1.5h2.21a7.48 7.48 0 0 1 .066 1.5Zm-2.276-3h-1.86a12.207 12.207 0 0 0-.44-1.5A7.522 7.522 0 0 1 13.926 7Z" />
                  </svg>
                  Website
                </a>
              ) : null}

              {groomer.instagram ? (
                <a
                  href={`https://instagram.com/${groomer.instagram.replace(/^@/, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-full bg-[var(--soft-surface)] px-3.5 py-1.5 text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--divider-soft)] transition"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 shrink-0 text-[var(--rose-primary)]">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069Zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073Zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324ZM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881Z"/>
                  </svg>
                  Instagram
                </a>
              ) : null}

              {groomer.facebook ? (
                <a
                  href={groomer.facebook.startsWith("http") ? groomer.facebook : `https://facebook.com/${groomer.facebook}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-full bg-[var(--soft-surface)] px-3.5 py-1.5 text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--divider-soft)] transition"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 shrink-0 text-[var(--rose-primary)]">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073Z"/>
                  </svg>
                  Facebook
                </a>
              ) : null}
            </div>
          ) : null}
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
            <DateTimePicker
              availability={availability}
              slug={slug!}
              selectedServiceId={selectedServiceId}
              selectedDate={requestedDate}
              selectedTime={requestedTime}
              onDateChange={(d) => { setRequestedDate(d); setRequestedTime(""); }}
              onTimeChange={setRequestedTime}
            />

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

// ── Date/time picker with business hours + live slot availability ────

function DateTimePicker({
  availability,
  slug,
  selectedServiceId,
  selectedDate,
  selectedTime,
  onDateChange,
  onTimeChange,
}: {
  availability: Availability | null;
  slug: string;
  selectedServiceId: string;
  selectedDate: string;
  selectedTime: string;
  onDateChange: (d: string) => void;
  onTimeChange: (t: string) => void;
}) {
  const [slots, setSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState("");

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // JS getDay(): 0=Sun,1=Mon...6=Sat → Flutter convention 1=Mon...7=Sun
  function jsToFlutterDay(jsDay: number): number {
    return jsDay === 0 ? 7 : jsDay;
  }

  function blocksForDate(dateStr: string): TimeBlock[] {
    if (!availability) return [];
    const flutterDay = jsToFlutterDay(new Date(dateStr + "T12:00:00").getDay());
    return availability.timeBlocks.filter((b) => {
      if (b.isRecurring) {
        if (dateStr < b.startDate) return false;
        if (b.endDate && dateStr > b.endDate) return false;
        return b.recurrenceDays.includes(flutterDay);
      } else {
        const end = b.endDate ?? b.startDate;
        return dateStr >= b.startDate && dateStr <= end;
      }
    });
  }

  function isDateAvailable(dateStr: string): boolean {
    if (!availability) return true;
    const d = new Date(dateStr + "T12:00:00");
    if (d < today) return false;
    if (availability.closedDates.includes(dateStr)) return false;
    const flutterDay = jsToFlutterDay(d.getDay());
    const hour = availability.hours.find((h) => h.dayOfWeek === flutterDay);
    if (hour?.isOpen !== true) return false;
    if (blocksForDate(dateStr).some((b) => b.allDay)) return false;
    return true;
  }

  // Build next 60 days, filter to available ones
  const availableDates: string[] = [];
  for (let i = 0; i < 60; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const str = d.toISOString().split("T")[0];
    if (isDateAvailable(str)) availableDates.push(str);
  }

  // Fetch available slots whenever date or service changes
  useEffect(() => {
    if (!selectedDate || !selectedServiceId) {
      setSlots([]);
      return;
    }
    let cancelled = false;
    setSlotsLoading(true);
    setSlotsError("");
    fetch(`/api/book/slots?slug=${slug}&date=${selectedDate}&serviceId=${selectedServiceId}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) {
          setSlotsError(data.error);
          setSlots([]);
        } else {
          setSlots(data.slots ?? []);
        }
      })
      .catch(() => {
        if (!cancelled) setSlotsError("Couldn't load available times.");
      })
      .finally(() => {
        if (!cancelled) setSlotsLoading(false);
      });
    return () => { cancelled = true; };
  }, [selectedDate, selectedServiceId, slug]);

  function formatTime(t: string): string {
    const [h, m] = t.split(":").map(Number);
    const ampm = h < 12 ? "AM" : "PM";
    const hour = h % 12 === 0 ? 12 : h % 12;
    return `${hour}:${m.toString().padStart(2, "0")} ${ampm}`;
  }

  function formatDateLabel(str: string): string {
    const d = new Date(str + "T12:00:00");
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-semibold text-[var(--text-primary)]">
          Preferred date
        </label>
        <select
          value={selectedDate}
          onChange={(e) => onDateChange(e.target.value)}
          required
          className="mt-2"
        >
          <option value="">Select a date</option>
          {availableDates.map((d) => (
            <option key={d} value={d}>{formatDateLabel(d)}</option>
          ))}
        </select>
        {availableDates.length === 0 && availability ? (
          <p className="mt-2 text-xs text-[var(--rose-primary)] font-semibold">
            No available dates in the next 60 days. Please contact the groomer directly.
          </p>
        ) : null}
      </div>

      {selectedDate && selectedServiceId ? (
        <div>
          <label className="text-sm font-semibold text-[var(--text-primary)]">
            Preferred time
          </label>
          {slotsLoading ? (
            <p className="mt-2 text-sm text-[var(--text-secondary)]">Loading available times…</p>
          ) : slotsError ? (
            <p className="mt-2 text-sm text-[var(--rose-primary)] font-semibold">{slotsError}</p>
          ) : slots.length > 0 ? (
            <select
              value={selectedTime}
              onChange={(e) => onTimeChange(e.target.value)}
              className="mt-2"
            >
              <option value="">Select a time</option>
              {slots.map((t) => (
                <option key={t} value={t}>{formatTime(t)}</option>
              ))}
            </select>
          ) : (
            <p className="mt-2 text-sm text-[var(--rose-primary)] font-semibold">
              No available times on this date. Try a different day.
            </p>
          )}
        </div>
      ) : selectedDate && !selectedServiceId ? (
        <p className="text-sm text-[var(--text-secondary)]">
          Select a service above to see available times.
        </p>
      ) : null}
    </div>
  );
}
