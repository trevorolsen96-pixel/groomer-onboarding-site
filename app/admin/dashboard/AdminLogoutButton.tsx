"use client";

import { useRouter } from "next/navigation";

export default function AdminLogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin");
  }

  return (
    <button
      onClick={handleLogout}
      className="text-[#f85149] hover:text-[#ff7b72] transition-colors text-xs font-bold uppercase tracking-wider"
    >
      Logout
    </button>
  );
}
