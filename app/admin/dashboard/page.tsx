import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession } from "../../../lib/admin-auth";
import { supabaseAdmin } from "../../../lib/supabase-admin";
import AdminLogoutButton from "./AdminLogoutButton";
import UserTable from "./UserTable";

type Business = {
  id: string;
  plan: string;
  created_at: string;
};

type StripeSub = {
  id: string;
  plan: { amount: number; interval: string };
};

type StripeCharge = {
  id: string;
  amount: number;
  currency: string;
  description: string | null;
  created: number;
  status: string;
};

type StripeData = {
  mrr: string | null;
  activeSubs: number | null;
  totalRevenue: string | null;
  weeklyRevenue: string | null;
  recentCharges: StripeCharge[] | null;
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
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
    supabaseAdmin.from("business_settings").select("business_id, business_name"),
    supabaseAdmin.from("business_sms_setup").select("business_id, status"),
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

  const lastApptByBiz = new Map<string, string>();
  const apptCountByBiz = new Map<string, number>();
  for (const appt of appointments ?? []) {
    if (!lastApptByBiz.has(appt.business_id)) {
      lastApptByBiz.set(appt.business_id, appt.created_at);
    }
    apptCountByBiz.set(appt.business_id, (apptCountByBiz.get(appt.business_id) ?? 0) + 1);
  }

  const lastPaymentByBiz = new Map<string, string>();
  const payCountByBiz = new Map<string, number>();
  for (const pay of payments ?? []) {
    if (!lastPaymentByBiz.has(pay.business_id)) {
      lastPaymentByBiz.set(pay.business_id, pay.created_at);
    }
    payCountByBiz.set(pay.business_id, (payCountByBiz.get(pay.business_id) ?? 0) + 1);
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

        {/* Business overview */}
        <div className="mb-6">
          <div className="text-[#8b949e] text-xs uppercase tracking-wider mb-3">Businesses</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: "Total", value: totalBusinesses, color: "text-[#e6edf3]" },
              { label: "New This Week", value: newThisWeek, color: "text-[#3fb950]" },
              { label: "New This Month", value: newThisMonth, color: "text-[#3fb950]" },
              { label: "Pro Plan", value: proPlan, color: "text-[#58a6ff]" },
              { label: "Basic Plan", value: basicPlan, color: "text-[#8b949e]" },
              { label: "SMS Active", value: smsActive, color: "text-[#d29922]" },
            ].map((stat) => (
              <div key={stat.label} className="bg-[#161b22] border border-[#30363d] rounded p-4">
                <div className={`text-3xl font-bold ${stat.color}`}>{stat.value}</div>
                <div className="text-[#8b949e] text-xs mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Revenue */}
        <div className="mb-6">
          <div className="text-[#8b949e] text-xs uppercase tracking-wider mb-3">
            Revenue (Stripe subscriptions)
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[#161b22] border border-[#30363d] rounded p-4">
              <div className="text-3xl font-bold text-[#3fb950]">
                {stripeData.mrr ?? "—"}
              </div>
              <div className="text-[#8b949e] text-xs mt-1">MRR</div>
            </div>
            <div className="bg-[#161b22] border border-[#30363d] rounded p-4">
              <div className="text-3xl font-bold text-[#3fb950]">
                {stripeData.weeklyRevenue ?? "—"}
              </div>
              <div className="text-[#8b949e] text-xs mt-1">Revenue This Week</div>
            </div>
            <div className="bg-[#161b22] border border-[#30363d] rounded p-4">
              <div className="text-3xl font-bold text-[#58a6ff]">
                {stripeData.activeSubs ?? "—"}
              </div>
              <div className="text-[#8b949e] text-xs mt-1">Active Subscriptions</div>
            </div>
            <div className="bg-[#161b22] border border-[#30363d] rounded p-4">
              <div className="text-3xl font-bold text-[#e6edf3]">
                {stripeData.totalRevenue ?? "—"}
              </div>
              <div className="text-[#8b949e] text-xs mt-1">All-Time Revenue</div>
            </div>
          </div>
        </div>

        {/* User table */}
        <div className="mb-6">
          <div className="text-[#8b949e] text-xs uppercase tracking-wider mb-3">
            Businesses ({totalBusinesses})
          </div>
          <UserTable rows={userRows} />
        </div>

        {/* Recent Stripe charges */}
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
                        <span className={`text-[10px] font-bold ${charge.status === "succeeded" ? "text-[#3fb950]" : "text-[#f85149]"}`}>
                          {charge.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-[#8b949e]">
                        {formatDate(new Date(charge.created * 1000).toISOString())}
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

async function fetchStripeData(): Promise<StripeData> {
  try {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) return { mrr: null, activeSubs: null, totalRevenue: null, weeklyRevenue: null, recentCharges: null };

    const headers = { Authorization: `Bearer ${key}` };
    const weekAgoUnix = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000);

    // Fetch active subs, all-time balance transactions, weekly charges, and recent charges
    const [subsRes, balanceRes, weeklyRes, recentRes] = await Promise.all([
      fetch("https://api.stripe.com/v1/subscriptions?status=active&limit=100&expand[]=data.plan", { headers }),
      fetch("https://api.stripe.com/v1/balance_transactions?type=charge&limit=100", { headers }),
      fetch(`https://api.stripe.com/v1/charges?limit=100&created[gte]=${weekAgoUnix}&status=succeeded`, { headers }),
      fetch("https://api.stripe.com/v1/charges?limit=10", { headers }),
    ]);

    const [subsData, balanceData, weeklyData, recentData] = await Promise.all([
      subsRes.json(),
      balanceRes.json(),
      weeklyRes.json(),
      recentRes.json(),
    ]);

    // MRR from active subscriptions
    const subs: StripeSub[] = subsData.data ?? [];
    let mrrCents = 0;
    for (const sub of subs) {
      const amount = sub.plan?.amount ?? 0;
      const interval = sub.plan?.interval ?? "month";
      mrrCents += interval === "year" ? Math.round(amount / 12) : amount;
    }

    // All-time revenue from balance transactions
    const balanceTxns: { net: number }[] = balanceData.data ?? [];
    const totalRevenueCents = balanceTxns.reduce((sum, t) => sum + (t.net ?? 0), 0);

    // Weekly revenue
    const weeklyCharges: StripeCharge[] = weeklyData.data ?? [];
    const weeklyRevenueCents = weeklyCharges.reduce((sum, c) => sum + c.amount, 0);

    const recentCharges: StripeCharge[] = recentData.data ?? [];

    return {
      mrr: `$${(mrrCents / 100).toFixed(2)}`,
      activeSubs: subs.length,
      totalRevenue: `$${(totalRevenueCents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      weeklyRevenue: `$${(weeklyRevenueCents / 100).toFixed(2)}`,
      recentCharges,
    };
  } catch {
    return { mrr: null, activeSubs: null, totalRevenue: null, weeklyRevenue: null, recentCharges: null };
  }
}
