"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseClient } from "../../lib/supabase-client";
import SmsVerificationSetupForm from "./SmsVerificationSetupForm";

type Tab =
  | "overview"
  | "billing"
  | "business"
  | "messaging"
  | "staff"
  | "security"
  | "support";

type Profile = {
  id: string;
  business_id: string;
  full_name: string | null;
  role: string;
};

type Business = {
  id: string;
  name: string;
  owner_user_id: string | null;
  subscription_status: string;
  app_access_status: string | null;
  trial_starts_at: string | null;
  trial_ends_at: string | null;
  current_period_ends_at: string | null;
  cancel_at_period_end: boolean | null;
  payment_customer_id: string | null;
  payment_subscription_id: string | null;
  plan: string;
  sms_credit_packs: number | null;
};

type BusinessSettings = {
  business_id: string;
  business_name: string | null;
  phone: string | null;
  website: string | null;
  business_mode: string;
  sms_enabled: boolean | null;
  sms_timezone: string | null;
};

type BusinessSmsSetup = {
  business_id: string;
  status: string;
  phone_number: string | null;
  twilio_phone_number_sid: string | null;
  twilio_verification_sid: string | null;
  failure_reason: string | null;
  submitted_at: string | null;
  approved_at: string | null;
};

const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
  {
    key: "overview",
    label: "Overview",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    key: "billing",
    label: "Billing",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
        <rect x="2" y="5" width="20" height="14" rx="3" />
        <path d="M2 10h20" />
      </svg>
    ),
  },
  {
    key: "business",
    label: "Business",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
        <path d="M3 21h18M9 21V7l3-4 3 4v14M9 12h6M9 16h6" />
      </svg>
    ),
  },
  {
    key: "messaging",
    label: "Messaging",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      </svg>
    ),
  },
  {
    key: "staff",
    label: "Staff",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
  },
  {
    key: "security",
    label: "Security",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
  {
    key: "support",
    label: "Support",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3M12 17h.01" />
      </svg>
    ),
  },
];

function formatDate(value: string | null) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function daysLeft(value: string | null) {
  if (!value) return null;
  const end = new Date(value).getTime();
  const now = Date.now();
  return Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));
}

function isTab(value: string | null): value is Tab {
  return tabs.some((tab) => tab.key === value);
}

function prettyStatus(value?: string | null) {
  if (!value) return "Unknown";
  return value.replaceAll("_", " ");
}

function smsStatusTitle(status?: string | null) {
  switch (status) {
    case "needs_info":
      return "Text messaging setup needed";
    case "ready_to_submit":
      return "Text messaging ready to submit";
    case "pending":
      return "Text messaging setup in progress";
    case "approved":
      return "Messaging active";
    case "failed":
      return "Verification failed — action needed";
    case "disabled":
      return "Messaging disabled";
    default:
      return "Text messaging setup needed";
  }
}

function smsStatusDescription(status?: string | null) {
  switch (status) {
    case "needs_info":
      return "Complete your business texting setup so Wagzly can request a dedicated toll-free texting number for your business.";
    case "ready_to_submit":
      return "Your information has been saved and is ready to submit for toll-free verification.";
    case "pending":
      return "Your dedicated Wagzly texting number is being verified. SMS features stay disabled until approval is complete.";
    case "approved":
      return "Your dedicated texting number is approved. Wagzly messaging can now be used for client texts, reminders, onboarding links, and scheduling updates.";
    case "failed":
      return "Your toll-free verification needs attention. Review the issue below or contact Wagzly support.";
    case "disabled":
      return "Text messaging is currently disabled for this business.";
    default:
      return "Complete your business texting setup to enable dedicated client messaging.";
  }
}

export default function AccountPage() {
  return (
    <Suspense fallback={<AccountLoading />}>
      <AccountPageContent />
    </Suspense>
  );
}

function AccountPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [billingLoading, setBillingLoading] = useState(false);
  const [creditPackLoading, setCreditPackLoading] = useState(false);
  const [creditPackError, setCreditPackError] = useState("");
  const [error, setError] = useState("");
  const [billingMessage, setBillingMessage] = useState("");

  const [profile, setProfile] = useState<Profile | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [smsSetup, setSmsSetup] = useState<BusinessSmsSetup | null>(null);
  const [staffCount, setStaffCount] = useState(0);
  const [pendingInviteCount, setPendingInviteCount] = useState(0);

  const isTrialing = business?.subscription_status === "trialing";

  const trialDaysLeft = useMemo(
    () => daysLeft(business?.trial_ends_at ?? null),
    [business?.trial_ends_at]
  );

  useEffect(() => {
    const tab = searchParams.get("tab");
    const billing = searchParams.get("billing");

    if (isTab(tab)) {
      setActiveTab(tab);
    }

    if (billing === "reactivated") {
      setBillingMessage(
        "Billing restarted successfully. Your Wagzly access is active again."
      );
      router.replace("/account?tab=billing", { scroll: false });
      return;
    }

    if (billing === "cancelled") {
      setBillingMessage("Billing setup was cancelled. No changes were made.");
      router.replace("/account?tab=billing", { scroll: false });
    }
  }, [router, searchParams]);

  useEffect(() => {
    async function loadAccount() {
      setLoading(true);
      setError("");

      const { data: sessionData } = await supabaseClient.auth.getSession();

      if (!sessionData.session?.user) {
        router.push("/login");
        return;
      }

      const userId = sessionData.session.user.id;

      const { data: profileData, error: profileError } = await supabaseClient
        .from("profiles")
        .select("id, business_id, full_name, role")
        .eq("id", userId)
        .maybeSingle();

      if (profileError || !profileData || profileData.role !== "admin") {
        await supabaseClient.auth.signOut();
        router.push("/login");
        return;
      }

      setProfile(profileData);

      const businessId = profileData.business_id;

      const [
        businessResult,
        settingsResult,
        smsSetupResult,
        staffResult,
        inviteResult,
      ] = await Promise.all([
        supabaseClient
          .from("businesses")
          .select(
            "id, name, owner_user_id, subscription_status, app_access_status, trial_starts_at, trial_ends_at, current_period_ends_at, cancel_at_period_end, payment_customer_id, payment_subscription_id, plan, sms_credit_packs"
          )
          .eq("id", businessId)
          .maybeSingle(),

        supabaseClient
          .from("business_settings")
          .select(
            "business_id, business_name, phone, website, business_mode, sms_enabled, sms_timezone"
          )
          .eq("business_id", businessId)
          .maybeSingle(),

        supabaseClient
          .from("business_sms_setup")
          .select(
            "business_id, status, phone_number, twilio_phone_number_sid, twilio_verification_sid, failure_reason, submitted_at, approved_at"
          )
          .eq("business_id", businessId)
          .maybeSingle(),

        supabaseClient
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("business_id", businessId)
          .eq("role", "worker"),

        supabaseClient
          .from("staff_invites")
          .select("id", { count: "exact", head: true })
          .eq("business_id", businessId),
      ]);

      if (businessResult.error || !businessResult.data) {
        setError("Unable to load your business account.");
        setLoading(false);
        return;
      }

      if (
        settingsResult.error ||
        smsSetupResult.error ||
        staffResult.error ||
        inviteResult.error
      ) {
        setError("Unable to load your account details.");
        setLoading(false);
        return;
      }

      setBusiness(businessResult.data);
      setSettings(settingsResult.data);
      setSmsSetup(smsSetupResult.data);
      setStaffCount(staffResult.count ?? 0);
      setPendingInviteCount(inviteResult.count ?? 0);
      setLoading(false);
    }

    loadAccount();
  }, [router]);

  async function handleSignOut() {
    setSigningOut(true);
    await supabaseClient.auth.signOut();
    router.push("/");
  }

  async function getAccessToken() {
    const { data } = await supabaseClient.auth.getSession();
    return data.session?.access_token ?? "";
  }

  async function handleOpenBillingPortal() {
    setBillingLoading(true);
    setBillingMessage("");
    setError("");

    try {
      const token = await getAccessToken();

      const response = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
      });

      const data = await response.json();

      if (!response.ok || !data.url) {
        throw new Error(data.error ?? "Unable to open billing portal.");
      }

      window.location.href = data.url;
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Unable to open billing portal."
      );
      setBillingLoading(false);
    }
  }

  async function handleReactivateBilling() {
    setBillingLoading(true);
    setBillingMessage("");
    setError("");

    try {
      const token = await getAccessToken();

      const response = await fetch("/api/billing/reactivate", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
      });

      const data = await response.json();

      if (!response.ok || !data.url) {
        throw new Error(data.error ?? "Unable to restart billing.");
      }

      window.location.href = data.url;
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Unable to restart billing."
      );
      setBillingLoading(false);
    }
  }

  const shouldShowReactivate =
    business?.subscription_status === "canceled" ||
    business?.subscription_status === "incomplete_expired";

  const canManageBilling =
    Boolean(business?.payment_customer_id) && !shouldShowReactivate;

  async function handleAddCreditPack() {
    setCreditPackLoading(true);
    setCreditPackError("");
    try {
      const token = await getAccessToken();
      const response = await fetch("/api/billing/credit-packs", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to add credit pack.");
      setBusiness((prev) =>
        prev ? { ...prev, sms_credit_packs: data.sms_credit_packs } : prev
      );
    } catch (err) {
      setCreditPackError(err instanceof Error ? err.message : "Unable to add credit pack.");
    } finally {
      setCreditPackLoading(false);
    }
  }

  async function handleRemoveCreditPack() {
    setCreditPackLoading(true);
    setCreditPackError("");
    try {
      const token = await getAccessToken();
      const response = await fetch("/api/billing/credit-packs", {
        method: "DELETE",
        headers: { authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to remove credit pack.");
      setBusiness((prev) =>
        prev ? { ...prev, sms_credit_packs: data.sms_credit_packs } : prev
      );
    } catch (err) {
      setCreditPackError(err instanceof Error ? err.message : "Unable to remove credit pack.");
    } finally {
      setCreditPackLoading(false);
    }
  }

  if (loading) {
    return <AccountLoading />;
  }

  const businessName = settings?.business_name ?? business?.name ?? "Your business";
  const firstName = profile?.full_name?.split(" ")[0] ?? null;

  return (
    <main className="site-shell">
      <section className="mx-auto min-h-screen max-w-7xl px-4 py-8 sm:px-6 sm:py-10">

        {/* Page header */}
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--rose-primary)]">
            Wagzly Account
          </p>
          <h1 className="mt-2 text-4xl font-bold text-[var(--text-primary)]">
            {firstName ? `Hey, ${firstName} 👋` : "Your Account"}
          </h1>
          <p className="mt-2 max-w-2xl text-[var(--text-secondary)]">
            Manage your subscription, billing, business profile, staff,
            messaging, and account access.
          </p>
        </div>

        {error ? (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
            {error}
          </div>
        ) : null}

        {/* Trial countdown banner */}
        {isTrialing && trialDaysLeft !== null && trialDaysLeft <= 7 ? (
          <div className="mb-6 flex items-start gap-4 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
            <div className="mt-0.5 text-amber-500">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-amber-800">
                {trialDaysLeft === 0
                  ? "Your trial ends today"
                  : `${trialDaysLeft} day${trialDaysLeft === 1 ? "" : "s"} left in your trial`}
              </p>
              <p className="mt-0.5 text-sm text-amber-700">
                After your trial, you&apos;ll need an active subscription to continue using Wagzly.{" "}
                <button
                  type="button"
                  onClick={() => setActiveTab("billing")}
                  className="font-semibold underline underline-offset-2"
                >
                  View billing →
                </button>
              </p>
            </div>
          </div>
        ) : null}

        {/* Cancel warning */}
        {business?.cancel_at_period_end ? (
          <div className="mb-6 flex items-start gap-4 rounded-2xl border border-red-200 bg-red-50 px-5 py-4">
            <div className="mt-0.5 text-red-500">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                <circle cx="12" cy="12" r="10" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-red-800">
                Subscription canceling {formatDate(business.current_period_ends_at)}
              </p>
              <p className="mt-0.5 text-sm text-red-700">
                Your account will lose access after the current period ends.{" "}
                <button
                  type="button"
                  onClick={handleOpenBillingPortal}
                  disabled={billingLoading}
                  className="font-semibold underline underline-offset-2"
                >
                  Manage billing to undo →
                </button>
              </p>
            </div>
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">

          {/* Sidebar */}
          <aside className="space-y-3">
            <div className="soft-card h-fit p-3 lg:sticky lg:top-6">

              {/* Mobile select */}
              <div className="lg:hidden">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[var(--rose-primary)]">
                  Account section
                </label>
                <select
                  value={activeTab}
                  onChange={(event) => setActiveTab(event.target.value as Tab)}
                  className="w-full rounded-2xl border border-[var(--soft-border)] bg-white px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none"
                >
                  {tabs.map((tab) => (
                    <option key={tab.key} value={tab.key}>
                      {tab.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Desktop nav */}
              <nav className="hidden lg:block lg:space-y-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex w-full items-center gap-2.5 rounded-2xl px-4 py-3 text-left text-sm font-semibold transition-all ${
                      activeTab === tab.key
                        ? "bg-[var(--rose-primary)] text-white"
                        : "text-[var(--text-secondary)] hover:bg-[var(--soft-surface)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </nav>

              {/* Status widget */}
              <div className="mt-3 rounded-2xl bg-[var(--soft-surface)] p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--rose-primary)]">
                    Status
                  </p>
                  <StatusBadge status={business?.subscription_status} />
                </div>
                <p className="mt-2 text-base font-bold capitalize text-[var(--text-primary)]">
                  {prettyStatus(business?.subscription_status)}
                </p>
                <p className="mt-0.5 text-sm capitalize text-[var(--text-secondary)]">
                  App: {prettyStatus(business?.app_access_status)}
                </p>
                {isTrialing && trialDaysLeft !== null ? (
                  <p className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3">
                      <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
                    </svg>
                    {trialDaysLeft}d left in trial
                  </p>
                ) : null}
              </div>

              {/* User chip */}
              {profile?.full_name ? (
                <div className="mt-3 flex items-center gap-3 rounded-2xl border border-[var(--divider-soft)] bg-white px-3 py-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--rose-primary)] text-xs font-bold text-white">
                    {profile.full_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-[var(--text-primary)]">
                      {profile.full_name}
                    </p>
                    <p className="text-xs text-[var(--text-secondary)]">Admin</p>
                  </div>
                </div>
              ) : null}
            </div>
          </aside>

          {/* Main content */}
          <div>

            {/* ── OVERVIEW ── */}
            {activeTab === "overview" ? (
              <div className="space-y-6">

                {/* Hero card */}
                <section className="soft-card overflow-hidden p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-2xl font-bold text-[var(--text-primary)]">
                          {businessName}
                        </h2>
                        <PlanBadge plan={business?.plan} />
                      </div>
                      <p className="mt-1.5 text-sm text-[var(--text-secondary)]">
                        {settings?.business_mode
                          ? settings.business_mode.replaceAll("_", " ")
                          : "Mobile grooming"}{" "}
                        · {settings?.sms_timezone ?? "Timezone not set"}
                      </p>
                    </div>
                    {settings?.phone ? (
                      <a
                        href={`tel:${settings.phone}`}
                        className="inline-flex items-center gap-2 rounded-2xl border border-[var(--divider-soft)] bg-[var(--soft-surface)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)]"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 text-[var(--rose-primary)]">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        {settings.phone}
                      </a>
                    ) : null}
                  </div>

                  {/* Quick stats */}
                  <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <StatTile
                      label="Plan"
                      value={business?.plan ?? "Basic"}
                      accent
                    />
                    <StatTile
                      label="Staff accounts"
                      value={staffCount.toString()}
                    />
                    <StatTile
                      label="SMS"
                      value={smsStatusShort(smsSetup?.status)}
                      statusColor={smsStatusColor(smsSetup?.status)}
                    />
                    <StatTile
                      label="Billing period ends"
                      value={
                        business?.current_period_ends_at
                          ? formatDate(business.current_period_ends_at)
                          : isTrialing
                          ? "Trial"
                          : "Not set"
                      }
                      small
                    />
                  </div>
                </section>

                {/* Action cards row */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <ActionCard
                    icon={
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                      </svg>
                    }
                    title="Text messaging"
                    description={smsStatusTitle(smsSetup?.status)}
                    buttonLabel={
                      smsSetup?.status === "approved"
                        ? "View details"
                        : "Complete setup"
                    }
                    buttonVariant={
                      smsSetup?.status === "needs_info" ||
                      smsSetup?.status === "failed"
                        ? "primary"
                        : "secondary"
                    }
                    onClick={() => setActiveTab("messaging")}
                    statusColor={smsStatusColor(smsSetup?.status)}
                  />
                  <ActionCard
                    icon={
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                        <rect x="2" y="5" width="20" height="14" rx="3" />
                        <path d="M2 10h20" />
                      </svg>
                    }
                    title="Subscription & billing"
                    description={
                      business?.cancel_at_period_end
                        ? `Canceling ${formatDate(business.current_period_ends_at)}`
                        : isTrialing
                        ? `Trial ends ${formatDate(business?.trial_ends_at ?? null)}`
                        : `${prettyStatus(business?.subscription_status)} · ${business?.plan ?? "Basic"} plan`
                    }
                    buttonLabel="Manage billing"
                    buttonVariant={
                      business?.cancel_at_period_end ? "danger" : "secondary"
                    }
                    onClick={() => setActiveTab("billing")}
                    statusColor={
                      business?.cancel_at_period_end
                        ? "red"
                        : business?.subscription_status === "active"
                        ? "green"
                        : "neutral"
                    }
                  />
                </div>

                <MessagingStatusCard
                  smsSetup={smsSetup}
                  smsEnabled={settings?.sms_enabled ?? false}
                  onSetupClick={() => setActiveTab("messaging")}
                />

                <DownloadAppCard />
              </div>
            ) : null}

            {/* ── BILLING ── */}
            {activeTab === "billing" ? (
              <div className="space-y-6">
                {billingMessage ? (
                  <div className="flex items-start gap-3 rounded-2xl border border-green-200 bg-green-50 px-5 py-4 text-sm font-semibold text-green-700">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 h-4 w-4 shrink-0 text-green-500">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {billingMessage}
                  </div>
                ) : null}

                {/* Plan banner */}
                <section className="soft-card overflow-hidden">
                  <div className="bg-gradient-to-r from-[var(--soft-surface)] to-white px-6 py-5">
                    <div className="flex flex-wrap items-center gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--rose-primary)]">
                          Current plan
                        </p>
                        <div className="mt-1 flex items-center gap-2">
                          <p className="text-2xl font-bold capitalize text-[var(--text-primary)]">
                            {business?.plan ?? "Basic"}
                          </p>
                          <PlanBadge plan={business?.plan} />
                        </div>
                      </div>
                      <div className="ml-auto">
                        <StatusBadge status={business?.subscription_status} large />
                      </div>
                    </div>
                  </div>

                  <div className="px-6 py-5">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Info
                        label="Subscription status"
                        value={prettyStatus(business?.subscription_status)}
                      />
                      <Info
                        label="App access"
                        value={prettyStatus(business?.app_access_status)}
                      />
                      {isTrialing ? (
                        <Info
                          label="Trial ends"
                          value={formatDate(business?.trial_ends_at ?? null)}
                        />
                      ) : null}
                      <Info
                        label="Current period ends"
                        value={formatDate(business?.current_period_ends_at ?? null)}
                      />
                      <Info
                        label="Canceling at period end"
                        value={business?.cancel_at_period_end ? "Yes — see warning above" : "No"}
                        warn={business?.cancel_at_period_end ?? false}
                      />
                    </div>

                    <div className="mt-6 flex flex-wrap gap-3">
                      {canManageBilling ? (
                        <button
                          type="button"
                          className="primary-button"
                          onClick={handleOpenBillingPortal}
                          disabled={billingLoading}
                        >
                          {billingLoading ? "Opening..." : "Manage billing"}
                        </button>
                      ) : null}

                      {shouldShowReactivate ? (
                        <button
                          type="button"
                          className="primary-button"
                          onClick={handleReactivateBilling}
                          disabled={billingLoading}
                        >
                          {billingLoading ? "Opening..." : "Reactivate billing"}
                        </button>
                      ) : null}
                    </div>

                    <p className="mt-5 text-sm text-[var(--text-secondary)]">
                      Use <strong className="text-[var(--text-primary)]">Manage billing</strong> to update your card, view invoices, or cancel your subscription.
                      If your account was fully canceled, use <strong className="text-[var(--text-primary)]">Reactivate billing</strong> to start a new subscription.
                    </p>

                    {!canManageBilling && !shouldShowReactivate ? (
                      <p className="mt-3 text-sm font-semibold text-[var(--text-secondary)]">
                        Billing is not connected to this account yet.
                      </p>
                    ) : null}
                  </div>
                </section>

                {/* SMS Credit Packs */}
                <section className="soft-card overflow-hidden">
                  <div className="px-6 py-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--rose-primary)]">
                          SMS Credit Packs
                        </p>
                        <p className="mt-1 text-sm text-[var(--text-secondary)]">
                          Each pack adds 200 SMS/month &middot; $9.99&thinsp;/&thinsp;pack&thinsp;/&thinsp;month
                        </p>
                      </div>
                      {business?.plan !== "pro" ? (
                        <span className="rounded-full border border-[var(--divider-soft)] bg-[var(--soft-surface)] px-3 py-1 text-xs font-bold text-[var(--text-secondary)]">
                          Pro only
                        </span>
                      ) : null}
                    </div>

                    {business?.plan === "pro" ? (
                      <>
                        <div className="mt-5 flex items-center gap-5">
                          {/* Stepper */}
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={handleRemoveCreditPack}
                              disabled={
                                creditPackLoading ||
                                (business.sms_credit_packs ?? 0) === 0
                              }
                              className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--divider-soft)] bg-white text-lg font-bold text-[var(--text-primary)] transition-opacity disabled:opacity-40"
                              aria-label="Remove one credit pack"
                            >
                              −
                            </button>

                            <div className="min-w-[52px] text-center">
                              <p className="text-2xl font-bold text-[var(--text-primary)]">
                                {business.sms_credit_packs ?? 0}
                              </p>
                              <p className="text-xs text-[var(--text-secondary)]">
                                {(business.sms_credit_packs ?? 0) === 1 ? "pack" : "packs"}
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={handleAddCreditPack}
                              disabled={creditPackLoading}
                              className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--rose-primary)] text-lg font-bold text-white transition-opacity disabled:opacity-40"
                              aria-label="Add one credit pack"
                            >
                              +
                            </button>
                          </div>

                          {/* Summary */}
                          <div className="rounded-2xl bg-[var(--soft-surface)] px-4 py-3">
                            <p className="text-sm font-bold text-[var(--text-primary)]">
                              +{(business.sms_credit_packs ?? 0) * 200} SMS&thinsp;/&thinsp;month
                            </p>
                            {(business.sms_credit_packs ?? 0) > 0 ? (
                              <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                                +${((business.sms_credit_packs ?? 0) * 9.99).toFixed(2)}&thinsp;/&thinsp;month added to your bill
                              </p>
                            ) : (
                              <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                                No packs active
                              </p>
                            )}
                          </div>
                        </div>

                        {creditPackError ? (
                          <p className="mt-3 text-sm font-semibold text-red-600">
                            {creditPackError}
                          </p>
                        ) : null}

                        <p className="mt-4 text-xs text-[var(--text-secondary)]">
                          Changes are prorated and applied to your next invoice automatically.
                        </p>
                      </>
                    ) : (
                      <p className="mt-4 text-sm text-[var(--text-secondary)]">
                        Upgrade to <strong className="text-[var(--text-primary)]">Wagzly Pro</strong> to add SMS credit packs and increase your messaging limit.
                      </p>
                    )}
                  </div>
                </section>
              </div>
            ) : null}

            {/* ── BUSINESS ── */}
            {activeTab === "business" ? (
              <AccountCard title="Business Profile">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Info label="Business name" value={settings?.business_name ?? business?.name} />
                  <Info label="Business phone" value={settings?.phone} />
                  <Info label="Website" value={settings?.website} />
                  <Info
                    label="Business type"
                    value={settings?.business_mode?.replaceAll("_", " ")}
                  />
                  <Info
                    label="SMS reminders"
                    value={settings?.sms_enabled ? "Enabled" : "Disabled"}
                  />
                  <Info label="SMS timezone" value={settings?.sms_timezone} />
                </div>

                <div className="mt-6 flex items-start gap-3 rounded-2xl bg-[var(--soft-surface)] px-4 py-4">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 h-4 w-4 shrink-0 text-[var(--rose-primary)]">
                    <circle cx="12" cy="12" r="10" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01" />
                  </svg>
                  <p className="text-sm leading-6 text-[var(--text-secondary)]">
                    To edit your business name, phone, timezone, or SMS settings — open the{" "}
                    <strong className="text-[var(--text-primary)]">Wagzly app</strong> and go to{" "}
                    <strong className="text-[var(--text-primary)]">Settings → Business Profile</strong>.
                  </p>
                </div>
              </AccountCard>
            ) : null}

            {/* ── MESSAGING ── */}
            {activeTab === "messaging" ? (
              <div className="space-y-6">
                <MessagingStatusCard
                  smsSetup={smsSetup}
                  smsEnabled={settings?.sms_enabled ?? false}
                />

                <AccountCard title="Dedicated Texting Number">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Info label="Messaging status" value={smsStatusTitle(smsSetup?.status)} />
                    <Info label="Dedicated number" value={smsSetup?.phone_number} />
                    <Info label="Submitted" value={formatDate(smsSetup?.submitted_at ?? null)} />
                    <Info label="Approved" value={formatDate(smsSetup?.approved_at ?? null)} />
                  </div>

                  {smsSetup?.failure_reason ? (
                    <div className="mt-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 h-4 w-4 shrink-0">
                        <circle cx="12" cy="12" r="10" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01" />
                      </svg>
                      {smsSetup.failure_reason}
                    </div>
                  ) : null}

                  {smsSetup?.status === "needs_info" || smsSetup?.status === "failed" ? (
                    <div className="mt-6 rounded-2xl bg-[var(--soft-surface)] p-5">
                      <p className="text-sm font-bold text-[var(--text-primary)]">
                        Text messaging verification form
                      </p>
                      <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                        Complete this form so Wagzly can prepare this business
                        for a dedicated toll-free texting number. SMS features
                        remain disabled until verification is approved.
                      </p>
                      <div className="mt-6">
                        <SmsVerificationSetupForm
                          defaultBusinessName={settings?.business_name ?? business?.name}
                          defaultBusinessPhone={settings?.phone}
                          defaultBusinessWebsite={settings?.website}
                          defaultContactName={profile?.full_name}
                          onSaved={() => window.location.reload()}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="mt-6 rounded-2xl bg-[var(--soft-surface)] p-5">
                      <p className="text-sm font-bold text-[var(--text-primary)]">
                        Setup submitted
                      </p>
                      <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                        Your texting setup information has been received.
                        Wagzly will prepare and submit your dedicated toll-free
                        texting number for verification. Messaging will stay
                        disabled until approval is complete.
                      </p>
                      <p className="mt-4 text-sm font-semibold text-[var(--text-primary)]">
                        We&apos;ll notify you when your messaging status changes.
                      </p>
                    </div>
                  )}
                </AccountCard>
              </div>
            ) : null}

            {/* ── STAFF ── */}
            {activeTab === "staff" ? (
              <div className="space-y-6">
                <AccountCard title="Staff">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <StatTile label="Active staff accounts" value={staffCount.toString()} accent />
                    <StatTile label="Pending invites" value={pendingInviteCount.toString()} />
                  </div>

                  <div className="mt-6 space-y-4">
                    <div className="flex items-start gap-3 rounded-2xl border border-[var(--divider-soft)] bg-[var(--soft-surface)] px-5 py-4">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 h-4 w-4 shrink-0 text-[var(--rose-primary)]">
                        <circle cx="12" cy="12" r="10" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01" />
                      </svg>
                      <p className="text-sm leading-6 text-[var(--text-secondary)]">
                        Manage your staff in the <strong className="text-[var(--text-primary)]">Wagzly app</strong> under{" "}
                        <strong className="text-[var(--text-primary)]">Settings → Staff</strong>.
                        Staff accounts receive their own login for the groomer app — they use an invite link to sign up, not this page.
                      </p>
                    </div>
                  </div>
                </AccountCard>

                <DownloadAppCard />
              </div>
            ) : null}

            {/* ── SECURITY ── */}
            {activeTab === "security" ? (
              <div className="space-y-6">
                <AccountCard title="Account & Security">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Info label="Account owner" value={profile?.full_name} />
                    <Info label="Account role" value="Admin" />
                    <Info label="Business" value={businessName} />
                    <Info label="App access" value={prettyStatus(business?.app_access_status)} />
                  </div>

                  <div className="mt-6 border-t border-[var(--divider-soft)] pt-6">
                    <p className="text-sm font-bold text-[var(--text-primary)]">Sign out</p>
                    <p className="mt-1.5 text-sm text-[var(--text-secondary)]">
                      You&apos;ll be signed out of this account management portal. The Wagzly mobile app uses its own session.
                    </p>
                    <button
                      className="secondary-button mt-4"
                      type="button"
                      onClick={handleSignOut}
                      disabled={signingOut}
                    >
                      {signingOut ? "Signing out..." : "Sign out"}
                    </button>
                  </div>
                </AccountCard>

                <section className="rounded-2xl border border-red-200 bg-red-50 p-6">
                  <div className="flex items-start gap-3">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 h-5 w-5 shrink-0 text-red-500">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                    </svg>
                    <div>
                      <p className="text-sm font-bold text-red-800">Danger zone</p>
                      <p className="mt-1.5 text-sm leading-6 text-red-700/90">
                        To request permanent deletion of your Wagzly account and all associated business data, visit our account deletion page.
                        This action cannot be undone.
                      </p>
                      <a
                        href="/delete-account"
                        className="secondary-button mt-4 inline-flex border-red-300 bg-white text-red-700 hover:bg-red-100"
                      >
                        Request account deletion
                      </a>
                    </div>
                  </div>
                </section>
              </div>
            ) : null}

            {/* ── SUPPORT ── */}
            {activeTab === "support" ? (
              <div className="space-y-6">
                <AccountCard title="Get Help">
                  <p className="text-[var(--text-secondary)]">
                    Need help with setup, billing, messaging, or your Wagzly account?
                    We&apos;re happy to help.
                  </p>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <a
                      href="mailto:support@wagzly.com"
                      className="primary-button"
                    >
                      Email support
                    </a>
                    <Link href="/" className="secondary-button">
                      Back to home
                    </Link>
                  </div>
                </AccountCard>

                <section className="soft-card p-6">
                  <h2 className="text-lg font-bold text-[var(--text-primary)]">
                    Common questions
                  </h2>

                  <div className="mt-4 space-y-3">
                    <SupportRow
                      title="How do I add or manage staff?"
                      body='Open the Wagzly app and go to Settings → Staff. Staff members use an invite link to create their own login — they do not sign up through this website.'
                    />
                    <SupportRow
                      title="How do I update my billing or cancel?"
                      body='Go to the Billing tab on this page and click "Manage billing." You can update your payment method, view invoices, or cancel your subscription from the Stripe portal.'
                    />
                    <SupportRow
                      title="When will my SMS texting number be approved?"
                      body="Toll-free number verification typically takes a few business days after you submit the messaging setup form. You'll be notified when your status changes."
                    />
                    <SupportRow
                      title="How do I edit my business name, hours, or services?"
                      body="All business settings — name, hours, services, staff, and more — are managed inside the Wagzly mobile app under the Settings section."
                    />
                    <SupportRow
                      title="I forgot my password. What do I do?"
                      body='Go to the Login page and use the "Forgot password?" link to receive a password reset email at your registered address.'
                    />
                  </div>
                </section>

                <section className="soft-card p-6">
                  <h2 className="text-lg font-bold text-[var(--text-primary)]">
                    Contact us
                  </h2>
                  <p className="mt-2 text-sm text-[var(--text-secondary)]">
                    Email us at{" "}
                    <a
                      href="mailto:support@wagzly.com"
                      className="font-semibold text-[var(--rose-primary)] hover:underline"
                    >
                      support@wagzly.com
                    </a>{" "}
                    and we&apos;ll get back to you as soon as possible.
                  </p>
                </section>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}

// ── Sub-components ──────────────────────────────────────────────

function AccountLoading() {
  return (
    <main className="site-shell">
      <section className="mx-auto min-h-screen max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-8 space-y-2">
          <div className="h-4 w-28 animate-pulse rounded-full bg-[var(--soft-surface)]" />
          <div className="h-8 w-48 animate-pulse rounded-2xl bg-[var(--soft-surface)]" />
          <div className="h-4 w-64 animate-pulse rounded-full bg-[var(--soft-surface)]" />
        </div>
        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          <div className="soft-card h-72 animate-pulse" />
          <div className="space-y-4">
            <div className="soft-card h-52 animate-pulse" />
            <div className="soft-card h-36 animate-pulse" />
          </div>
        </div>
      </section>
    </main>
  );
}

function AccountCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="soft-card p-6">
      <h2 className="text-2xl font-bold text-[var(--text-primary)]">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Info({
  label,
  value,
  warn = false,
}: {
  label: string;
  value?: string | null;
  warn?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl p-4 ${
        warn
          ? "bg-red-50 ring-1 ring-red-200"
          : "bg-[var(--soft-surface)]"
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--text-secondary)]">
        {label}
      </p>
      <p
        className={`mt-1.5 font-bold capitalize ${
          warn ? "text-red-700" : "text-[var(--text-primary)]"
        }`}
      >
        {value && value.trim() ? value : "Not set"}
      </p>
    </div>
  );
}

function StatTile({
  label,
  value,
  accent = false,
  statusColor,
  small = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
  statusColor?: string;
  small?: boolean;
}) {
  const dot =
    statusColor === "green"
      ? "bg-green-400"
      : statusColor === "red"
      ? "bg-red-400"
      : statusColor === "amber"
      ? "bg-amber-400"
      : null;

  return (
    <div
      className={`rounded-2xl p-4 ${
        accent
          ? "bg-[var(--rose-primary)] text-white"
          : "bg-[var(--soft-surface)]"
      }`}
    >
      <p
        className={`text-xs font-semibold uppercase tracking-[0.1em] ${
          accent ? "text-white/70" : "text-[var(--text-secondary)]"
        }`}
      >
        {label}
      </p>
      <div className="mt-1.5 flex items-center gap-2">
        {dot ? (
          <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${dot}`} />
        ) : null}
        <p
          className={`font-bold capitalize leading-snug ${
            accent ? "text-white" : "text-[var(--text-primary)]"
          } ${small ? "text-sm" : "text-lg"}`}
        >
          {value && value.trim() ? value : "Not set"}
        </p>
      </div>
    </div>
  );
}

function ActionCard({
  icon,
  title,
  description,
  buttonLabel,
  buttonVariant,
  onClick,
  statusColor,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  buttonLabel: string;
  buttonVariant: "primary" | "secondary" | "danger";
  onClick: () => void;
  statusColor?: string;
}) {
  const borderColor =
    statusColor === "green"
      ? "border-green-200"
      : statusColor === "red"
      ? "border-red-300"
      : statusColor === "amber"
      ? "border-amber-200"
      : "border-[var(--divider-soft)]";

  const btnClass =
    buttonVariant === "primary"
      ? "primary-button"
      : buttonVariant === "danger"
      ? "inline-flex items-center justify-center rounded-2xl border border-red-300 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-700 hover:bg-red-100 transition-colors"
      : "secondary-button";

  return (
    <section
      className={`soft-card border p-5 ${borderColor}`}
    >
      <div className="flex items-center gap-2.5 text-[var(--rose-primary)]">
        {icon}
        <p className="text-sm font-bold text-[var(--text-primary)]">{title}</p>
      </div>
      <p className="mt-2 text-sm leading-5 text-[var(--text-secondary)]">
        {description}
      </p>
      <button type="button" className={`${btnClass} mt-4 text-sm`} onClick={onClick}>
        {buttonLabel}
      </button>
    </section>
  );
}

function StatusBadge({
  status,
  large = false,
}: {
  status?: string | null;
  large?: boolean;
}) {
  const size = large ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-xs";

  const style =
    status === "active"
      ? "bg-green-100 text-green-700"
      : status === "trialing"
      ? "bg-amber-100 text-amber-700"
      : status === "canceled" || status === "incomplete_expired"
      ? "bg-red-100 text-red-700"
      : status === "past_due"
      ? "bg-orange-100 text-orange-700"
      : "bg-[var(--soft-surface)] text-[var(--text-secondary)]";

  return (
    <span
      className={`inline-flex items-center rounded-full font-bold capitalize ${size} ${style}`}
    >
      {prettyStatus(status)}
    </span>
  );
}

function PlanBadge({ plan }: { plan?: string | null }) {
  const isPro =
    plan?.toLowerCase().includes("pro") ||
    plan?.toLowerCase().includes("premium");

  if (isPro) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--rose-primary)] px-2.5 py-0.5 text-xs font-bold text-white">
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
        {plan}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full bg-[var(--soft-surface)] px-2.5 py-0.5 text-xs font-semibold capitalize text-[var(--text-secondary)]">
      {plan ?? "Basic"}
    </span>
  );
}

function MessagingStatusCard({
  smsSetup,
  smsEnabled,
  onSetupClick,
}: {
  smsSetup: BusinessSmsSetup | null;
  smsEnabled: boolean;
  onSetupClick?: () => void;
}) {
  const status = smsSetup?.status ?? "needs_info";
  const isApproved = status === "approved";
  const isFailed = status === "failed";
  const isPending = status === "pending";

  const borderColor = isApproved
    ? "border-green-200"
    : isFailed
    ? "border-red-200"
    : isPending
    ? "border-yellow-200"
    : "border-[var(--soft-border)]";

  return (
    <section className={`soft-card border p-6 ${borderColor}`}>
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--rose-primary)]">
        Text messaging
      </p>

      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-2xl font-bold text-[var(--text-primary)]">
          {smsStatusTitle(status)}
        </h2>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
            isApproved
              ? "bg-green-100 text-green-700"
              : isFailed
              ? "bg-red-100 text-red-700"
              : isPending
              ? "bg-amber-100 text-amber-700"
              : "bg-[var(--soft-surface)] text-[var(--text-secondary)]"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              isApproved
                ? "bg-green-500"
                : isFailed
                ? "bg-red-500"
                : isPending
                ? "bg-amber-500"
                : "bg-[var(--text-secondary)]"
            }`}
          />
          {prettyStatus(status)}
        </span>
      </div>

      <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
        {smsStatusDescription(status)}
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Info label="SMS enabled" value={smsEnabled ? "Yes" : "No"} />
        <Info label="Verification" value={prettyStatus(status)} />
        <Info label="Texting number" value={smsSetup?.phone_number} />
      </div>

      {onSetupClick ? (
        <button
          type="button"
          className="primary-button mt-6"
          onClick={onSetupClick}
        >
          View messaging setup
        </button>
      ) : null}
    </section>
  );
}

function DownloadAppCard() {
  return (
    <section className="soft-card p-6">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--rose-primary)]">
        iOS and Android
      </p>

      <h2 className="mt-2 text-2xl font-bold text-[var(--text-primary)]">
        Download Wagzly on your phone
      </h2>

      <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
        After creating your account, download the Wagzly app to start managing
        your schedule, clients, pets, payments, messaging, and grooming day from
        your supported iPhone or Android device.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-5">
        <div className="flex h-[54px] w-[180px] items-center justify-center">
          <Image
            src="/images/store/appstore.svg"
            alt="Download on the App Store"
            width={180}
            height={54}
            className="h-[54px] w-[180px] object-contain"
          />
        </div>

        <div className="flex h-[54px] w-[180px] items-center justify-center">
          <Image
            src="/images/store/googleplay.png"
            alt="Get it on Google Play"
            width={180}
            height={54}
            className="h-[54px] w-[180px] object-contain"
          />
        </div>
      </div>
    </section>
  );
}

function SupportRow({ title, body }: { title: string; body: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-2xl border border-[var(--divider-soft)] bg-[var(--soft-surface)]">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
      >
        <span className="text-sm font-bold text-[var(--text-primary)]">
          {title}
        </span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`h-4 w-4 shrink-0 text-[var(--text-secondary)] transition-transform ${
            open ? "rotate-180" : ""
          }`}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open ? (
        <div className="border-t border-[var(--divider-soft)] px-5 pb-4 pt-3">
          <p className="text-sm leading-6 text-[var(--text-secondary)]">{body}</p>
        </div>
      ) : null}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────

function smsStatusShort(status?: string | null) {
  switch (status) {
    case "approved": return "Active";
    case "pending": return "In review";
    case "needs_info": return "Setup needed";
    case "failed": return "Failed";
    case "disabled": return "Disabled";
    default: return "Not set up";
  }
}

function smsStatusColor(status?: string | null): string {
  switch (status) {
    case "approved": return "green";
    case "pending": return "amber";
    case "failed": return "red";
    default: return "neutral";
  }
}
