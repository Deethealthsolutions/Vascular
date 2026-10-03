"use client";

import { useState } from "react";
import { Section, Select, Toggle } from "@/components/staff/ui";
import {
  by, computeAbi, interpretAbi, moveStage, updateVisit, vitalAlerts, woundArea,
  type Plan, type StaffUser, type Visit,
} from "@/lib/clinic";
import type { Tab } from "./VisitChart";

const orderGroups = {
  Diagnostics: ["ABI / TBI", "Arterial duplex", "Venous duplex", "TcPO₂", "X-ray foot", "MRI foot", "Wound culture", "Labs: CBC, CRP, ESR, A1c, BMP"],
  "Next steps": ["Angiography ± intervention", "HBOT evaluation / series", "Custom footwear / offloading referral", "Infectious disease consult", "Diabetes education"],
};
const procedures = ["Sharp debridement", "Total contact cast", "Compression wrap", "NPWT placement", "Skin substitute application", "Advanced dressing"];

const wagner = [["", "–"], ["0", "0: Pre-ulcerative"], ["1", "1: Superficial"], ["2", "2: Deep (tendon/capsule)"], ["3", "3: Abscess / osteomyelitis"], ["4", "4: Forefoot gangrene"], ["5", "5: Whole-foot gangrene"]] as const;
const wifiW = [["", "–"], ["0", "W0: No ulcer"], ["1", "W1: Small, shallow"], ["2", "W2: Deep, exposed bone/tendon"], ["3", "W3: Extensive / deep heel"]] as const;
const wifiI = [["", "–"], ["0", "I0: ABI ≥ 0.80"], ["1", "I1: ABI 0.60–0.79"], ["2", "I2: ABI 0.40–0.59"], ["3", "I3: ABI ≤ 0.39"]] as const;
const wifiFi = [["", "–"], ["0", "fI0: No infection"], ["1", "fI1: Mild (local)"], ["2", "fI2: Moderate (> 2 cm / deep)"], ["3", "fI3: Severe (SIRS)"]] as const;

/** SVS WIfI ischemia grade from ABI. */
const ischemiaGrade = (abi?: number) => (abi === undefined ? undefined : abi >= 0.8 ? "0" : abi >= 0.6 ? "1" : abi >= 0.4 ? "2" : "3");

const toneClass = { ok: "text-ok", warn: "text-warn", alert: "text-alert", muted: "text-muted" };

const emptyPlan: Plan = { wagner: "", wifiW: "", wifiI: "", wifiFi: "", assessment: "", orders: [], procedures: [] };

