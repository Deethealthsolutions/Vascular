"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Stepper } from "@/components/form";
import { SignaturePad } from "@/components/staff/SignaturePad";
import { Section, Select, Small, Toggle } from "@/components/staff/ui";
import {
  addVisit, age, by, nextMrn, nextVisitId, registry, useStaff, useVisits, visitTypeLabel,
  type Acuity, type Patient, type Visit, type VisitType,
} from "@/lib/clinic";
import { site } from "@/lib/site";

const steps = ["Find patient", "Safety screen", "Patient details", "Visit", "Insurance", "Consents", "Wristband"];

const redFlagQuestions = [
  { id: "Fever / chills with wound", text: "Fever, chills or feeling very unwell with the wound?" },
  { id: "Spreading redness", text: "Redness or red streaks spreading from the wound?" },
  { id: "Acute limb ischemia signs", text: "Leg or foot suddenly cold, pale, numb or severely painful?" },
  { id: "Chest pain / shortness of breath", text: "Chest pain or trouble breathing?", critical: true },
  { id: "Possible low blood sugar", text: "(Diabetic) shaky, sweaty or confused right now?", critical: true },
];

const consentDocs = [
  { id: "treat", label: "General consent to treatment", required: true },
  { id: "hipaa", label: "Notice of Privacy Practices acknowledged", required: true },
  { id: "financial", label: "Financial responsibility & assignment of benefits", required: true },
  { id: "photo", label: "Consent to clinical wound photography", required: false },
  { id: "hbot", label: "Hyperbaric oxygen therapy information & consent", required: false, hbotOnly: true },
];

const copayByPayer: Record<string, string> = { Medicare: "$0", Medicaid: "$0", Humana: "$25", Aetna: "$40" };

const blankPatient = (): Patient => ({
  mrn: "", first: "", last: "", dob: "", sex: "F", phone: "", language: "English",
  address: "", allergies: "", payer: "", memberId: "",
});

