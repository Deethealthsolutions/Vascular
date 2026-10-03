"use client";

import { age, minutesSince, stageLabel, useNow, visitTypeLabel, vitalAlerts, type Acuity, type Stage, type Visit } from "@/lib/clinic";

export function AcuityChip({ acuity }: { acuity: Acuity }) {
  const s = { emergent: "bg-alert text-white", urgent: "bg-alert-soft text-alert", routine: "bg-white text-muted border border-line" }[acuity];
  return <span className={`chip capitalize ${s}`}>{acuity}</span>;
}

const stageStyle: Record<Stage, string> = {
  waiting: "bg-warn-soft text-warn",
  triage: "bg-brand-soft text-brand-dark",
  ready: "bg-ok-soft text-ok",
  provider: "bg-brand text-white",
  lab: "bg-[#ece6fb] text-[#4b2a9e]",
  checkout: "bg-[#e0f0ff] text-[#0b4a8b]",
  done: "bg-surface text-muted border border-line",
};

export function StageChip({ stage }: { stage: Stage }) {
  return <span className={`chip whitespace-nowrap ${stageStyle[stage]}`}>{stageLabel[stage]}</span>;
}

export function Minutes({ since, warnAfter }: { since: string; warnAfter?: number }) {
  const now = useNow();
  if (now === null) return <span>–</span>;
  const m = minutesSince(since, now);
  const late = warnAfter !== undefined && m >= warnAfter;
  return <span className={late ? "font-semibold text-alert" : ""}>{m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`}</span>;
}

/** Sticky identity banner shown on every chart screen (two identifiers: name + DOB, plus MRN). */
export function PatientBanner({ v }: { v: Visit }) {
  const p = v.patient;
  const alerts = [...v.redFlags, ...vitalAlerts(v.vitals)];
  return (
    <div className="border-b border-line bg-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <div>
          <p className="text-xl font-bold text-brand-dark">{p.last.toUpperCase()}, {p.first}</p>
          <p className="text-sm text-muted">
            {age(p.dob)}y {p.sex} · DOB {p.dob} · {p.mrn} · {p.language}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AcuityChip acuity={v.acuity} />
          <StageChip stage={v.stage} />
          <span className="chip border border-line bg-white">{visitTypeLabel[v.visitType]}</span>
          {v.room && <span className="chip border border-line bg-white">📍 {v.room}</span>}
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <span className={`chip ${p.allergies === "NKDA" ? "bg-surface text-muted" : "bg-alert-soft font-semibold text-alert"}`}>
            Allergies: {p.allergies}
          </span>
          {v.fallRisk && <span className="chip bg-warn-soft font-semibold text-warn">Fall risk</span>}
          {v.history?.anticoag && <span className="chip bg-warn-soft text-warn">Anticoagulated</span>}
          {v.history?.diabetes && v.history.diabetes !== "none" && <span className="chip bg-surface">Diabetes</span>}
          {alerts.map((a) => <span key={a} className="chip bg-alert text-white">⚠ {a}</span>)}
        </div>
        <div className="ml-auto text-right text-sm text-muted">
          In clinic <Minutes since={v.arrivedAt} /> · {v.eligibility.status === "verified" ? `Ins. verified ${v.eligibility.copay ?? ""}` : `Ins. ${v.eligibility.status}`}
        </div>
      </div>
    </div>
  );
}

export function Section({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold text-brand-dark">{title}</h2>
        {aside}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function Select<T extends string>({ label, value, options, onChange }: {
  label: string; value: T; options: readonly (T | readonly [T, string])[]; onChange: (v: T) => void;
}) {
  return (
    <label className="block">
      <span className="label text-sm">{label}</span>
      <select className="input py-2" value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => {
          const [val, text] = Array.isArray(o) ? o : [o, o];
          return <option key={val} value={val}>{text}</option>;
        })}
      </select>
    </label>
  );
}

export function Small({ label, value, onChange, suffix, placeholder, wide }: {
  label: string; value: string; onChange: (v: string) => void; suffix?: string; placeholder?: string; wide?: boolean;
}) {
  return (
    <label className={`block ${wide ? "sm:col-span-2" : ""}`}>
      <span className="label text-sm">{label}</span>
      <span className="flex items-center gap-1.5">
        <input className="input py-2" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
        {suffix && <span className="shrink-0 text-sm text-muted">{suffix}</span>}
      </span>
    </label>
  );
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${checked ? "border-brand bg-brand-soft" : "border-line bg-white"}`}>
      <input type="checkbox" className="size-4 accent-brand" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
