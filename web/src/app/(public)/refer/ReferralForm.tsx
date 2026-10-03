"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, Field } from "@/components/form";
import { referralReasons, saveReferral, type Referral } from "@/lib/referrals";
import { site } from "@/lib/site";

type Urgency = "routine" | "urgent" | "emergent";

export function ReferralForm() {
  const [patientName, setPatientName] = useState("");
  const [patientDob, setPatientDob] = useState("");
  const [reasons, setReasons] = useState<string[]>([]);
  const [urgency, setUrgency] = useState<Urgency>("routine");
  const [woundLocation, setWoundLocation] = useState("");
  const [woundWeeks, setWoundWeeks] = useState("");
  const [wagner, setWagner] = useState("");
  const [abiLeft, setAbiLeft] = useState("");
  const [abiRight, setAbiRight] = useState("");
  const [infection, setInfection] = useState(false);
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState<Referral | null>(null);

  const abiFlags = [abiLeft, abiRight].map(Number).filter((v) => v > 0);
  const abiLow = abiFlags.some((v) => v < 0.9);
  const abiHigh = abiFlags.some((v) => v > 1.4);
  const valid = patientName && patientDob && reasons.length > 0 && urgency !== "emergent";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setSubmitted(
      saveReferral({
        patientName, patientDob, reasons, urgency,
        woundLocation: woundLocation || undefined,
        woundDurationWeeks: woundWeeks ? Number(woundWeeks) : undefined,
        wagnerGrade: wagner || undefined,
        abiLeft: abiLeft || undefined,
        abiRight: abiRight || undefined,
        infectionSigns: infection,
        notes: notes || undefined,
        attachments: files,
      }),
    );
  }

  if (submitted) {
    return (
      <div className="card border-2 border-ok">
        <p className="text-2xl font-bold text-ok">Referral {submitted.id} received</p>
        <p className="mt-2">
          {submitted.urgency === "urgent"
            ? "Urgent: a clinician will review it within 4 business hours."
            : "Routine: we'll review it and contact the patient to schedule within 2 business days."}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href={`/portal/${submitted.id}`} className="btn-primary">Track this referral</Link>
          <button className="btn-secondary" onClick={() => location.reload()}>Refer another patient</button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card space-y-8">
      <section className="grid gap-4 sm:grid-cols-2">
        <h2 className="text-lg font-semibold text-brand-dark sm:col-span-2">1. Patient</h2>
        <Field label="Patient name" value={patientName} onChange={setPatientName} required placeholder="Use test data only" />
        <Field label="Date of birth" type="date" value={patientDob} onChange={setPatientDob} required />
      </section>

      <fieldset>
        <legend className="text-lg font-semibold text-brand-dark">2. Reason for referral <span className="text-alert">*</span></legend>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {referralReasons.map((r) => (
            <Check key={r} label={r} checked={reasons.includes(r)}
              onChange={(v) => setReasons(v ? [...reasons, r] : reasons.filter((x) => x !== r))} />
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-lg font-semibold text-brand-dark">3. Urgency</legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {([
            ["routine", "Routine", "Seen within 14 days"],
            ["urgent", "Urgent", "Seen within 72 hours: rest pain, tissue loss, stalled DFU"],
            ["emergent", "Emergent", "Acute limb ischemia, sepsis, wet gangrene"],
          ] as const).map(([id, title, text]) => (
            <label key={id} className={`cursor-pointer rounded-lg border-2 p-3 ${urgency === id ? (id === "emergent" ? "border-alert bg-alert-soft" : "border-brand bg-brand-soft") : "border-line"}`}>
              <input type="radio" name="urgency" className="sr-only" checked={urgency === id} onChange={() => setUrgency(id)} />
              <span className="block font-semibold">{title}</span>
              <span className="text-sm text-muted">{text}</span>
            </label>
          ))}
        </div>
        {urgency === "emergent" && (
          <div role="alert" className="mt-4 rounded-lg border-l-4 border-alert bg-alert-soft p-4 text-alert">
            <strong>Don&apos;t submit an online referral for emergencies.</strong> Send the patient to the nearest emergency department,
            or call our on-call vascular surgeon at <a className="font-semibold underline" href={`tel:${site.phone}`}>{site.phone}</a> (option 1).
          </div>
        )}
      </fieldset>

      <section className="grid gap-4 sm:grid-cols-2">
        <h2 className="text-lg font-semibold text-brand-dark sm:col-span-2">4. Clinical details</h2>
        <Field label="Wound location" value={woundLocation} onChange={setWoundLocation} placeholder="e.g. R plantar 1st MTH" />
        <Field label="Wound duration (weeks)" type="number" value={woundWeeks} onChange={setWoundWeeks} />
        <div>
          <label className="label" htmlFor="wagner">Wagner grade (if DFU)</label>
          <select id="wagner" className="input" value={wagner} onChange={(e) => setWagner(e.target.value)}>
            <option value="">Not assessed</option>
            <option value="0">0: At-risk foot, no open lesion</option>
            <option value="1">1: Superficial ulcer</option>
            <option value="2">2: Deep to tendon, capsule or bone</option>
            <option value="3">3: Deep with abscess or osteomyelitis</option>
            <option value="4">4: Partial foot gangrene</option>
            <option value="5">5: Whole-foot gangrene</option>
          </select>
        </div>
        <div className="flex items-end pb-2.5">
          <Check label="Signs of infection (erythema, purulence, warmth)" checked={infection} onChange={setInfection} />
        </div>
        <Field label="ABI: left" value={abiLeft} onChange={setAbiLeft} placeholder="e.g. 0.85" />
        <Field label="ABI: right" value={abiRight} onChange={setAbiRight} placeholder="e.g. 0.62" />
        {(abiLow || abiHigh) && (
          <p className="rounded-lg bg-warn-soft p-3 text-sm text-warn sm:col-span-2">
            {abiLow && "ABI < 0.90 is consistent with PAD. A vascular evaluation will be included. "}
            {abiHigh && "ABI > 1.40 suggests non-compressible vessels. We'll get toe pressures (TBI)."}
          </p>
        )}
        <div className="sm:col-span-2">
          <label className="label" htmlFor="notes">Notes / relevant history</label>
          <textarea id="notes" rows={4} className="input" value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="Current treatment, antibiotics, recent imaging, A1c, anticoagulation…" />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-brand-dark">5. Attachments</h2>
        <label className="mt-3 flex cursor-pointer flex-col items-center rounded-lg border-2 border-dashed border-line p-6 text-center hover:border-brand">
          <span className="font-semibold text-brand">Add wound photos, notes, vascular studies</span>
          <span className="text-sm text-muted">PDF or images</span>
          <input type="file" multiple accept="image/*,application/pdf" className="sr-only"
            onChange={(e) => setFiles([...files, ...Array.from(e.target.files ?? []).map((f) => f.name)])} />
        </label>
        {files.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2">
            {files.map((f) => <li key={f} className="chip border border-line bg-surface">📎 {f}</li>)}
          </ul>
        )}
      </section>

      <div className="flex items-center justify-between gap-4 border-t border-line pt-6">
        <p className="text-sm text-muted">Referring as: Dr. Demo Referrer · NPI 0000000000</p>
        <button type="submit" className="btn-primary" disabled={!valid}>Submit referral</button>
      </div>
    </form>
  );
}