export function CheckInWizard() {
  const router = useRouter();
  const me = useStaff();
  const visits = useVisits();
  const [step, setStep] = useState(0);
  const [query, setQuery] = useState("");
  const [patient, setPatient] = useState<Patient>(blankPatient);
  const [isNew, setIsNew] = useState(false);
  const [flags, setFlags] = useState<Record<string, boolean | undefined>>({});
  const [idChecked, setIdChecked] = useState(false);
  const [visitType, setVisitType] = useState<VisitType>("wound");
  const [arrivalMode, setArrivalMode] = useState<Visit["arrivalMode"]>("walk-in");
  const [complaint, setComplaint] = useState("");
  const [mobility, setMobility] = useState<Visit["mobility"]>("ambulatory");
  const [elig, setElig] = useState<Visit["eligibility"] | "checking" | null>(null);
  const [copayCollected, setCopayCollected] = useState(false);
  const [cardScanned, setCardScanned] = useState(false);
  const [consents, setConsents] = useState<string[]>([]);
  const [signed, setSigned] = useState(false);
  const [created, setCreated] = useState<Visit | null>(null);

  const setP = <K extends keyof Patient>(k: K, v: Patient[K]) => setPatient((p) => ({ ...p, [k]: v }));
  const activeMrns = new Set((visits ?? []).filter((v) => v.stage !== "done").map((v) => v.patient.mrn));
  const q = query.trim().toLowerCase();
  const matches = q.length < 2 ? [] : registry.filter((p) =>
    `${p.first} ${p.last} ${p.last}, ${p.first} ${p.mrn} ${p.dob}`.toLowerCase().includes(q));

  const yesFlags = redFlagQuestions.filter((f) => flags[f.id]);
  const critical = yesFlags.some((f) => f.critical);
  // Desk only escalates; the triage nurse sets final acuity.
  const acuity: Acuity = yesFlags.length ? "emergent" : "routine";
  const docs = consentDocs.filter((d) => !d.hbotOnly || visitType === "hbot");
  const requiredSigned = docs.filter((d) => d.required).every((d) => consents.includes(d.id)) && signed;

  const canNext = [
    isNew || !!patient.mrn,
    redFlagQuestions.every((f) => flags[f.id] !== undefined),
    !!(patient.first && patient.last && patient.dob && patient.phone && patient.allergies && idChecked),
    complaint.trim().length > 2,
    !!(patient.payer && patient.memberId && elig && elig !== "checking" && cardScanned),
    requiredSigned,
  ][step];

  function pick(p: Patient) {
    setPatient(p);
    setIsNew(false);
    if (p.referralId) setArrivalMode("referral");
    setStep(1);
  }

  function runEligibility() {
    setElig("checking");
    setTimeout(() => {
      setElig({
        status: "verified",
        copay: patient.payer === "Self-pay" ? "Self-pay" : copayByPayer[patient.payer] ?? "$30",
        priorAuth: visitType === "hbot" ? `Required for HBOT (payer: ${patient.payer})` : undefined,
      });
    }, 900);
  }

  function finish() {
    const now = new Date().toISOString();
    const finalPatient = { ...patient, mrn: patient.mrn || nextMrn() };
    const v: Visit = {
      id: nextVisitId(visits ?? []),
      patient: finalPatient,
      visitType, arrivalMode, mobility,
      chiefComplaint: complaint.trim(),
      acuity,
      redFlags: yesFlags.map((f) => f.id),
      eligibility: elig && elig !== "checking" ? elig : { status: "pending" },
      consents,
      stage: "waiting",
      arrivedAt: now,
      stageSince: now,
      fallRisk: mobility !== "ambulatory",
      wounds: [],
      log: [
        { at: now, text: `${arrivalMode === "walk-in" ? "Walk-in" : arrivalMode === "referral" ? `Referral${patient.referralId ? ` ${patient.referralId}` : ""}` : "Scheduled"} checked in${isNew ? ", new MRN created" : ""}`, by: by(me) },
        ...(yesFlags.length ? [{ at: now, text: `Desk safety screen positive: ${yesFlags.map((f) => f.id).join(", ")}. Triage RN alerted.`, by: by(me) }] : []),
        ...(copayCollected ? [{ at: now, text: `Copay collected (${elig && elig !== "checking" ? elig.copay : ""})`, by: by(me) }] : []),
      ],
    };
    addVisit(v);
    setCreated(v);
    setStep(6);
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brand-dark">Front desk check-in</h1>
          <p className="text-muted">Walk-in, scheduled or referred patient arriving at the desk</p>
        </div>
        <Link href="/staff" className="btn-ghost">← Board</Link>
      </div>
      <div className="mt-5"><Stepper steps={steps} current={step} /></div>

      <div className="mt-5 space-y-4">
        {step === 0 && (
          <Section title="Who is checking in?">
            <label className="label" htmlFor="q">Search by name, date of birth or MRN</label>
            <input id="q" autoFocus className="input" placeholder="e.g. Ortiz, 1972-01-30, MRN-400734" value={query} onChange={(e) => setQuery(e.target.value)} />
            <p className="mt-2 text-sm text-muted">Try: Ortiz (has an online referral), Kim, Bennett, or add a new patient</p>
            {matches.length > 0 && (
              <ul className="mt-4 divide-y divide-line rounded-lg border border-line">
                {matches.map((p) => {
                  const here = activeMrns.has(p.mrn);
                  return (
                    <li key={p.mrn} className="flex flex-wrap items-center justify-between gap-3 p-3">
                      <div>
                        <p className="font-semibold">{p.last}, {p.first} <span className="font-normal text-muted">· {age(p.dob)}y {p.sex}</span></p>
                        <p className="text-sm text-muted">DOB {p.dob} · {p.mrn} · {p.payer}{p.referralId && <> · <span className="font-semibold text-brand">Referral {p.referralId} on file</span></>}</p>
                      </div>
                      {here ? <span className="chip bg-warn-soft text-warn">Already checked in</span>
                        : <button className="btn-primary px-4 py-2" onClick={() => pick(p)}>Select</button>}
                    </li>
                  );
                })}
              </ul>
            )}
            {q.length >= 2 && matches.length === 0 && <p className="mt-4 text-muted">No match found.</p>}
            <div className="mt-6 border-t border-line pt-4">
              <button className="btn-secondary" onClick={() => { setPatient(blankPatient()); setIsNew(true); setStep(1); }}>
                + New patient (not in system)
              </button>
            </div>
          </Section>
        )}

        {step === 1 && (
          <Section title="Rapid safety screen: ask before paperwork">
            <p className="text-sm text-muted">Any &quot;yes&quot; alerts the triage nurse right away and moves the patient to the top of the board.</p>
            <div className="mt-3 divide-y divide-line">
              {redFlagQuestions.map((f) => (
                <div key={f.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <span>{f.text}</span>
                  <div className="flex shrink-0 gap-2">
                    {[true, false].map((val) => (
                      <button key={String(val)} onClick={() => setFlags({ ...flags, [f.id]: val })}
                        className={`w-16 rounded-lg border-2 py-1.5 font-medium ${flags[f.id] === val ? (val ? "border-alert bg-alert text-white" : "border-brand bg-brand text-white") : "border-line bg-white"}`}>
                        {val ? "Yes" : "No"}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <button className="mt-2 text-sm font-semibold text-brand" onClick={() => setFlags(Object.fromEntries(redFlagQuestions.map((f) => [f.id, false])))}>
              Mark all &quot;No&quot;
            </button>
            {yesFlags.length > 0 && (
              <div role="alert" className="mt-4 rounded-xl border-2 border-alert bg-alert-soft p-4">
                <p className="text-lg font-bold text-alert">{critical ? "Call rapid response now" : "Escalate: emergent"}</p>
                <p className="mt-1">
                  {critical
                    ? "Chest pain, breathing trouble or suspected hypoglycemia: activate rapid response / call 911 and stay with the patient. Complete registration afterwards."
                    : "The triage nurse will be alerted as soon as check-in is saved. Keep registration brief. Details can be finished at the bedside."}
                </p>
                <p className="mt-2 text-sm text-muted">Positive: {yesFlags.map((f) => f.id).join(", ")}</p>
              </div>
            )}
          </Section>
        )}

        {step === 2 && (
          <Section title={isNew ? "Register new patient" : "Confirm patient details"}
            aside={!isNew ? <span className="chip bg-ok-soft text-ok">Existing record · {patient.mrn}</span> : <span className="chip bg-warn-soft text-warn">New MRN will be created</span>}>
            <div className="grid gap-4 sm:grid-cols-3">
              <Small label="First name *" value={patient.first} onChange={(v) => setP("first", v)} />
              <Small label="Last name *" value={patient.last} onChange={(v) => setP("last", v)} />
              <label className="block">
                <span className="label text-sm">Date of birth *</span>
                <input type="date" className="input py-2" value={patient.dob} onChange={(e) => setP("dob", e.target.value)} />
              </label>
              <Select label="Sex" value={patient.sex} options={[["F", "Female"], ["M", "Male"], ["X", "Other / not specified"]] as const} onChange={(v) => setP("sex", v)} />
              <Small label="Phone *" value={patient.phone} onChange={(v) => setP("phone", v)} />
              <Select label="Preferred language" value={patient.language} options={["English", "Español", "Other"] as const} onChange={(v) => setP("language", v)} />
              <Small label="Address" value={patient.address} onChange={(v) => setP("address", v)} wide />
              <Small label="Allergies * (type NKDA if none)" value={patient.allergies} onChange={(v) => setP("allergies", v)} />
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <Toggle label="Photo ID checked (2 identifiers confirmed)" checked={idChecked} onChange={setIdChecked} />
              {patient.language !== "English" && <span className="chip bg-warn-soft text-warn">Interpreter will be requested</span>}
            </div>
          </Section>
        )}

        {step === 3 && (
          <Section title="Reason for visit">
            <div className="grid gap-4 sm:grid-cols-3">
              <Select label="Visit type" value={visitType} options={Object.entries(visitTypeLabel) as [VisitType, string][]} onChange={setVisitType} />
              <Select label="Arrival" value={arrivalMode} options={[["walk-in", "Walk-in"], ["scheduled", "Scheduled"], ["referral", "Referred"]] as const} onChange={setArrivalMode} />
              <Select label="Mobility" value={mobility} options={["ambulatory", "cane/walker", "wheelchair", "stretcher"] as const} onChange={setMobility} />
            </div>
            {arrivalMode === "referral" && (
              <p className="mt-3 rounded-lg bg-brand-soft p-3 text-sm">
                {patient.referralId
                  ? <>Linked to referral <strong>{patient.referralId}</strong> from {patient.referredBy}. The referral status will update to &quot;Seen&quot;.</>
                  : "No online referral on file. Ask for the referral paperwork and scan it."}
              </p>
            )}
            {mobility !== "ambulatory" && <p className="mt-3 text-sm font-semibold text-warn">Fall-risk band will be applied.</p>}
            <label className="mt-4 block">
              <span className="label text-sm">Chief complaint (patient&apos;s words) *</span>
              <textarea className="input" rows={3} value={complaint} onChange={(e) => setComplaint(e.target.value)}
                placeholder="e.g. Sore on bottom of right foot for 3 weeks, now draining" />
            </label>
          </Section>
        )}

        {step === 4 && (
          <Section title="Insurance & eligibility">
            <div className="grid gap-4 sm:grid-cols-3">
              <Select label="Payer" value={patient.payer} options={["", ...site.insurance, "Self-pay"] as string[]} onChange={(v) => { setP("payer", v); setElig(null); }} />
              <Small label="Member ID" value={patient.memberId} onChange={(v) => { setP("memberId", v); setElig(null); }} />
              <div className="flex items-end">
                <button className="btn-secondary w-full py-2" disabled={!patient.payer || !patient.memberId || elig === "checking"} onClick={runEligibility}>
                  {elig === "checking" ? "Checking…" : "Run eligibility (270/271)"}
                </button>
              </div>
            </div>
            {elig && elig !== "checking" && (
              <div className="mt-4 rounded-lg border border-ok bg-ok-soft p-4">
                <p className="font-semibold text-ok">✓ Coverage active</p>
                <p className="mt-1 text-sm">Specialist copay: <strong>{elig.copay}</strong></p>
                {elig.priorAuth && <p className="mt-1 text-sm font-semibold text-warn">⚠ {elig.priorAuth}. A task will be created for the authorization team.</p>}
              </div>
            )}
            <div className="mt-4 flex flex-wrap gap-3">
              <Toggle label="Card scanned (front & back)" checked={cardScanned} onChange={setCardScanned} />
              {elig && elig !== "checking" && elig.copay !== "$0" && <Toggle label={`Copay collected (${elig.copay})`} checked={copayCollected} onChange={setCopayCollected} />}
            </div>
          </Section>
        )}

        {step === 5 && (
          <Section title="Consents & forms">
            <div className="grid gap-2 sm:grid-cols-2">
              {docs.map((d) => (
                <Toggle key={d.id} label={`${d.label}${d.required ? " *" : ""}`} checked={consents.includes(d.id)}
                  onChange={(v) => setConsents(v ? [...consents, d.id] : consents.filter((x) => x !== d.id))} />
              ))}
            </div>
            <div className="mt-5"><SignaturePad onChange={setSigned} /></div>
          </Section>
        )}

        {step === 6 && created && (
          <Section title="Checked in: print wristband">
            <div className="mx-auto max-w-xl rounded-full border-2 border-line bg-white px-8 py-4 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="grid grid-cols-6 gap-px" aria-hidden>
                  {Array.from({ length: 36 }).map((_, i) => <span key={i} className={`size-1.5 ${(i * 7 + created.patient.mrn.length) % 3 ? "bg-ink" : "bg-white"}`} />)}
                </div>
                <div className="flex-1 text-sm leading-tight">
                  <p className="font-bold">{created.patient.last.toUpperCase()}, {created.patient.first}</p>
                  <p>DOB {created.patient.dob} · {created.patient.sex} · {created.patient.mrn}</p>
                  <p className="text-muted">{visitTypeLabel[created.visitType]} · {created.id}</p>
                </div>
                <div className="flex flex-col gap-1">
                  {created.patient.allergies !== "NKDA" && <span className="rounded bg-alert px-2 text-xs font-bold text-white">ALLERGY</span>}
                  {created.fallRisk && <span className="rounded bg-[#f5c518] px-2 text-xs font-bold text-ink">FALL RISK</span>}
                </div>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button className="btn-primary" onClick={() => router.push(`/staff/visit/${created.id}?tab=triage`)}>Start triage now →</button>
              <button className="btn-secondary" onClick={() => router.push("/staff")}>Back to board</button>
              <button className="btn-ghost" onClick={() => location.reload()}>Check in another patient</button>
            </div>
            <p className="mt-4 text-center text-sm text-muted">
              {created.acuity === "emergent" ? "⚠ Emergent: triage RN alerted, patient pinned to top of board." : "Patient added to the waiting room on the clinic board."}
            </p>
          </Section>
        )}

        {step > 0 && step < 6 && (
          <div className="flex justify-between">
            <button className="btn-ghost" onClick={() => setStep(step - 1)}>← Back</button>
            {step === 5
              ? <button className="btn-primary" disabled={!canNext} onClick={finish}>Complete check-in</button>
              : <button className="btn-primary" disabled={!canNext} onClick={() => setStep(step + 1)}>Continue →</button>}
          </div>
        )}
      </div>
    </div>
  );
}
