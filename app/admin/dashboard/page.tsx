import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession } from "../../../lib/admin-auth";
import { supabaseAdmin } from "../../../lib/supabase-admin";
import AdminLogoutButton from "./AdminLogoutButton";

type Business = {
  id: string;
  plan: string;
  created_at: string;
};

type StripeSub = {
  id: string;
  plan: { amount: number; interval: string };
  current_period_end: number;
};

type StripeCharge = {
  id: string;
  amount: number;
  currency: string;
  description: string | null;
  created: number;
  status: string;
};

function daysSince(dateStr: string): number {
  return Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24)
  );
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default async function AdminDashboardPage() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("admin_session")?.value;
  const session = verifySession(sessionCookie);

  if (!session || !session.admin) {
    redirect("/admin");
  }

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Fetch all data in parallel
  const [
    { data: businesses },
    { data: businessSettings },
    { data: smsSetups },
    { data: appointments },
    { data: payments },
    stripeData,
  ] = await Promise.all([
    supabaseAdmin
      .from("businesses")
      .select("id, plan, created_at")
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("business_settings")
      .select("business_id, business_name"),
    supabaseAdmin
      .from("business_sms_setup")
      .select("business_id, status"),
    supabaseAdmin
      .from("appointments")
      .select("business_id, created_at")
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("appointment_payments")
      .select("business_id, created_at")
      .order("created_at", { ascending: false }),
    fetchStripeData(),
  ]);

  // Build lookup maps
  const settingsByBiz = new Map(
    (businessSettings ?? []).map((s) => [s.business_id, s])
  );
  const smsByBiz = new Map(
    (smsSetups ?? []).map((s) => [s.business_id, s])
  );

  // Last appointment per business
  const lastApptByBiz = new Map<string, string>();
  for (const appt of appointments ?? []) {
    if (!lastApptByBiz.has(appt.business_id)) {
      lastApptByBiz.set(appt.business_id, appt.created_at);
    }
  }

  // Appointment counts per business
  const apptCountByBiz = new Map<string, number>();
  for (const appt of appointments ?? []) {
    apptCountByBiz.set(
      appt.business_id,
      (apptCountByBiz.get(appt.business_id) ?? 0) + 1
    );
  }

  // Last payment per business
  const lastPaymentByBiz = new Map<string, string>();
  for (const pay of payments ?? []) {
    if (!lastPaymentByBiz.has(pay.business_id)) {
      lastPaymentByBiz.set(pay.business_id, pay.created_at);
    }
  }

  // Payment counts per business
  const payCountByBiz = new Map<string, number>();
  for (const pay of payments ?? []) {
    payCountByBiz.set(
      pay.business_id,
      (payCountByBiz.get(pay.business_id) ?? 0) + 1
    );
  }

  // Stats
  const allBiz = (businesses ?? []) as Business[];
  const totalBusinesses = allBiz.length;
  const newThisWeek = allBiz.filter((b) => b.created_at >= weekAgo).length;
  const newThisMonth = allBiz.filter((b) => b.created_at >= monthAgo).length;
  const proPlan = allBiz.filter((b) => b.plan?.toLowerCase() === "pro").length;
  const basicPlan = allBiz.filter((b) => b.plan?.toLowerCase() !== "pro").length;
  const smsActive = (smsSetups ?? []).filter((s) =>
    ["active", "approved"].includes(s.status ?? "")
  ).length;

  // Build user rows
  const userRows = allBiz.map((biz) => {
    const settings = settingsByBiz.get(biz.id);
    const sms = smsByBiz.get(biz.id);
    const apptCount = apptCountByBiz.get(biz.id) ?? 0;
    const payCount = payCountByBiz.get(biz.id) ?? 0;
    const lastAppt = lastApptByBiz.get(biz.id);
    const lastPay = lastPaymentByBiz.get(biz.id);

    let lastActive: string | null = null;
    if (lastAppt && lastPay) {
      lastActive = lastAppt > lastPay ? lastAppt : lastPay;
    } else {
      lastActive = lastAppt ?? lastPay ?? null;
    }

    const neverSetup = apptCount === 0;
    const inactive = lastActive
      ? lastActive < thirtyDaysAgo
      : daysSince(biz.created_at) > 30;

    return {
      id: biz.id,
      name: settings?.business_name ?? "—",
      plan: biz.plan ?? "basic",
      createdAt: biz.created_at,
      smsActive: ["active", "approved"].includes(sms?.status ?? ""),
      apptCount,
      payCount,
      lastActive,
      neverSetup,
      inactive,
    };
  });

  return (
    <div className="min-h-screen bg-[#0f1117] text-[#e6edf3] font-mono">
      {/* Top bar */}
      <div className="border-b border-[#30363d] bg-[#161b22] px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-[#3fb950] font-bold text-sm">WAGZLY</span>
          <span className="text-[#484f58] text-xs">/</span>
          <span className="text-[#8b949e] text-xs">admin dashboard</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-[#8b949e]">
          <span>{now.toLocaleString()}</span>
          <AdminLogoutButton />
        </div>
      </div>

      <div className="px-6 py-6 max-w-[1400px] mx-auto">

        {/* Overview stats */}
        <div className="mb-6">
          <div className="text-[#8b949e] text-xs uppercase tracking-wider mb-3">Overview</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: "Total Businesses", value: totalBusinesses, color: "text-[#e6edf3]" },
              { label: "New This Week", value: newThisWeek, color: "text-[#3fb950]" },
              { label: "New This Month", value: newThisMonth, color: "text-[#3fb950]" },
              { label: "Pro Plan", value: proPlan, color: "text-[#58a6ff]" },
              { label: "Basic Plan", value: basicPlan, color: "text-[#8b949e]" },
              { label: "SMS Active", value: smsActive, color: "text-[#d29922]" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="bg-[#161b22] border border-[#30363d] rounded p-4"
              >
                <div className={`text-3xl font-bold ${stat.color}`}>
                  {stat.value}
                </div>
                <div className="text-[#8b949e] text-xs mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Stripe stats */}
        <div className="mb-6">
          <div className="text-[#8b949e] text-xs uppercase tracking-wider mb-3">Revenue (Stripe)</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-[#161b22] border border-[#30363d] rounded p-4">
              <div className="text-3xl font-bold text-[#3fb950]">
                {stripeData.mrr ?? "—"}
              </div>
              <div className="text-[#8b949e] text-xs mt-1">MRR</div>
            </div>
            <div className="bg-[#161b22] border border-[#30363d] rounded p-4">
              <div className="text-3xl font-bold text-[#58a6ff]">
                {stripeData.activeSubs ?? "—"}
              </div>
              <div className="text-[#8b949e] text-xs mt-1">Active Subscriptions</div>
            </div>
            <div className="bg-[#161b22] border border-[#30363d] rounded p-4">
              <div className="text-[#8b949e] text-xs mb-2">Recent Charges</div>
              {stripeData.recentCharges?.length ? (
                <div className="space-y-1">
                  {stripeData.recentCharges.slice(0, 5).map((c) => (
                    <div key={c.id} className="flex justify-between text-xs">
                      <span className="text-[#8b949e] truncate max-w-[120px]">
                        {c.description ?? c.id.slice(0, 12)}
                      </span>
                      <span className={c.status === "succeeded" ? "text-[#3fb950]" : "text-[#f85149]"}>
                        {formatMoney(c.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[#484f58] text-xs">Unavailable</div>
              )}
            </div>
          </div>
        </div>

        {/* User table */}
        <div className="mb-6">
          <div className="text-[#8b949e] text-xs uppercase tracking-wider mb-3">
            Businesses ({totalBusinesses})
          </div>
          <div className="bg-[#161b22] border border-[#30363d] rounded overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#30363d] text-[#8b949e]">
                  <th className="text-left px-4 py-3 font-normal">Business</th>
                  <th className="text-left px-4 py-3 font-normal">Plan</th>
                  <th className="text-left px-4 py-3 font-normal">Signed Up</th>
                  <th className="text-left px-4 py-3 font-normal">SMS</th>
                  <th className="text-right px-4 py-3 font-normal">Appts</th>
                  <th className="text-right px-4 py-3 font-normal">Payments</th>
                  <th className="text-left px-4 py-3 font-normal">Last Active</th>
                  <th className="text-left px-4 py-3 font-normal">Flags</th>
                </tr>
              </thead>
              <tbody>
                {userRows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-[#21262d] hover:bg-[#1c2128] transition-colors"
                  >
                    <td className="px-4 py-2.5">
                      <div className="text-[#e6edf3] font-medium">{row.name}</div>
                      <div className="text-[#484f58] text-[10px] mt-0.5">{row.id.slice(0, 8)}...</div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          row.plan.toLowerCase() === "pro"
                            ? "bg-[#388bfd1a] text-[#58a6ff]"
                            : "bg-[#30363d] text-[#8b949e]"
                        }`}
                      >
                        {row.plan}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-[#8b949e]">
                      {formatDate(row.createdAt)}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`text-[10px] font-bold ${
                          row.smsActive ? "text-[#3fb950]" : "text-[#484f58]"
                        }`}
                      >
                        {row.smsActive ? "● ON" : "○ OFF"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-[#e6edf3]">
                      {row.apptCount}
                    </td>
                    <td className="px-4 py-2.5 text-right text-[#e6edf3]">
                      {row.payCount}
                    </td>
                    <td className="px-4 py-2.5 text-[#8b949e]">
                      {row.lastActive ? formatDate(row.lastActive) : "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-1 flex-wrap">
                        {row.neverSetup && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#f8514920] text-[#f85149] uppercase">
                            Never Setup
                          </span>
                        )}
                        {row.inactive && !row.neverSetup && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#d2992220] text-[#d29922] uppercase">
                            Inactive
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Stripe charges full list */}
        {stripeData.recentCharges && stripeData.recentCharges.length > 0 && (
          <div className="mb-6">
            <div className="text-[#8b949e] text-xs uppercase tracking-wider mb-3">
              Recent Stripe Charges
            </div>
            <div className="bg-[#161b22] border border-[#30363d] rounded overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#30363d] text-[#8b949e]">
                    <th className="text-left px-4 py-3 font-normal">ID</th>
                    <th className="text-left px-4 py-3 font-normal">Description</th>
                    <th className="text-right px-4 py-3 font-normal">Amount</th>
                    <th className="text-left px-4 py-3 font-normal">Status</th>
                    <th className="text-left px-4 py-3 font-normal">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {stripeData.recentCharges.map((charge) => (
                    <tr
                      key={charge.id}
                      className="border-b border-[#21262d] hover:bg-[#1c2128] transition-colors"
                    >
                      <td className="px-4 py-2.5 text-[#484f58]">
                        {charge.id.slice(0, 16)}...
                      </td>
                      <td className="px-4 py-2.5 text-[#8b949e]">
                        {charge.description ?? "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right text-[#e6edf3]">
                        {formatMoney(charge.amount)}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`text-[10px] font-bold ${
                            charge.status === "succeeded"
                              ? "text-[#3fb950]"
                              : "text-[#f85149]"
                          }`}
                        >
                          {charge.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-[#8b949e]">
                        {new Date(charge.created * 1000).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="text-[#484f58] text-xs text-center pb-4">
          wagzly admin · data refreshes on page load
        </div>
      </div>
    </div>
  );
}

async function fetchStripeData(): Promise<{
  mrr: string | null;
  activeSubs: number | null;
  recentCharges: StripeCharge[] | null;
}> {
  try {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) return { mrr: null, activeSubs: null, recentCharges: null };

    const headers = {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    };

    const [subsRes, chargesRes] = await Promise.all([
      fetch(
        "https://api.stripe.com/v1/subscriptions?status=active&limit=100&expand[]=data.plan",
        { headers }
      ),
      fetch("https://api.stripe.com/v1/charges?limit=10", { headers }),
    ]);

    const [subsData, chargesData] = await Promise.all([
      subsRes.json(),
      chargesRes.json(),
    ]);

    const subs: StripeSub[] = subsData.data ?? [];
    let mrrCents = 0;
    for (const sub of subs) {
      const amount = sub.plan?.amount ?? 0;
      const interval = sub.plan?.interval ?? "month";
      mrrCents += interval === "year" ? Math.round(amount / 12) : amount;
    }

    const charges: StripeCharge[] = chargesData.data ?? [];

    return {
      mrr: `$${(mrrCents / 100).toFixed(2)}`,
      activeSubs: subs.length,
      recentCharges: charges,
    };
  } catch {
    return { mrr: null, activeSubs: null, recentCharges: null };
  }
}
