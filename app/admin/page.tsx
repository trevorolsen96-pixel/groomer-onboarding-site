"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await fetch("/api/admin/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      // Always move to OTP step — don't reveal if email matched
      setStep("otp");
    } catch {
      setError("Failed to send code. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Invalid code.");
        return;
      }
      router.push("/admin/dashboard");
    } catch {
      setError("Verification failed. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center px-4 font-mono">
      <div className="w-full max-w-sm">

        {/* Header */}
        <div className="mb-8 text-center">
          <div className="text-[#3fb950] text-xs font-bold tracking-[0.3em] uppercase mb-2">
            WAGZLY
          </div>
          <div className="text-[#e6edf3] text-xl font-bold">Admin Access</div>
          <div className="text-[#8b949e] text-xs mt-1">Restricted — authorized personnel only</div>
        </div>

        {/* Card */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-6">

          {step === "email" ? (
            <form onSubmit={handleSendOtp}>
              <label className="block text-[#8b949e] text-xs font-bold uppercase tracking-wider mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                placeholder="admin@wagzly.com"
                className="w-full bg-[#0f1117] border border-[#30363d] rounded px-3 py-2.5 text-[#e6edf3] text-sm font-mono placeholder-[#484f58] focus:outline-none focus:border-[#3fb950] mb-4"
              />
              {error && (
                <div className="text-[#f85149] text-xs mb-4">{error}</div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#238636] hover:bg-[#2ea043] disabled:opacity-50 text-white font-bold text-sm py-2.5 rounded transition-colors"
              >
                {loading ? "Sending..." : "Send Code →"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp}>
              <div className="text-[#8b949e] text-xs mb-4">
                Code sent to <span className="text-[#e6edf3]">{email}</span>
              </div>
              <label className="block text-[#8b949e] text-xs font-bold uppercase tracking-wider mb-2">
                6-Digit Code
              </label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                required
                autoFocus
                placeholder="000000"
                maxLength={6}
                className="w-full bg-[#0f1117] border border-[#30363d] rounded px-3 py-2.5 text-[#e6edf3] text-2xl font-mono placeholder-[#484f58] focus:outline-none focus:border-[#3fb950] mb-4 text-center tracking-[0.3em]"
              />
              {error && (
                <div className="text-[#f85149] text-xs mb-4">{error}</div>
              )}
              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="w-full bg-[#238636] hover:bg-[#2ea043] disabled:opacity-50 text-white font-bold text-sm py-2.5 rounded transition-colors mb-3"
              >
                {loading ? "Verifying..." : "Verify →"}
              </button>
              <button
                type="button"
                onClick={() => { setStep("email"); setOtp(""); setError(""); }}
                className="w-full text-[#8b949e] text-xs hover:text-[#e6edf3] transition-colors"
              >
                ← Back
              </button>
            </form>
          )}
        </div>

        <div className="text-center text-[#484f58] text-xs mt-6">
          wagzly.com/admin
        </div>
      </div>
    </div>
  );
}