export function ProviderTab({ v, me, go }: { v: Visit; me: StaffUser; go: (t: Tab) => void }) {
  const [plan, setPlan] = useState<Plan>(v.plan ?? emptyPlan);
  const [saved, setSaved] = useState(false);
  const set = (patch: Partial<Plan>) => { setPlan({ ...plan, ...patch }); setSaved(false); };
  const toggle = (key: "orders" | "procedures", item: string) =>
    set({ [key]: plan[key].includes(item) ? plan[key].filter((x) => x !== item) : [...plan[key], item] });

  const abi = v.abi ? computeAbi(v.abi) : undefined;
  const worstAbi = abi ? Math.min(...[abi.left, abi.right].filter((x): x is number => x !== undefined)) : undefined;
  const suggestedI = ischemiaGrade(Number.isFinite(worstAbi) ? worstAbi : undefined);
  const needsLab = plan.orders.includes("ABI / TBI") && !v.abi;
  const alerts = vitalAlerts(v.vitals);

  function save() {
    updateVisit(v.id, (x) => ({ ...x, plan }));
    setSaved(true);
  }

  if (v.stage === "waiting" || v.stage === "triage") {
    return <Section title="Provider exam"><p className="text-muted">Patient is still in {v.stage === "waiting" ? "the waiting room" : "triage"}. The exam opens once triage is complete.</p></Section>;
  }

  if (v.stage === "ready") {
    return (
      <Section title="Ready for provider">
        <p>Triage is complete{v.room ? ` and the patient is in ${v.room}` : ""}.</p>
        {alerts.length > 0 && <p className="mt-2 font-semibold text-alert">⚠ {alerts.join(" · ")}</p>}
        <button className="btn-primary mt-4" onClick={() => moveStage(v.id, "provider", "Provider encounter started", by(me))}>Start encounter</button>
      </Section>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-3">
        <Section title="Triage findings">
          <dl className="space-y-1 text-sm">
            <div><dt className="inline text-muted">Vitals: </dt><dd className="inline">BP {v.vitals?.bp} · HR {v.vitals?.hr} · T {v.vitals?.temp} · SpO₂ {v.vitals?.spo2}%{v.vitals?.glucose && ` · BG ${v.vitals.glucose}`}</dd></div>
            <div><dt className="inline text-muted">Pulses: </dt><dd className="inline">L {v.pulses?.dpL}/{v.pulses?.ptL} · R {v.pulses?.dpR}/{v.pulses?.ptR}</dd></div>
            <div><dt className="inline text-muted">History: </dt><dd className="inline">
              {[v.history?.diabetes !== "none" && `DM${v.history?.a1c ? ` (A1c ${v.history.a1c})` : ""}`, v.history?.smoking === "current" && "current smoker", v.history?.ckd && "CKD", v.history?.dialysis && "dialysis", v.history?.anticoag && "anticoagulated"].filter(Boolean).join(", ") || "–"}
            </dd></div>
            {alerts.length > 0 && <p className="font-semibold text-alert">⚠ {alerts.join(" · ")}</p>}
          </dl>
        </Section>
        <Section title="Wounds" aside={<button className="text-sm font-semibold text-brand" onClick={() => go("wounds")}>Edit</button>}>
          {v.wounds.length === 0 ? <p className="text-sm text-muted">No wounds documented.</p> : (
            <ul className="space-y-2 text-sm">
              {v.wounds.map((w) => (
                <li key={w.id}>
                  <strong>{w.location}</strong>: {woundArea(w)} cm², depth {w.depthCm || "–"} cm, {w.weeksOpen || "?"} wk
                  {w.probeToBone && <span className="ml-1 chip bg-alert-soft text-xs text-alert">PTB+</span>}
                  {w.infection.length > 0 && <span className="ml-1 chip bg-warn-soft text-xs text-warn">{w.infection.length} infection signs</span>}
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section title="Vascular lab">
          {!abi ? <p className="text-sm text-muted">No ABI yet.{needsLab && " Ordered, send patient to the lab."}</p> : (
            <div className="space-y-1 text-sm">
              {(["left", "right"] as const).map((side) => {
                const val = abi[side];
                const i = interpretAbi(val);
                return <p key={side} className="capitalize">{side} ABI <strong>{val?.toFixed(2) ?? "–"}</strong> <span className={toneClass[i.tone]}>({i.label})</span></p>;
              })}
              <p>TBI L {abi.tbiLeft?.toFixed(2) ?? "–"} · R {abi.tbiRight?.toFixed(2) ?? "–"}</p>
            </div>
          )}
        </Section>
      </div>

      <Section title="Classification">
        <div className="grid gap-3 sm:grid-cols-4">
          <Select label="Wagner grade" value={plan.wagner} options={wagner} onChange={(wagner) => set({ wagner })} />
          <Select label="WIfI: Wound" value={plan.wifiW} options={wifiW} onChange={(wifiW) => set({ wifiW })} />
          <div>
            <Select label="WIfI: Ischemia" value={plan.wifiI} options={wifiI} onChange={(wifiI) => set({ wifiI })} />
            {suggestedI && plan.wifiI !== suggestedI && (
              <button className="mt-1 text-xs font-semibold text-brand" onClick={() => set({ wifiI: suggestedI })}>Use I{suggestedI} from ABI {worstAbi?.toFixed(2)}</button>
            )}
          </div>
          <Select label="WIfI: foot Infection" value={plan.wifiFi} options={wifiFi} onChange={(wifiFi) => set({ wifiFi })} />
        </div>
        {plan.wifiW && plan.wifiI && plan.wifiFi && (
          <p className="mt-3 text-sm">WIfI: <strong>W{plan.wifiW} I{plan.wifiI} fI{plan.wifiFi}</strong>. Stage per the SVS WIfI table, integrated into the EHR in production.</p>
        )}
      </Section>

      <Section title="Assessment & plan">
        <textarea className="input" rows={4} value={plan.assessment} onChange={(e) => set({ assessment: e.target.value })}
          placeholder="Assessment and plan…" />
        <div className="mt-4 grid gap-5 lg:grid-cols-3">
          {Object.entries(orderGroups).map(([group, items]) => (
            <div key={group}>
              <p className="label text-sm">{group}</p>
              <div className="flex flex-col gap-2">
                {items.map((o) => <Toggle key={o} label={o} checked={plan.orders.includes(o)} onChange={() => toggle("orders", o)} />)}
              </div>
            </div>
          ))}
          <div>
            <p className="label text-sm">Procedures performed today</p>
            <div className="flex flex-col gap-2">
              {procedures.map((p) => <Toggle key={p} label={p} checked={plan.procedures.includes(p)} onChange={() => toggle("procedures", p)} />)}
            </div>
          </div>
        </div>
        {plan.procedures.includes("Sharp debridement") && v.history?.anticoag && (
          <p className="mt-3 rounded-lg bg-warn-soft p-3 text-sm text-warn">Patient is anticoagulated. Have hemostasis supplies ready for debridement.</p>
        )}
        {plan.orders.includes("Angiography ± intervention") && v.patient.allergies.toLowerCase().includes("contrast") && (
          <p className="mt-3 rounded-lg bg-alert-soft p-3 text-sm text-alert">Contrast allergy on file. Premedication protocol needed before angiography.</p>
        )}
        {plan.orders.includes("Angiography ± intervention") && v.history?.ckd && (
          <p className="mt-3 rounded-lg bg-warn-soft p-3 text-sm text-warn">CKD: check eGFR and plan renal protection before contrast.</p>
        )}
      </Section>

      {v.stage === "provider" && (
        <div className="flex flex-wrap items-center justify-end gap-3">
          {saved && <span className="text-sm text-ok">✓ Saved</span>}
          <button className="btn-ghost text-alert" onClick={() => confirm("Admit this patient to the hospital?") &&
            moveStage(v.id, "done", "Admitted to hospital (limb-threatening condition)", by(me), { plan, disposition: "admitted" })}>
            Admit
          </button>
          <button className="btn-secondary" onClick={save}>Save</button>
          {needsLab && (
            <button className="btn-secondary" onClick={() => moveStage(v.id, "lab", "Sent to vascular lab for ABI/TBI", by(me), { plan })}>
              Send to vascular lab
            </button>
          )}
          <button className="btn-primary" disabled={!plan.assessment.trim() || needsLab}
            title={needsLab ? "ABI is ordered but not done yet" : !plan.assessment.trim() ? "Assessment required" : undefined}
            onClick={() => moveStage(v.id, "checkout", `Exam complete. Orders: ${plan.orders.join(", ") || "none"}${plan.procedures.length ? `; procedures: ${plan.procedures.join(", ")}` : ""}`, by(me), { plan })}>
            Sign &amp; send to checkout →
          </button>
        </div>
      )}
    </div>
  );
}
