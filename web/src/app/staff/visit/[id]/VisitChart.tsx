"use client";

import Link from "next/link";
import { useState } from "react";
import { PatientBanner } from "@/components/staff/ui";
import { stageLabel, stages, useStaff, useVisits } from "@/lib/clinic";
import { SummaryTab } from "./SummaryTab";
import { TriageTab } from "./TriageTab";
import { WoundsTab } from "./WoundsTab";
import { ProviderTab } from "./ProviderTab";
import { LabTab } from "./LabTab";
import { CheckoutTab } from "./CheckoutTab";

export type Tab = "summary" | "triage" | "wounds" | "provider" | "lab" | "checkout";

const tabMeta: { id: Tab; label: string; who: string }[] = [
  { id: "summary", label: "Overview", who: "All" },
  { id: "triage", label: "Triage & vitals", who: "Nurse" },
  { id: "wounds", label: "Wound assessment", who: "Nurse / Provider" },
  { id: "provider", label: "Provider exam & orders", who: "Provider" },
  { id: "lab", label: "Vascular lab", who: "Vascular tech" },
  { id: "checkout", label: "Checkout", who: "Front desk" },
];

export function VisitChart({ id, initialTab }: { id: string; initialTab: Tab }) {
  const visits = useVisits();
  const me = useStaff();
  const [tab, setTab] = useState<Tab>(initialTab);

  if (!visits) return <div className="mx-auto max-w-7xl px-4 py-10 text-muted">Loading chart…</div>;
  const v = visits.find((x) => x.id === id);
  if (!v) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10">
        <p className="text-xl font-semibold">Visit {id} not found</p>
        <Link href="/staff" className="btn-secondary mt-4">Back to board</Link>
      </div>
    );
  }

  const stageIdx = stages.indexOf(v.stage);
  const go = (t: Tab) => { setTab(t); window.scrollTo({ top: 0 }); };

  return (
    <div>
      <div className="sticky top-[52px] z-30 shadow-sm print:hidden"><PatientBanner v={v} /></div>
      <div className="mx-auto max-w-7xl px-4 py-5">
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Link href="/staff" className="text-sm font-semibold text-brand">← Clinic board</Link>
          <ol className="flex flex-wrap items-center gap-1 text-xs" aria-label="Visit progress">
            {stages.map((s, i) => (
              <li key={s} className="flex items-center gap-1">
                <span className={`rounded-full px-2 py-0.5 ${i < stageIdx ? "bg-ok-soft text-ok" : i === stageIdx ? "bg-brand font-semibold text-white" : "bg-white text-muted border border-line"}`}>
                  {stageLabel[s]}
                </span>
                {i < stages.length - 1 && <span aria-hidden className="text-muted">›</span>}
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-4 flex gap-1 overflow-x-auto border-b border-line print:hidden" role="tablist">
          {tabMeta.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
              className={`shrink-0 border-b-2 px-4 py-2.5 text-sm ${tab === t.id ? "border-brand font-semibold text-brand-dark" : "border-transparent text-muted hover:text-ink"}`}>
              {t.label}
              <span className="ml-1.5 hidden text-xs text-muted lg:inline">({t.who})</span>
            </button>
          ))}
        </div>

        <div className="mt-5">
          {tab === "summary" && <SummaryTab v={v} />}
          {tab === "triage" && <TriageTab key={v.id} v={v} me={me} go={go} />}
          {tab === "wounds" && <WoundsTab key={v.id} v={v} me={me} go={go} />}
          {tab === "provider" && <ProviderTab key={v.id} v={v} me={me} go={go} />}
          {tab === "lab" && <LabTab key={v.id} v={v} me={me} go={go} />}
          {tab === "checkout" && <CheckoutTab key={v.id} v={v} me={me} />}
        </div>
      </div>
    </div>
  );
}
