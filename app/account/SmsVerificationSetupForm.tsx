"use client";

import { useState } from "react";
import { supabaseClient } from "../../lib/supabase-client";

type Props = {
  defaultBusinessName?: string | null;
  defaultBusinessPhone?: string | null;
  defaultBusinessWebsite?: string | null;
  defaultContactName?: string | null;
  onSaved: () => void;
};

export default function SmsVerificationSetupForm({
  defaultBusinessName,
  defaultBusinessPhone,
  defaultBusinessWebsite,
  defaultContactName,
  onSaved,
}: Props) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [legalBusinessName, setLegalBusinessName] = useState(defaultBusinessName ?? "");
  const [dbaName, setDbaName] = useState(defaultBusinessName ?? "");
  const [businessPhone, setBusinessPhone] = useState(defaultBusinessPhone ?? "");
  const [businessEmail, setBusinessEmail] = useState("");
  const [businessWebsite, setBusinessWebsite] = useState(defaultBusinessWebsite ?? "");

  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [stateValue, setStateValue] = useState("");
  const [postalCode, setPostalCode] = useState("");

  const [contactName, setContactName] = useState(defaultContactName ?? "");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState(defaultBusinessPhone ?? "");

  const [businessRegistrationNumber, setBusinessRegistrationNumber] = useState("");
  const [businessType, setBusinessType] = useState("sole_proprietor");

  const [optInDescription, setOptInDescription] = useState(
    "Customers provide their phone number through Wagzly-powered onboarding, booking, client intake, or direct communication with the grooming business. Messages are used for appointment reminders, onboarding links, scheduling updates, and direct client communication."
  );

  const [sampleMessage1, setSampleMessage1] = useState(
    "Hi {{customer_name}}, this is {{business_name}}. Your grooming appointment is scheduled for {{appointment_date}} at {{appointment_time}}. Reply STOP to opt out."
  );

  const [sampleMessage2, setSampleMessage2] = useState(
    "Hi {{customer_name}}, here is your secure Wagzly onboarding link for {{business_name}}: {{onboarding_link}}. Reply STOP to opt out."
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const { data } = await supabaseClient.auth.getSession();
      const token = data.session?.access_token ?? "";

      const response = await fetch("/api/sms/verification-profile", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          legalBusinessName,
          dbaName,
          businessPhone,
          businessEmail,
          businessWebsite,
          addressLine1,
          addressLine2,
          city,
          state: stateValue,
          postalCode,
          contactName,
          contactEmail,
          contactPhone,
          businessRegistrationNumber,
          businessType,
          optInDescription,
          sampleMessage1,
          sampleMessage2,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "Unable to save messaging setup.");
      }

      setSuccess(
        "Messaging setup saved. Wagzly is preparing your dedicated texting number."
      );
      onSaved();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to save messaging setup."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error ? (
        <div className="rounded-2xl bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="rounded-2xl bg-green-50 px-5 py-4 text-sm font-semibold text-green-700">
          {success}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Legal business name"
          value={legalBusinessName}
          onChange={setLegalBusinessName}
          required
        />

        <Field
          label="DBA / public business name"
          value={dbaName}
          onChange={setDbaName}
        />

        <Field
          label="Business phone"
          value={businessPhone}
          onChange={setBusinessPhone}
          required
        />

        <Field
          label="Business email"
          value={businessEmail}
          onChange={setBusinessEmail}
          required
        />

        <Field
          label="Website or public business page"
          value={businessWebsite}
          onChange={setBusinessWebsite}
          required
          helperText="Use a full link starting with https:// or http://. If you do not have a website, use an official Facebook Business Page, Yelp page, Google Business Profile, or another public business listing. If you do not have one yet, create one before submitting messaging setup or verification may fail."
        />

        <SelectField
          label="Business type"
          value={businessType}
          onChange={setBusinessType}
          options={[
            { value: "sole_proprietor", label: "Sole Proprietor" },
            { value: "private_profit", label: "Private Profit" },
            { value: "public_profit", label: "Public Profit" },
            { value: "non_profit", label: "Non Profit" },
            { value: "government", label: "Government" },
          ]}
        />
      </div>

      <div>
        <h3 className="text-lg font-bold text-[var(--text-primary)]">
          Business address
        </h3>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Address line 1" value={addressLine1} onChange={setAddressLine1} required />
          <Field label="Address line 2" value={addressLine2} onChange={setAddressLine2} />
          <Field label="City" value={city} onChange={setCity} required />
          <Field label="State" value={stateValue} onChange={setStateValue} required />
          <Field label="ZIP code" value={postalCode} onChange={setPostalCode} required />
        </div>
      </div>

      <div>
        <h3 className="text-lg font-bold text-[var(--text-primary)]">
          Verification contact
        </h3>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Contact name" value={contactName} onChange={setContactName} required />
          <Field label="Contact email" value={contactEmail} onChange={setContactEmail} required />
          <Field label="Contact phone" value={contactPhone} onChange={setContactPhone} required />
          <Field
            label="EIN / registration number"
            value={businessRegistrationNumber}
            onChange={setBusinessRegistrationNumber}
          />
        </div>
      </div>

      <div>
        <h3 className="text-lg font-bold text-[var(--text-primary)]">
          Consent and sample messages
        </h3>

        <div className="mt-4 space-y-4">
          <TextArea label="Opt-in description" value={optInDescription} onChange={setOptInDescription} required />
          <TextArea label="Sample message 1" value={sampleMessage1} onChange={setSampleMessage1} required />
          <TextArea label="Sample message 2" value={sampleMessage2} onChange={setSampleMessage2} required />
        </div>
      </div>

      <button type="submit" className="primary-button" disabled={saving}>
        {saving ? "Saving..." : "Save messaging setup"}
      </button>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  required = false,
  helperText,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  helperText?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-[var(--text-primary)]">
        {label}
        {required ? " *" : ""}
      </span>
      <input
        className="mt-2 w-full rounded-2xl border border-[var(--soft-border)] bg-white px-4 py-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--rose-primary)]"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
      />
      {helperText ? (
        <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">
          {helperText}
        </p>
      ) : null}
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-[var(--text-primary)]">
        {label}
      </span>
      <select
        className="mt-2 w-full rounded-2xl border border-[var(--soft-border)] bg-white px-4 py-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--rose-primary)]"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-[var(--text-primary)]">
        {label}
        {required ? " *" : ""}
      </span>
      <textarea
        className="mt-2 min-h-[110px] w-full rounded-2xl border border-[var(--soft-border)] bg-white px-4 py-3 text-sm leading-6 text-[var(--text-primary)] outline-none focus:border-[var(--rose-primary)]"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
      />
    </label>
  );
}