"use client";

import { useState } from "react";
import { Section, Select, Small, Toggle } from "@/components/staff/ui";
import {
  by, moveStage, rooms, updateVisit, vitalAlerts,
  type Acuity, type History, type Pulse, type Pulses, type StaffUser, type Visit, type Vitals,
} from "@/lib/clinic";
import type { Tab } from "./VisitChart";

const emptyVitals: Vitals = { bp: "", hr: "", temp: "", rr: "", spo2: "", glucose: "", pain: "", weight: "" };
const emptyHistory: History = { diabetes: "none", a1c: "", smoking: "never", ckd: false, dialysis: false, anticoag: false, priorAmputation: false, meds: "" };
const emptyPulses: Pulses = { dpL: "", ptL: "", dpR: "", ptR: "" };
const pulseOptions = [["", "–"], ["2+", "2+ normal"], ["1+", "1+ diminished"], ["doppler", "Doppler only"], ["absent", "Absent"]] as const;

export function TriageTab({ v, me, go }: { v: Visit; me: StaffUser; go: (t: Tab) => void }) {
  const [room, setRoom] = useState(v.room ?? rooms.find((r) => r.startsWith("Exam")) ?? rooms[0]);
  const [vitals, setVitals] = useState<Vitals>(v.vitals ?? emptyVitals);
  const [history, setHistory] = useState<History>(v.history ?? emptyHistory);
  const [pulses, setPulses] = useState<Pulses>(v.pulses ?? emptyPulses);
  const [fallRisk, setFallRisk] = useState(v.fallRisk ?? false);
  const [acuity, setAcuity] = useState<Acuity>(v.acuity);
  const [saved, setSaved] = useState(false);

  const setV = (k: keyof Vitals) => (val: string) => { setVitals({ ...vitals, [k]: val }); setSaved(false); };
  const alerts = vitalAlerts(vitals);
  const diabetic = history.diabetes !== "none";
  const vitalsDone = !!(vitals.bp && vitals.hr && vitals.temp && vitals.spo2 && (!diabetic || vitals.glucose));
  const pulsesDone = Object.values(pulses).every(Boolean);

  const data = () => ({ vitals, history, pulses, fallRisk, acuity, room });

  function save() {
    updateVisit(v.id, (x) => ({ ...x, ...data() }));
    setSaved(true);
  }

  if (v.stage === "waiting") {
    return (
      <Section title="Room the patient">
        {v.acuity === "emergent" && (
          <p className="mb-4 rounded-lg bg-alert-soft p-3 font-semibold text-alert">⚠ Desk screen positive: {v.redFlags.join(", ")}. Assess immediately.</p>
        )}
        <p className="text-muted">Call the patient from the waiting room, confirm name + date of birth against the wristband, and assign a room.</p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="w-56"><Select label="Room" value={room} options={rooms} onChange={setRoom} /></div>
          <button className="btn-primary" onClick={() => moveStage(v.id, "triage", `Triage started, roomed ${room}`, by(me), { room })}>
            Room patient &amp; start triage
          </button>
        </div>
      </Section>
    );
  }

  return (
    <div className="space-y-5">
      {v.acuity === "emergent" && v.stage !== "done" && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border-2 border-alert bg-alert-soft p-4">
          <p className="font-semibold text-alert">⚠ Emergent: {v.redFlags.join(", ")}</p>
          <button className="btn ml-auto bg-alert px-4 py-2 text-white"
            onClick={() => confirm("Transfer this patient to the Emergency Department?") &&
              moveStage(v.id, "done", "Transferred to Emergency Department", by(me), { ...data(), disposition: "transferred-ed" })}>
            Transfer to ED
          </button>
        </div>
      )}

      <Section title="Vital signs" aside={alerts.length > 0 && <span className="chip bg-alert text-white">⚠ {alerts.join(" · ")}</span>}>
        <div className="grid gap-3 sm:grid-cols-4">
          <Small label="Blood pressure" value={vitals.bp} onChange={setV("bp")} placeholder="120/80" suffix="mmHg" />
          <Small label="Heart rate" value={vitals.hr} onChange={setV("hr")} suffix="bpm" />
          <Small label="Temperature" value={vitals.temp} onChange={setV("temp")} suffix="°C" />
          <Small label="Resp. rate" value={vitals.rr} onChange={setV("rr")} suffix="/min" />
          <Small label="SpO₂" value={vitals.spo2} onChange={setV("spo2")} suffix="%" />
          <Small label={`Glucose${diabetic ? " *" : ""}`} value={vitals.glucose} onChange={setV("glucose")} suffix="mg/dL" />
          <Small label="Pain" value={vitals.pain} onChange={setV("pain")} suffix="/10" />
          <Small label="Weight" value={vitals.weight} onChange={setV("weight")} suffix="kg" />
        </div>
        {diabetic && <p className="mt-2 text-sm text-muted">Point-of-care glucose required for diabetic patients{v.visitType === "hbot" ? " and before every HBOT session" : ""}.</p>}
      </Section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="History & medications">
          <div className="grid gap-3 sm:grid-cols-3">
            <Select label="Diabetes" value={history.diabetes} options={[["none", "None"], ["type1", "Type 1"], ["type2", "Type 2"]] as const}
              onChange={(d) => setHistory({ ...history, diabetes: d })} />
            <Small label="Last A1c" value={history.a1c} onChange={(a1c) => setHistory({ ...history, a1c })} suffix="%" />
            <Select label="Tobacco" value={history.smoking} options={["never", "former", "current"] as const}
              onChange={(smoking) => setHistory({ ...history, smoking })} />
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Toggle label="Chronic kidney disease" checked={history.ckd} onChange={(ckd) => setHistory({ ...history, ckd })} />
            <Toggle label="Dialysis" checked={history.dialysis} onChange={(dialysis) => setHistory({ ...history, dialysis })} />
            <Toggle label="Anticoagulant / antiplatelet" checked={history.anticoag} onChange={(anticoag) => setHistory({ ...history, anticoag })} />
            <Toggle label="Prior amputation" checked={history.priorAmputation} onChange={(priorAmputation) => setHistory({ ...history, priorAmputation })} />
          </div>
          <label className="mt-3 block">
            <span className="label text-sm">Medication reconciliation</span>
            <textarea className="input" rows={3} value={history.meds} onChange={(e) => setHistory({ ...history, meds: e.target.value })} placeholder="Current medications, doses" />
          </label>
        </Section>

        <Section title="Pedal pulses & safety">
          <div className="grid grid-cols-2 gap-3">
            {([["dpL", "Left DP"], ["ptL", "Left PT"], ["dpR", "Right DP"], ["ptR", "Right PT"]] as const).map(([k, label]) => (
              <Select key={k} label={label} value={pulses[k]} options={pulseOptions} onChange={(val: Pulse) => setPulses({ ...pulses, [k]: val })} />
            ))}
          </div>
          {Object.values(pulses).some((p) => p === "doppler" || p === "absent") && (
            <p className="mt-3 rounded-lg bg-warn-soft p-3 text-sm text-warn">Diminished / absent pulses: consider ABI/TBI in the vascular lab.</p>
          )}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Toggle label="Fall risk" checked={fallRisk} onChange={setFallRisk} />
            <Select label="Acuity (nurse-assigned)" value={acuity} options={["routine", "urgent", "emergent"] as const} onChange={setAcuity} />
          </div>
        </Section>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3">
        {saved && <span className="text-sm text-ok">✓ Saved</span>}
        <button className="btn-secondary" onClick={save}>Save</button>
        <button className="btn-secondary" onClick={() => { save(); go("wounds"); }}>Save &amp; document wounds →</button>
        {v.stage === "triage" && (
          <button className="btn-primary" disabled={!vitalsDone || !pulsesDone}
            title={!vitalsDone || !pulsesDone ? "Vitals and all four pulses are required" : undefined}
            onClick={() => moveStage(v.id, "ready", `Triage complete${alerts.length ? ` (alerts: ${alerts.join(", ")})` : ""}, ready for provider`, by(me), data())}>
            Complete triage → Ready for provider
          </button>
        )}
      </div>
    </div>
  );
}
