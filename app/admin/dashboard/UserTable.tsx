"use client";

import { useState, useMemo } from "react";

type UserRow = {
  id: string;
  name: string;
  plan: string;
  createdAt: string;
  smsActive: boolean;
  apptCount: number;
  payCount: number;
  lastActive: string | null;
  neverSetup: boolean;
  inactive: boolean;
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function UserTable({ rows }: { rows: UserRow[] }) {
  const [search, setSearch] = useState("");
  const [filterPlan, setFilterPlan] = useState<"all" | "pro" | "basic">("all");
  const [filterSms, setFilterSms] = useState<"all" | "active" | "inactive">("all");
  const [filterFlag, setFilterFlag] = useState<"all" | "never_setup" | "inactive">("all");
  const [sortBy, setSortBy] = useState<"createdAt" | "lastActive" | "apptCount" | "payCount">("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const filtered = useMemo(() => {
    let result = [...rows];

    // Search
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.id.toLowerCase().includes(q)
      );
    }

    // Plan filter
    if (filterPlan !== "all") {
      result = result.filter((r) =>
        filterPlan === "pro"
          ? r.plan.toLowerCase() === "pro"
          : r.plan.toLowerCase() !== "pro"
      );
    }

    // SMS filter
    if (filterSms !== "all") {
      result = result.filter((r) =>
        filterSms === "active" ? r.smsActive : !r.smsActive
      );
    }

    // Flag filter
    if (filterFlag === "never_setup") {
      result = result.filter((r) => r.neverSetup);
    } else if (filterFlag === "inactive") {
      result = result.filter((r) => r.inactive && !r.neverSetup);
    }

    // Sort
    result.sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;

      if (sortBy === "createdAt") {
        aVal = a.createdAt;
        bVal = b.createdAt;
      } else if (sortBy === "lastActive") {
        aVal = a.lastActive ?? "";
        bVal = b.lastActive ?? "";
      } else if (sortBy === "apptCount") {
        aVal = a.apptCount;
        bVal = b.apptCount;
      } else {
        aVal = a.payCount;
        bVal = b.payCount;
      }

      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [rows, search, filterPlan, filterSms, filterFlag, sortBy, sortDir]);

  function toggleSort(col: typeof sortBy) {
    if (sortBy === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(col);
      setSortDir("desc");
    }
  }

  function SortIcon({ col }: { col: typeof sortBy }) {
    if (sortBy !== col) return <span className="text-[#484f58] ml-1">↕</span>;
    return (
      <span className="text-[#3fb950] ml-1">
        {sortDir === "asc" ? "↑" : "↓"}
      </span>
    );
  }

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-wrap gap-2 mb-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or ID..."
          className="bg-[#0f1117] border border-[#30363d] rounded px-3 py-1.5 text-[#e6edf3] text-xs font-mono placeholder-[#484f58] focus:outline-none focus:border-[#3fb950] w-52"
        />
        <select
          value={filterPlan}
          onChange={(e) => setFilterPlan(e.target.value as typeof filterPlan)}
          className="bg-[#0f1117] border border-[#30363d] rounded px-3 py-1.5 text-[#8b949e] text-xs font-mono focus:outline-none focus:border-[#3fb950]"
        >
          <option value="all">All plans</option>
          <option value="pro">Pro only</option>
          <option value="basic">Basic only</option>
        </select>
        <select
          value={filterSms}
          onChange={(e) => setFilterSms(e.target.value as typeof filterSms)}
          className="bg-[#0f1117] border border-[#30363d] rounded px-3 py-1.5 text-[#8b949e] text-xs font-mono focus:outline-none focus:border-[#3fb950]"
        >
          <option value="all">All SMS</option>
          <option value="active">SMS active</option>
          <option value="inactive">SMS inactive</option>
        </select>
        <select
          value={filterFlag}
          onChange={(e) => setFilterFlag(e.target.value as typeof filterFlag)}
          className="bg-[#0f1117] border border-[#30363d] rounded px-3 py-1.5 text-[#8b949e] text-xs font-mono focus:outline-none focus:border-[#3fb950]"
        >
          <option value="all">All flags</option>
          <option value="never_setup">Never setup</option>
          <option value="inactive">Inactive 30d+</option>
        </select>
        <div className="text-[#484f58] text-xs self-center ml-auto">
          {filtered.length} of {rows.length}
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#161b22] border border-[#30363d] rounded overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[#30363d] text-[#8b949e]">
              <th className="text-left px-4 py-3 font-normal">Business</th>
              <th className="text-left px-4 py-3 font-normal">Plan</th>
              <th
                className="text-left px-4 py-3 font-normal cursor-pointer hover:text-[#e6edf3]"
                onClick={() => toggleSort("createdAt")}
              >
                Signed Up <SortIcon col="createdAt" />
              </th>
              <th className="text-left px-4 py-3 font-normal">SMS</th>
              <th
                className="text-right px-4 py-3 font-normal cursor-pointer hover:text-[#e6edf3]"
                onClick={() => toggleSort("apptCount")}
              >
                Appts <SortIcon col="apptCount" />
              </th>
              <th
                className="text-right px-4 py-3 font-normal cursor-pointer hover:text-[#e6edf3]"
                onClick={() => toggleSort("payCount")}
              >
                Payments <SortIcon col="payCount" />
              </th>
              <th
                className="text-left px-4 py-3 font-normal cursor-pointer hover:text-[#e6edf3]"
                onClick={() => toggleSort("lastActive")}
              >
                Last Active <SortIcon col="lastActive" />
              </th>
              <th className="text-left px-4 py-3 font-normal">Flags</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-[#484f58]">
                  No results
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-[#21262d] hover:bg-[#1c2128] transition-colors"
                >
                  <td className="px-4 py-2.5">
                    <div className="text-[#e6edf3] font-medium">{row.name}</div>
                    <div className="text-[#484f58] text-[10px] mt-0.5">
                      {row.id.slice(0, 8)}...
                    </div>
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
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
