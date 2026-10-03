"use client";

import Link from "next/link";
import { useState } from "react";
import { AcuityChip, Minutes, StageChip } from "@/components/staff/ui";
import { age, minutesSince, stages, useNow, useVisits, visitTypeLabel, vitalAlerts, type Stage, type Visit } from "@/lib/clinic";

const acuityRank = { emergent: 0, urgent: 1, routine: 2 };

const nextAction: Record<Stage, { label: string; tab: string }> = {
  waiting: { label: "Start triage", tab: "triage" },
  triage: { label: "Continue triage", tab: "triage" },
  ready: { label: "See patient", tab: "provider" },
  provider: { label: "Open exam", tab: "provider" },
  lab: { label: "Vascular lab", tab: "lab" },
  checkout: { label: "Check out", tab: "checkout" },
  done: { label: "View", tab: "summary" },
};

// Minutes in a stage before the timer turns red (demo targets, set by clinic operations).
const stageTarget: Partial<Record<Stage, number>> = { waiting: 20, ready: 15, checkout: 15 };

export function ClinicBoard() {
  const visits = useVisits();
  const now = useNow();
  const [view, setView] = useState<"active" | "done">("active");

  if (!visits) return <div className="mx-auto max-w-7xl px-4 py-10 text-muted">Loading board…</div>;

  const active = visits.filter((v) => v.stage !== "done");
  const done = visits.filter((v) => v.stage === "done");
  const rows = (view === "active" ? active : done).sort(
    (a, b) => acuityRank[a.acuity] - acuityRank[b.acuity] || a.arrivedAt.localeCompare(b.arrivedAt),
  );
  const waiting = active.filter((v) => v.stage === "waiting");
  const avgWait = now && waiting.length ? Math.round(waiting.reduce((s, v) => s + minutesSince(v.arrivedAt, now), 0) / waiting.length) : 0;
  const escalations = active.filter((v) => v.acuity === "emergent");

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-dark">Clinic board</h1>
          <p className="text-muted">Main Campus · Wound, Vascular &amp; Hyperbaric Center</p>
        </div>
        <Link href="/staff/check-in" className="btn-primary">+ Check in patient</Link>
      </div>

      {escalations.map((v) => (
        <Link key={v.id} href={`/staff/visit/${v.id}?tab=triage`}
          className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border-2 border-alert bg-alert-soft p-4 text-alert">
          <span className="text-lg font-bold">⚠ Emergent</span>
          <span className="text-ink">{v.patient.last}, {v.patient.first}: {v.redFlags.join(", ") || "flagged emergent"}</span>
          <span className="ml-auto font-semibold">Nurse to bedside now →</span>
        </Link>
      ))}

      <div className="mt-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi label="In clinic" value={active.length} />
        <Kpi label="Waiting room" value={waiting.length} sub={waiting.length ? `avg ${avgWait} min` : undefined} warn={avgWait >= 20} />
        <Kpi label="In triage" value={active.filter((v) => v.stage === "triage").length} />
        <Kpi label="Ready for provider" value={active.filter((v) => v.stage === "ready").length} />
        <Kpi label="Vascular lab" value={active.filter((v) => v.stage === "lab").length} />
        <Kpi label="Completed today" value={done.length} />
      </div>

      <div className="mt-6 flex gap-2">
        {(["active", "done"] as const).map((k) => (
          <button key={k} onClick={() => setView(k)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${view === k ? "bg-brand text-white" : "bg-white text-muted border border-line"}`}>
            {k === "active" ? `Active (${active.length})` : `Completed (${done.length})`}
          </button>
        ))}
      </div>

      <div className="mt-3 overflow-x-auto rounded-xl border border-line bg-white">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-surface text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Patient</th>
              <th className="px-4 py-3 font-medium">Visit</th>
              <th className="px-4 py-3 font-medium">Acuity</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Room</th>
              <th className="px-4 py-3 font-medium">In clinic</th>
              <th className="px-4 py-3 font-medium">Alerts</th>
              <th className="px-4 py-3"><span className="sr-only">Action</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-muted">No patients here.</td></tr>
            )}
            {rows.map((v) => <Row key={v.id} v={v} />)}
          </tbody>
        </table>
      </div>

      <StageLegend />
    </div>
  );
}

function Row({ v }: { v: Visit }) {
  const p = v.patient;
  const alerts = [...v.redFlags, ...vitalAlerts(v.vitals)];
  const action = nextAction[v.stage];
  return (
    <tr className={v.acuity === "emergent" ? "bg-alert-soft/60" : "hover:bg-surface"}>
      <td className="px-4 py-3">
        <Link href={`/staff/visit/${v.id}`} className="font-semibold text-brand-dark hover:underline">{p.last}, {p.first}</Link>
        <div className="text-muted">{age(p.dob)}y {p.sex} · {p.mrn}</div>
      </td>
      <td className="max-w-64 px-4 py-3">
        <div className="font-medium">{visitTypeLabel[v.visitType]} <span className="font-normal text-muted">· {v.arrivalMode}</span></div>
        <div className="truncate text-muted" title={v.chiefComplaint}>{v.chiefComplaint}</div>
      </td>
      <td className="px-4 py-3"><AcuityChip acuity={v.acuity} /></td>
      <td className="px-4 py-3">
        <StageChip stage={v.stage} />
        {v.stage !== "done" && <div className="mt-1 text-muted"><Minutes since={v.stageSince} warnAfter={stageTarget[v.stage]} /> in stage</div>}
        {v.disposition && <div className="mt-1 text-muted capitalize">{v.disposition.replace("-", " to ")}</div>}
      </td>
      <td className="px-4 py-3">{v.room ?? <span className="text-muted">–</span>}</td>
      <td className="px-4 py-3"><Minutes since={v.arrivedAt} /></td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {p.allergies !== "NKDA" && <span className="chip bg-alert-soft text-xs text-alert">Allergy</span>}
          {v.fallRisk && <span className="chip bg-warn-soft text-xs text-warn">Fall</span>}
          {p.language !== "English" && <span className="chip bg-surface text-xs">Interpreter</span>}
          {alerts.slice(0, 2).map((a) => <span key={a} className="chip bg-alert text-xs text-white">{a}</span>)}
        </div>
      </td>
      <td className="px-4 py-3 text-right">
        <Link href={`/staff/visit/${v.id}?tab=${action.tab}`} className={v.stage === "done" ? "btn-ghost px-3 py-1.5 text-sm" : "btn-primary px-3 py-1.5 text-sm"}>
          {action.label}
        </Link>
      </td>
    </tr>
  );
}

function Kpi({ label, value, sub, warn }: { label: string; value: number; sub?: string; warn?: boolean }) {
  return (
    <div className="rounded-xl border border-line bg-white p-4">
      <p className="text-3xl font-bold text-brand-dark">{value}</p>
      <p className="text-sm text-muted">{label}</p>
      {sub && <p className={`text-sm ${warn ? "font-semibold text-alert" : "text-muted"}`}>{sub}</p>}
    </div>
  );
}

function StageLegend() {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-muted">
      Patient flow:
      {stages.map((s, i) => (
        <span key={s} className="flex items-center gap-2">
          <StageChip stage={s} />
          {i < stages.length - 1 && <span aria-hidden>→</span>}
        </span>
      ))}
    </div>
  );
}
