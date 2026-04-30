"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseClient } from "../../lib/supabase-client";

type Tab =
  | "overview"
  | "billing"
  | "business"
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

const tabs: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "billing", label: "Billing" },
  { key: "business", label: "Business" },
  { key: "staff", label: "Staff" },
  { key: "security", label: "Security" },
  { key: "support", label: "Support" },
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
  const [error, setError] = useState("");
  const [billingMessage, setBillingMessage] = useState("");

  const [profile, setProfile] = useState<Profile | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [staffCount, setStaffCount] = useState(0);
  const [pendingInviteCount, setPendingInviteCount] = useState(0);

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
        "Billing restarted successfully. Stripe may take a moment to sync your account status."
      );
    }

    if (billing === "cancelled") {
      setBillingMessage("Billing setup was cancelled. No changes were made.");
    }
  }, [searchParams]);

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

      const [businessResult, settingsResult, staffResult, inviteResult] =
        await Promise.all([
          supabaseClient
            .from("businesses")
            .select(
              "id, name, owner_user_id, subscription_status, app_access_status, trial_starts_at, trial_ends_at, current_period_ends_at, cancel_at_period_end, payment_customer_id, payment_subscription_id, plan"
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

      if (settingsResult.error || staffResult.error || inviteResult.error) {
        setError("Unable to load your account details.");
        setLoading(false);
        return;
      }

      setBusiness(businessResult.data);
      setSettings(settingsResult.data);
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
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok || !data.url) {
        throw new Error(data.error ?? "Unable to open billing portal.");
      }

      window.location.href = data.url;
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to open billing portal."
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
        headers: {
          authorization: `Bearer ${token}`,
        },
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

  const canManageBilling = Boolean(business?.payment_customer_id);

  const shouldShowReactivate =
  business?.subscription_status === "canceled" ||
  business?.subscription_status === "incomplete_expired";

  if (loading) {
    return <AccountLoading />;
  }

  return (
    <main className="site-shell">
      <section className="mx-auto min-h-screen max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--rose-primary)]">
            Wagzly Account
          </p>

          <h1 className="mt-3 text-4xl font-bold text-[var(--text-primary)]">
            Account
          </h1>

          <p className="mt-3 max-w-2xl text-[var(--text-secondary)]">
            Manage your subscription, billing, business profile, staff, and
            account access.
          </p>
        </div>

        {error ? (
          <div className="mb-6 rounded-2xl bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
            {error}
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          <aside className="soft-card h-fit p-3 lg:sticky lg:top-6">
            <nav className="flex gap-2 overflow-x-auto pb-1 lg:block lg:space-y-1 lg:overflow-visible lg:pb-0">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`shrink-0 rounded-2xl px-4 py-3 text-left text-sm font-semibold lg:block lg:w-full ${
                    activeTab === tab.key
                      ? "bg-[var(--rose-primary)] text-white"
                      : "text-[var(--text-secondary)] hover:bg-[var(--soft-surface)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>

            <div className="mt-5 rounded-2xl bg-[var(--soft-surface)] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--rose-primary)]">
                Current status
              </p>
              <p className="mt-2 text-lg font-bold capitalize text-[var(--text-primary)]">
                {prettyStatus(business?.subscription_status)}
              </p>
              <p className="mt-1 text-sm capitalize text-[var(--text-secondary)]">
                App access: {prettyStatus(business?.app_access_status)}
              </p>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                Trial ends {formatDate(business?.trial_ends_at ?? null)}
              </p>
            </div>
          </aside>

          <div>
            {activeTab === "overview" ? (
              <AccountCard title="Overview">
                <p className="text-[var(--text-secondary)]">
                  {settings?.business_name ?? business?.name ?? "Your business"}{" "}
                  is currently on the{" "}
                  <strong className="capitalize text-[var(--text-primary)]">
                    {business?.plan ?? "basic"}
                  </strong>{" "}
                  plan.
                </p>

                <div className="mt-6 grid gap-4 sm:grid-cols-3">
                  <Info label="Plan" value={business?.plan ?? "Basic"} />
                  <Info
                    label="Subscription"
                    value={prettyStatus(business?.subscription_status)}
                  />
                  <Info
                    label="App access"
                    value={prettyStatus(business?.app_access_status)}
                  />
                  <Info
                    label="Trial"
                    value={
                      trialDaysLeft !== null
                        ? `${trialDaysLeft} day${
                            trialDaysLeft === 1 ? "" : "s"
                          } left`
                        : "Not set"
                    }
                  />
                  <Info
                    label="Trial ends"
                    value={formatDate(business?.trial_ends_at ?? null)}
                  />
                  <Info
                    label="Business"
                    value={settings?.business_name ?? business?.name}
                  />
                  <Info label="Account owner" value={profile?.full_name} />
                </div>
              </AccountCard>
            ) : null}

            {activeTab === "billing" ? (
              <AccountCard title="Billing">
                {billingMessage ? (
                  <div className="mb-5 rounded-2xl bg-green-50 px-5 py-4 text-sm font-semibold text-green-700">
                    {billingMessage}
                  </div>
                ) : null}

                <div className="grid gap-4 sm:grid-cols-2">
                  <Info label="Current plan" value={business?.plan ?? "Basic"} />
                  <Info
                    label="Subscription status"
                    value={prettyStatus(business?.subscription_status)}
                  />
                  <Info
                    label="App access"
                    value={prettyStatus(business?.app_access_status)}
                  />
                  <Info
                    label="Trial ends"
                    value={formatDate(business?.trial_ends_at ?? null)}
                  />
                  <Info
                    label="Current billing period ends"
                    value={formatDate(business?.current_period_ends_at ?? null)}
                  />
                  <Info
                    label="Canceling at period end"
                    value={business?.cancel_at_period_end ? "Yes" : "No"}
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
                  Use Manage billing to update your card, view invoices, or
                  cancel your subscription. If your account was fully canceled,
                  use Reactivate billing to start a new subscription.
                </p>

                {!canManageBilling && !shouldShowReactivate ? (
                  <p className="mt-3 text-sm font-semibold text-[var(--text-secondary)]">
                    Billing is not connected to this account yet.
                  </p>
                ) : null}
              </AccountCard>
            ) : null}

            {activeTab === "business" ? (
              <AccountCard title="Business">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Info
                    label="Business name"
                    value={settings?.business_name ?? business?.name}
                  />
                  <Info label="Business phone" value={settings?.phone} />
                  <Info label="Website" value={settings?.website} />
                  <Info
                    label="Business type"
                    value={settings?.business_mode?.replace("_", " ")}
                  />
                  <Info
                    label="SMS reminders"
                    value={settings?.sms_enabled ? "Enabled" : "Disabled"}
                  />
                  <Info label="SMS timezone" value={settings?.sms_timezone} />
                </div>
              </AccountCard>
            ) : null}

            {activeTab === "staff" ? (
              <AccountCard title="Staff">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Info
                    label="Active staff accounts"
                    value={staffCount.toString()}
                  />
                  <Info
                    label="Pending staff invites"
                    value={pendingInviteCount.toString()}
                  />
                </div>

                <p className="mt-5 text-sm text-[var(--text-secondary)]">
                  Staff should still use invite links. The owner signup page is
                  only for business owners.
                </p>
              </AccountCard>
            ) : null}

            {activeTab === "security" ? (
              <AccountCard title="Security">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Info label="Account owner" value={profile?.full_name} />
                  <Info label="Account role" value="Admin" />
                </div>

                <button
                  className="secondary-button mt-5"
                  type="button"
                  onClick={handleSignOut}
                  disabled={signingOut}
                >
                  {signingOut ? "Signing out..." : "Sign out"}
                </button>
              </AccountCard>
            ) : null}

            {activeTab === "support" ? (
              <AccountCard title="Support">
                <p className="text-[var(--text-secondary)]">
                  Need help with setup, billing, or your Wagzly account?
                </p>

                <div className="mt-5 flex flex-wrap gap-3">
                  <Link href="/" className="secondary-button">
                    Back to home
                  </Link>
                  <a href="mailto:support@wagzly.app" className="primary-button">
                    Contact support
                  </a>
                </div>
              </AccountCard>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}

function AccountLoading() {
  return (
    <main className="site-shell">
      <section className="mx-auto flex min-h-screen max-w-4xl items-center px-6 py-14">
        <div className="soft-card w-full p-8">
          <p className="text-lg font-bold text-[var(--text-primary)]">
            Loading your account...
          </p>
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

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-2xl bg-[var(--soft-surface)] p-4">
      <p className="text-sm text-[var(--text-secondary)]">{label}</p>
      <p className="mt-1 font-bold capitalize text-[var(--text-primary)]">
        {value && value.trim() ? value : "Not set"}
      </p>
    </div>
  );
}