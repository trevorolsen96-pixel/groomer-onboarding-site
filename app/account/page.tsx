"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseClient } from "../../lib/supabase-client";

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
  trial_starts_at: string | null;
  trial_ends_at: string | null;
  plan: string;
};

type BusinessSettings = {
  business_id: string;
  business_name: string | null;
  phone: string | null;
  website: string | null;
  facebook: string | null;
  instagram: string | null;
  yelp: string | null;
  business_mode: string;
  sms_enabled: boolean | null;
  reschedule_sms_enabled: boolean | null;
  sms_sender_number: string | null;
  sms_timezone: string | null;
};

const navItems = ["Overview", "Billing", "Business", "Staff", "Security", "Support"];

function formatDate(value: string | null) {
  if (!value) return "Not set";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
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

export default function AccountPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");

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

      if (profileError || !profileData) {
        await supabaseClient.auth.signOut();
        router.push("/login");
        return;
      }

      if (profileData.role !== "admin") {
        await supabaseClient.auth.signOut();
        router.push("/login");
        return;
      }

      setProfile(profileData);

      const businessId = profileData.business_id;

      const [
        businessResult,
        settingsResult,
        staffResult,
        inviteResult,
      ] = await Promise.all([
        supabaseClient
          .from("businesses")
          .select(
            "id, name, owner_user_id, subscription_status, trial_starts_at, trial_ends_at, plan"
          )
          .eq("id", businessId)
          .maybeSingle(),

        supabaseClient
          .from("business_settings")
          .select(
            "business_id, business_name, phone, website, facebook, instagram, yelp, business_mode, sms_enabled, reschedule_sms_enabled, sms_sender_number, sms_timezone"
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

      if (settingsResult.error) {
        setError("Unable to load your business settings.");
        setLoading(false);
        return;
      }

      if (staffResult.error) {
        setError("Unable to load staff information.");
        setLoading(false);
        return;
      }

      if (inviteResult.error) {
        setError("Unable to load staff invite information.");
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

  if (loading) {
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

  return (
    <main className="site-shell">
      <section className="mx-auto min-h-screen max-w-7xl px-6 py-10">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--rose-primary)]">
            Wagzly Account
          </p>

          <h1 className="mt-3 text-4xl font-bold text-[var(--text-primary)]">
            Account
          </h1>

          <p className="mt-3 max-w-2xl text-[var(--text-secondary)]">
            Manage your subscription, billing, business profile, staff, and account access.
          </p>
        </div>

        {error ? (
          <div className="mb-6 rounded-2xl bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
            {error}
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          <aside className="soft-card h-fit p-4">
            <nav className="space-y-1">
              {navItems.map((item) => (
                <a
                  key={item}
                  href={`#${item.toLowerCase()}`}
                  className="block rounded-2xl px-4 py-3 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--soft-surface)] hover:text-[var(--text-primary)]"
                >
                  {item}
                </a>
              ))}
            </nav>

            <div className="mt-6 rounded-2xl bg-[var(--soft-surface)] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--rose-primary)]">
                Current status
              </p>
              <p className="mt-2 text-lg font-bold capitalize text-[var(--text-primary)]">
                {business?.subscription_status ?? "Unknown"}
              </p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                {trialDaysLeft !== null
                  ? `${trialDaysLeft} day${trialDaysLeft === 1 ? "" : "s"} left in trial`
                  : "Subscription details unavailable"}
              </p>
            </div>
          </aside>

          <div className="space-y-6">
            <section id="overview" className="soft-card p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-[var(--text-primary)]">
                    Overview
                  </h2>
                  <p className="mt-2 text-[var(--text-secondary)]">
                    {settings?.business_name ?? business?.name ?? "Your business"} is currently on the{" "}
                    <span className="font-semibold capitalize text-[var(--text-primary)]">
                      {business?.plan ?? "basic"}
                    </span>{" "}
                    plan.
                  </p>
                </div>

                <span className="rounded-full bg-green-50 px-4 py-2 text-sm font-bold capitalize text-green-700">
                  {business?.subscription_status ?? "Active"}
                </span>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl bg-[var(--soft-surface)] p-4">
                  <p className="text-sm text-[var(--text-secondary)]">Plan</p>
                  <p className="mt-1 text-xl font-bold capitalize text-[var(--text-primary)]">
                    {business?.plan ?? "Basic"}
                  </p>
                </div>

                <div className="rounded-2xl bg-[var(--soft-surface)] p-4">
                  <p className="text-sm text-[var(--text-secondary)]">Subscription</p>
                  <p className="mt-1 text-xl font-bold capitalize text-[var(--text-primary)]">
                    {business?.subscription_status ?? "Unknown"}
                  </p>
                </div>

                <div className="rounded-2xl bg-[var(--soft-surface)] p-4">
                  <p className="text-sm text-[var(--text-secondary)]">Trial ends</p>
                  <p className="mt-1 text-xl font-bold text-[var(--text-primary)]">
                    {formatDate(business?.trial_ends_at ?? null)}
                  </p>
                </div>
              </div>
            </section>

            <section id="billing" className="soft-card p-6">
              <h2 className="text-2xl font-bold text-[var(--text-primary)]">
                Billing
              </h2>

              <p className="mt-2 text-[var(--text-secondary)]">
                Billing controls will live here once payments are connected.
              </p>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-[var(--divider-soft)] p-5">
                  <p className="text-sm text-[var(--text-secondary)]">Current plan</p>
                  <p className="mt-1 text-lg font-bold capitalize text-[var(--text-primary)]">
                    {business?.plan ?? "Basic"}
                  </p>
                </div>

                <div className="rounded-2xl border border-[var(--divider-soft)] p-5">
                  <p className="text-sm text-[var(--text-secondary)]">Payment method</p>
                  <p className="mt-1 text-lg font-bold text-[var(--text-primary)]">
                    Not connected yet
                  </p>
                </div>
              </div>
            </section>

            <section id="business" className="soft-card p-6">
              <h2 className="text-2xl font-bold text-[var(--text-primary)]">
                Business
              </h2>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Info label="Business name" value={settings?.business_name ?? business?.name} />
                <Info label="Business phone" value={settings?.phone} />
                <Info label="Website" value={settings?.website} />
                <Info label="Business type" value={settings?.business_mode?.replace("_", " ")} />
                <Info label="SMS reminders" value={settings?.sms_enabled ? "Enabled" : "Disabled"} />
                <Info label="SMS timezone" value={settings?.sms_timezone} />
              </div>
            </section>

            <section id="staff" className="soft-card p-6">
              <h2 className="text-2xl font-bold text-[var(--text-primary)]">
                Staff
              </h2>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Info label="Active staff accounts" value={staffCount.toString()} />
                <Info label="Pending staff invites" value={pendingInviteCount.toString()} />
              </div>

              <p className="mt-4 text-sm text-[var(--text-secondary)]">
                Staff should still use invite links. The owner signup page is only for business owners.
              </p>
            </section>

            <section id="security" className="soft-card p-6">
              <h2 className="text-2xl font-bold text-[var(--text-primary)]">
                Security
              </h2>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Info label="Account owner" value={profile?.full_name} />
                <Info label="Account role" value="Admin" />
              </div>

              <div className="mt-5">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={handleSignOut}
                  disabled={signingOut}
                >
                  {signingOut ? "Signing out..." : "Sign out"}
                </button>
              </div>
            </section>

            <section id="support" className="soft-card p-6">
              <h2 className="text-2xl font-bold text-[var(--text-primary)]">
                Support
              </h2>

              <p className="mt-2 text-[var(--text-secondary)]">
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
            </section>
          </div>
        </div>
      </section>
    </main>
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