"use client";

import { useState } from "react";
import { supabaseClient } from "../../lib/supabase-client";

type BusinessSettings = {
  business_id: string;
  business_name: string | null;
  phone: string | null;
  website: string | null;
  business_mode: string;
  sms_enabled: boolean | null;
  sms_timezone: string | null;
};

type Props = {
  settings: BusinessSettings | null;
  fallbackName?: string | null;
  onSaved: (settings: BusinessSettings) => void;
};

const TIMEZONE_OPTIONS = [
  { value: "", label: "Not set" },
  { value: "America/New_York", label: "Eastern Time" },
  { value: "America/Chicago", label: "Central Time" },
  { value: "America/Denver", label: "Mountain Time" },
  { value: "America/Phoenix", label: "Arizona Time" },
  { value: "America/Los_Angeles", label: "Pacific Time" },
  { value: "America/Anchorage", label: "Alaska Time" },
  { value: "Pacific/Honolulu", label: "Hawaii Time" },
];

function normalizeUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function timezoneLabel(value?: string | null) {
  return TIMEZONE_OPTIONS.find((tz) => tz.value === value)?.label ?? "Not set";
}

export default function BusinessProfileCard({
  settings,
  fallbackName,
  onSaved,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [businessName, setBusinessName] = useState(
    settings?.business_name ?? fallbackName ?? ""
  );
  const [phone, setPhone] = useState(settings?.phone ?? "");
  const [website, setWebsite] = useState(settings?.website ?? "");
  const [smsTimezone, setSmsTimezone] = useState(settings?.sms_timezone ?? "");
  const [smsEnabled, setSmsEnabled] = useState(settings?.sms_enabled ?? true);

  function startEditing() {
    setBusinessName(settings?.business_name ?? fallbackName ?? "");
    setPhone(settings?.phone ?? "");
    setWebsite(settings?.website ?? "");
    setSmsTimezone(settings?.sms_timezone ?? "");
    setSmsEnabled(settings?.sms_enabled ?? true);
    setError("");
    setEditing(true);
  }

  async function handleSave() {
    setSaving(true);
    setError("");

    try {
      const { data } = await supabaseClient.auth.getSession();
      const token = data.session?.access_token ?? "";

      const response = await fetch("/api/account/business-profile", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ businessName, phone, website, smsTimezone, smsEnabled }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "Unable to save business profile.");
      }

      onSaved(result.settings);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save business profile.");
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <section className="soft-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--rose-primary)]">
            Business profile
          </p>
          <button type="button" className="secondary-button text-sm" onClick={startEditing}>
            Edit
          </button>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Info label="Business name" value={settings?.business_name ?? fallbackName} />
          <Info label="Business phone" value={settings?.phone} capitalize={false} />
          <Info
            label="Website"
            value={settings?.website}
            capitalize={false}
            href={settings?.website ? normalizeUrl(settings.website) : undefined}
          />
          <Info
            label="Business type"
            value={settings?.business_mode?.replaceAll("_", " ")}
          />
          <Info label="Timezone" value={timezoneLabel(settings?.sms_timezone)} />
          <Info label="SMS reminders" value={settings?.sms_enabled ? "Enabled" : "Disabled"} />
        </div>
        <p className="mt-4 text-sm leading-6 text-[var(--text-secondary)]">
          Business type and other advanced settings are managed in the Wagzly app under{" "}
          <strong className="text-[var(--text-primary)]">Settings → Business Profile</strong>.
        </p>
      </section>
    );
  }

  return (
    <section className="soft-card p-6">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--rose-primary)]">
        Edit business profile
      </p>

      {error ? (
        <p className="mt-3 text-sm font-semibold text-red-600">{error}</p>
      ) : null}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Business name" value={businessName} onChange={setBusinessName} required />
        <Field label="Business phone" value={phone} onChange={setPhone} type="tel" />
        <Field label="Website" value={website} onChange={setWebsite} type="url" />

        <label className="block">
          <span className="text-sm font-semibold text-[var(--text-primary)]">Timezone</span>
          <select
            value={smsTimezone}
            onChange={(event) => setSmsTimezone(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-[var(--soft-border)] bg-white px-4 py-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--rose-primary)]"
          >
            {TIMEZONE_OPTIONS.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="mt-4 flex items-center gap-3 rounded-2xl bg-[var(--soft-surface)] px-4 py-3">
        <input
          type="checkbox"
          checked={smsEnabled}
          onChange={(event) => setSmsEnabled(event.target.checked)}
          className="h-4 w-4"
        />
        <span className="text-sm font-semibold text-[var(--text-primary)]">
          SMS reminders enabled
        </span>
      </label>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          className="primary-button"
          onClick={handleSave}
          disabled={saving || !businessName.trim()}
        >
          {saving ? "Saving..." : "Save changes"}
        </button>
        <button
          type="button"
          className="secondary-button"
          onClick={() => setEditing(false)}
          disabled={saving}
        >
          Cancel
        </button>
      </div>
    </section>
  );
}

function Info({
  label,
  value,
  capitalize = true,
  href,
}: {
  label: string;
  value?: string | null;
  capitalize?: boolean;
  href?: string;
}) {
  const hasValue = Boolean(value && value.trim());
  const valueClass = `mt-1.5 font-bold ${capitalize ? "capitalize" : ""} text-[var(--text-primary)]`;

  return (
    <div className="rounded-2xl bg-[var(--soft-surface)] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--text-secondary)]">
        {label}
      </p>
      {hasValue && href ? (
        <a href={href} className={`${valueClass} block truncate hover:underline`}>
          {value}
        </a>
      ) : (
        <p className={valueClass}>{hasValue ? value : "Not set"}</p>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required = false,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-[var(--text-primary)]">
        {label}
        {required ? " *" : ""}
      </span>
      <input
        type={type}
        className="mt-2 w-full rounded-2xl border border-[var(--soft-border)] bg-white px-4 py-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--rose-primary)]"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
      />
    </label>
  );
}
