"use client";

import Link from "next/link";
import { useState } from "react";
import { StatusChip, UrgencyChip } from "@/components/StatusChip";
import { fmtDate, useReferrals, type Referral } from "@/lib/referrals";

const filters = {
  all: { label: "All", test: () => true },
  open: { label: "In progress", test: (r: Referral) => ["received", "under_review", "scheduled"].includes(r.status) },
  action: { label: "Needs your action", test: (r: Referral) => r.status === "needs_info" },
  done: { label: "Completed", test: (r: Referral) => ["seen", "summary_sent", "declined"].includes(r.status) },
} as const;
type FilterKey = keyof typeof filters;

export function ReferralDashboard() {
  const referrals = useReferrals();
  const [filter, setFilter] = useState<FilterKey>("all");

  const list = referrals ?? [];
  const count = (k: FilterKey) => list.filter(filters[k].test).length;
  const shown = list.filter(filters[filter].test);
  const lastUpdate = (r: Referral) => r.events[r.events.length - 1].at;

  return (
    <div className="container-page py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Referral portal</p>
          <h1 className="mt-2 text-3xl font-bold text-brand-dark">My referrals</h1>
          <p className="mt-1 text-muted">Signed in as Dr. Demo Referrer · Demo Family Practice</p>
        </div>
        <Link href="/refer" className="btn-primary">+ New referral</Link>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-4">
        {(Object.keys(filters) as FilterKey[]).map((k) => (
          <button key={k} onClick={() => setFilter(k)}
            className={`rounded-xl border-2 p-4 text-left transition ${filter === k ? "border-brand bg-brand-soft" : "border-line bg-white hover:border-brand"}`}>
            <span className="block text-3xl font-bold text-brand-dark">{referrals ? count(k) : "–"}</span>
            <span className={k === "action" && count(k) > 0 ? "font-semibold text-warn" : "text-muted"}>{filters[k].label}</span>
          </button>
        ))}
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-line">
        <table className="w-full text-left">
          <thead className="bg-surface text-sm text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Referral</th>
              <th className="px-4 py-3 font-medium">Patient</th>
              <th className="hidden px-4 py-3 font-medium md:table-cell">Reason</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="hidden px-4 py-3 font-medium sm:table-cell">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {referrals === null && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted">Loading…</td></tr>
            )}
            {referrals && shown.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted">No referrals here.</td></tr>
            )}
            {shown.map((r) => (
              <tr key={r.id} className="hover:bg-surface">
                <td className="px-4 py-3">
                  <Link href={`/portal/${r.id}`} className="font-semibold text-brand hover:underline">{r.id}</Link>
                  <div className="mt-1"><UrgencyChip urgency={r.urgency} /></div>
                </td>
                <td className="px-4 py-3">
                  {r.patientName}
                  <div className="text-sm text-muted">DOB {r.patientDob}</div>
                </td>
                <td className="hidden px-4 py-3 text-sm md:table-cell">{r.reasons.join(", ")}</td>
                <td className="px-4 py-3"><StatusChip status={r.status} /></td>
                <td className="hidden px-4 py-3 text-sm text-muted sm:table-cell">{fmtDate(lastUpdate(r))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-sm text-muted">Referrals you create in this prototype are saved in this browser only.</p>
    </div>
  );
}
