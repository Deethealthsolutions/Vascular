"use client";

// Step 1 of the patient journey: a patient walks in to the wound & vascular hospital
// and the front desk registers them. Registration finds or creates the enterprise
// identity (patient master), opens today's encounter, screens for limb- and
// life-threatening red flags, and routes the patient to the right queue with a token.

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { currentLocation, hereRegs, locById } from "@/lib/cx/locations";
import { SignaturePad } from "@/components/staff/SignaturePad";
import { Guard, Top, useMe } from "@/components/cx/Shell";
import { Card, Kpis, Pill, toast } from "@/components/cx/ui";
import { PROF, SITENAME, type Profile } from "@/lib/cx/data";
import { audit, setState, uid, useStore, type Registration } from "@/lib/cx/store";

// ------------------------------------------------------------------ options

const VISITS = [
  { id: "wound", q: "W", label: "Wound clinic", hint: "Non-healing wound, pressure sore, surgical wound", chips: ["Wound not healing", "Pressure sore", "Wound after surgery", "Burn / injury wound"] },
  { id: "dfoot", q: "D", label: "Diabetic foot clinic", hint: "Foot ulcer, blister, corn, foot check", chips: ["Foot ulcer", "Blister / corn on foot", "Toe discoloured", "Yearly foot check"] },
  { id: "vascular", q: "V", label: "Vascular OPD", hint: "Leg pain on walking, cold feet, varicose veins, swelling", chips: ["Leg pain while walking", "Cold / pale feet", "Varicose veins", "Leg swelling", "Pain at rest / at night"] },
  { id: "hbot", q: "H", label: "HBOT assessment", hint: "Referred for hyperbaric oxygen therapy", chips: ["Referred for HBOT", "Radiation wound", "Bone infection (osteomyelitis)"] },
  { id: "review", q: "R", label: "Follow-up / dressing", hint: "Review or dressing change for a known patient", chips: ["Dressing change", "Post-procedure review", "Stump review", "HBOT session"] },
  { id: "procedure", q: "P", label: "Scheduled procedure", hint: "Angiogram, angioplasty, debridement, day-case", chips: ["Angiogram", "Angioplasty", "Debridement", "Vein ablation"] },
] as const;

const RED_FLAGS = [
  { id: "sepsis", text: "Fever, shivering or feeling very unwell with a foot or leg wound", tag: "Possible sepsis" },
  { id: "spreading", text: "Redness, swelling or black skin spreading quickly, or foul smell from the wound", tag: "Spreading infection / wet gangrene" },
  { id: "ali", text: "Leg or foot suddenly cold, pale, numb or very painful (within hours or days)", tag: "Possible acute limb ischaemia" },
  { id: "chest", text: "Chest pain, breathlessness or collapse", tag: "Cardio-respiratory emergency" },
  { id: "sugar", text: "Drowsy, confused, sweating or shaking (very high or low sugar)", tag: "Glycaemic emergency" },
  { id: "bleed", text: "Bleeding that will not stop from a wound or recent procedure site", tag: "Active bleeding" },
] as const;

const ARRIVALS = ["Walk-in", "Referred by doctor / clinic", "Transferred from another centre", "Ambulance", "Scheduled appointment"];
const LANGS = ["Tamil", "English", "Telugu", "Kannada", "Hindi", "Malayalam", "Other"];
const SCHEMES = ["Self-pay", "Ayushman Bharat PM-JAY", "CMCHIS / state scheme", "ESI", "CGHS", "Private insurance", "Corporate panel"];
const SCHEME_ID: Record<string, string> = {
  "Ayushman Bharat PM-JAY": "PM-JAY ID / e-card no.", "CMCHIS / state scheme": "Scheme card no.", ESI: "ESI IP number",
  CGHS: "CGHS beneficiary ID", "Private insurance": "Insurer & policy no.", "Corporate panel": "Company & employee ID",
};
const WOUND_SITES = ["No wound", "Right foot", "Left foot", "Right toe(s)", "Left toe(s)", "Right heel", "Left heel", "Right leg", "Left leg", "Both feet / legs", "Other"];
const MOBILITY = ["Walking unaided", "Walking with stick / walker", "Wheelchair", "Stretcher / trolley"];
const RELATIONS = ["Spouse", "Son", "Daughter", "Parent", "Sibling", "Relative", "Friend / neighbour"];
const PHOTO_SCOPES = [["care-only", "Care only"], ["care+research", "Care + research"], ["care+research+publication", "Care + research + publication"]] as const;
const DEMO_OTP = "4829";

// ------------------------------------------------------------------ form

type Form = {
  pid?: string; returning: boolean; mrn?: string; epi?: string;
  name: string; dob: string; age: string; ageApprox: boolean; sex: string;
  phone: string; otpSent: boolean; otp: string; phoneVerified: boolean; noPhoneReason: string;
  language: string; area: string; city: string; state: string; pin: string;
  kinName: string; kinRel: string; kinPhone: string; abha: string; idSeen: string;
  arrival: string; referredBy: string; visit: string; complaint: string;
  flags: Record<string, boolean | undefined>;
  diabetes: string; dmYears: string; insulin: boolean; ckd: boolean; dialysis: boolean; prevAmp: boolean; prevRevasc: boolean;
  anticoag: boolean; smoking: string; nkda: boolean; allergies: string; woundSite: string; woundWeeks: string; mobility: string;
  scheme: string; schemeId: string;
  cCare: boolean; cShare: boolean; cResearch: boolean; cPhoto: string; signed: boolean;
};

const blank = (): Form => ({
  returning: false, name: "", dob: "", age: "", ageApprox: false, sex: "",
  phone: "", otpSent: false, otp: "", phoneVerified: false, noPhoneReason: "",
  language: "Tamil", area: "", city: "Chennai", state: "Tamil Nadu", pin: "",
  kinName: "", kinRel: "", kinPhone: "", abha: "", idSeen: "",
  arrival: "Walk-in", referredBy: "", visit: "", complaint: "", flags: {},
  diabetes: "", dmYears: "", insulin: false, ckd: false, dialysis: false, prevAmp: false, prevRevasc: false,
  anticoag: false, smoking: "Never", nkda: false, allergies: "", woundSite: "", woundWeeks: "", mobility: "Walking unaided",
  scheme: "", schemeId: "", cCare: false, cShare: true, cResearch: false, cPhoto: "care-only", signed: false,
});

/** Demo number issuing. Production: MRN and enterprise ID come from the patient-master service. */
const randDigits = (n: number) => String(Math.floor(10 ** (n - 1) + Math.random() * 9 * 10 ** (n - 1)));
const minsSince = (at: string) => Math.max(0, Math.round((Date.now() - Date.parse(at)) / 60000));
const digits = (s: string) => s.replace(/\D/g, "").slice(-10);
const ageFromDob = (dob: string) => {
  if (!dob) return "";
  const d = new Date(dob), n = new Date();
  let a = n.getFullYear() - d.getFullYear();
  if (n < new Date(n.getFullYear(), d.getMonth(), d.getDate())) a--;
  return a >= 0 && a < 120 ? String(a) : "";
};

/** Minimal searchable view over the patient master and today's new registrations. */
type Person = { key: string; pid?: string; name: string; age: number; sex: string; phone: string | null; mrn: string; epi: string; centre: string; source: "master" | "today"; profile?: Profile; reg?: Registration };

export function Register() {
  return (
    <Guard screen="register">
      <Top title="Registration" sub="Front desk · a patient walks in · find or create the record, screen for red flags, route to a queue" />
      <div className="wrap"><Body /></div>
    </Guard>
  );
}

function Body() {
  const me = useMe();
  const st = useStore();
  const here = currentLocation(st, me);
  const centre = here.centre;
  const atHere = hereRegs(st, me);
  const [f, setF] = useState<Form>(blank);
  const [q, setQ] = useState("");
  const [done, setDone] = useState<Registration | null>(null);
  const [padKey, setPadKey] = useState(0);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));

  const people: Person[] = useMemo(() => [
    ...st.registrations.map((r) => ({ key: r.id, pid: r.pid, name: r.name, age: r.age, sex: r.sex, phone: r.phone, mrn: r.mrn, epi: r.epi, centre: r.centre, source: "today" as const, reg: r })),
    ...PROF.profiles.map((p) => ({ key: p.pid, pid: p.pid, name: p.name, age: p.age, sex: p.sex, phone: p.phone, mrn: p.mrn, epi: p.epi, centre: p.regCentre, source: "master" as const, profile: p })),
  ], [st.registrations]);

  // ---- search
  const ql = q.trim().toLowerCase();
  const hits = ql.length < 3 ? [] : people.filter((p) =>
    p.name.toLowerCase().includes(ql) || p.mrn.toLowerCase().includes(ql) || p.epi.toLowerCase().includes(ql) ||
    (digits(ql).length >= 4 && p.phone != null && digits(p.phone).includes(digits(ql)))).slice(0, 8);

  // ---- duplicate check while registering someone new (REQ-PROF-003 at the source)
  const dupes = f.returning ? [] : people.filter((p) => {
    const ph = digits(f.phone);
    const samePhone = ph.length === 10 && p.phone != null && digits(p.phone) === ph;
    const nameParts = f.name.trim().toLowerCase().split(/\s+/).filter((x) => x.length > 1);
    const sameName = nameParts.length >= 2 && nameParts.every((w) => p.name.toLowerCase().includes(w));
    const closeAge = f.age !== "" && Math.abs(Number(f.age) - p.age) <= 2;
    return samePhone || (sameName && closeAge);
  }).slice(0, 3);

  // ---- routing
  const redFlags = RED_FLAGS.filter((r) => f.flags[r.id]);
  const screened = RED_FLAGS.every((r) => f.flags[r.id] !== undefined);
  const emergency = redFlags.length > 0;
  const visit = VISITS.find((v) => v.id === f.visit);
  const priorityReasons = [
    Number(f.age) >= 75 && "age 75+",
    (f.mobility === "Wheelchair" || f.mobility === "Stretcher / trolley") && f.mobility.toLowerCase(),
    f.dialysis && "on dialysis",
    f.visit === "vascular" && /rest|night/i.test(f.complaint) && "rest pain",
    f.visit === "dfoot" && /discoloured/i.test(f.complaint) && "toe discolouration",
  ].filter(Boolean) as string[];
  const priority: Registration["priority"] = emergency ? "emergency" : priorityReasons.length ? "priority" : "routine";
  const queueCode = emergency ? "E" : visit?.q ?? "—";
  const queueLabel = emergency ? "Emergency" : visit?.label ?? "Not chosen";
  const nextNo = atHere.filter((r) => r.queue === queueCode).length + 1;
  const token = queueCode === "—" ? "—" : `${queueCode}-${String(nextNo).padStart(3, "0")}`;
  const fallRisk = f.mobility !== "Walking unaided" || Number(f.age) >= 80;

  // ---- completeness
  const quick = emergency; // emergency quick registration: identify now, complete later
  const checks: [string, boolean, boolean][] = [
    // [label, done, required in current mode]
    ["Red-flag screen answered", screened, true],
    ["Name", f.name.trim().length > 1, true],
    ["Age or date of birth", f.age !== "", true],
    ["Sex", f.sex !== "", true],
    ["Mobile verified (or reason recorded)", f.phoneVerified || f.noPhoneReason.trim().length > 2, !quick],
    ["Address (city and PIN)", f.city.trim() !== "" && /^\d{6}$/.test(f.pin), !quick],
    ["Next of kin", f.kinName.trim() !== "" && digits(f.kinPhone).length === 10, !quick],
    ["ID checked", f.idSeen !== "", !quick],
    ["Reason for visit", f.visit !== "" && f.complaint.trim() !== "", !quick],
    ["Allergies recorded (or none known)", f.nkda || f.allergies.trim() !== "", !quick],
    ["Payment / scheme", f.scheme !== "" && (!SCHEME_ID[f.scheme] || f.schemeId.trim() !== ""), !quick],
    ["Consent to treatment signed", f.cCare && f.signed, !quick],
  ];
  const missing = checks.filter(([, ok, req]) => req && !ok);
  const deferred = checks.filter(([, ok, req]) => !req && !ok).map(([l]) => l);
  const canRegister = missing.length === 0;

  // ---- actions
  function pick(p: Person) {
    const pr = p.profile, r = p.reg;
    setF({
      ...blank(), returning: true, pid: p.pid, mrn: p.mrn, epi: p.epi,
      name: p.name, age: String(p.age), dob: pr?.dob ?? r?.dob ?? "", sex: p.sex === "M" ? "Male" : p.sex === "F" ? "Female" : p.sex,
      phone: p.phone ?? "", language: pr?.lang ?? r?.language ?? "Tamil",
      area: pr?.area ?? r?.area ?? "", city: pr?.city ?? r?.city ?? "", state: pr?.state ?? r?.state ?? "", pin: pr?.pin ?? r?.pin ?? "",
      kinName: pr?.kin?.name ?? r?.kin?.name ?? "", kinRel: pr?.kin?.rel ?? r?.kin?.rel ?? "", kinPhone: pr?.kin?.phone ?? r?.kin?.phone ?? "",
      diabetes: pr ? (pr.dmType ? "Yes" : "No") : r?.clinical.diabetes ?? "", dmYears: pr ? String(pr.dmYears) : r?.clinical.dmYears ?? "",
      insulin: pr ? /insulin/i.test(pr.therapy) : r?.clinical.insulin ?? false, dialysis: pr?.dialysis ?? r?.clinical.dialysis ?? false,
      ckd: pr ? pr.comorbid.some((c) => /CKD|nephropathy/i.test(c)) : r?.clinical.ckd ?? false,
      prevAmp: pr?.prevAmp ?? r?.clinical.prevAmp ?? false, prevRevasc: pr?.prevRevasc ?? r?.clinical.prevRevasc ?? false,
      smoking: pr?.smoking ?? r?.clinical.smoking ?? "Never",
      nkda: pr ? pr.allergies.length === 0 : r ? r.clinical.allergies === "NKDA" : false,
      allergies: pr ? pr.allergies.join("; ") : r && r.clinical.allergies !== "NKDA" ? r.clinical.allergies : "",
      scheme: pr?.scheme ?? r?.scheme ?? "", schemeId: r?.schemeId ?? "",
      cShare: pr?.consent.careShare ?? true, cResearch: pr?.consent.research ?? false, cPhoto: pr?.consent.photography ?? r?.consent.photo ?? "care-only",
    });
    setQ("");
    setPadKey((k) => k + 1);
    audit(me.name, "read", `${p.pid ?? p.epi} ${p.name}`, "Opened record at registration desk");
  }

  function reset() {
    setF(blank());
    setQ("");
    setDone(null);
    setPadKey((k) => k + 1);
  }

  function register() {
    const at = new Date().toISOString();
    const mrn = f.mrn && f.mrn.startsWith(centre) ? f.mrn : `${centre}-${randDigits(6)}`;
    const epi = f.epi ?? `EPI-07${randDigits(5)}`;
    const reg: Registration = {
      id: uid("REG"), epi, mrn, token, queue: queueCode, queueLabel, priority, at, by: me.name, centre, location: here.id,
      returning: f.returning, pid: f.pid, emergencyQuick: quick,
      name: f.name.trim(), age: Number(f.age), ageApprox: f.ageApprox || !f.dob, dob: f.dob || undefined, sex: f.sex,
      phone: f.phone, phoneVerified: f.phoneVerified, language: f.language, area: f.area, city: f.city, state: f.state, pin: f.pin,
      kin: f.kinName ? { name: f.kinName, rel: f.kinRel, phone: f.kinPhone } : undefined, abha: f.abha || undefined, idSeen: f.idSeen || "not checked (emergency)",
      arrival: f.arrival, referredBy: f.referredBy || undefined, visit: f.visit, complaint: f.complaint, redFlags: redFlags.map((r) => r.tag),
      clinical: { diabetes: f.diabetes || "Unknown", dmYears: f.dmYears, insulin: f.insulin, ckd: f.ckd, dialysis: f.dialysis, prevAmp: f.prevAmp,
        prevRevasc: f.prevRevasc, anticoag: f.anticoag, smoking: f.smoking, allergies: f.nkda ? "NKDA" : f.allergies || "not recorded", woundSite: f.woundSite, woundWeeks: f.woundWeeks, mobility: f.mobility },
      scheme: f.scheme || "to be confirmed", schemeId: f.schemeId,
      consent: { care: f.cCare, share: f.cShare, research: f.cResearch, photo: f.cPhoto },
      status: emergency ? "sent to emergency" : "waiting for assessment",
    };
    setState((s) => ({ registrations: [reg, ...s.registrations] }));
    audit(me.name, "write", `${epi} ${reg.name}`, `${f.returning ? "Returning patient" : "New patient"} registered · ${queueLabel} · token ${token}${emergency ? ` · RED FLAG: ${reg.redFlags.join(", ")}` : ""}`);
    toast(emergency ? `Emergency team alerted for ${reg.name}. Take the patient to Emergency now — token ${token}.` : `${reg.name} registered · token ${token} · ${queueLabel}.`);
    setDone(reg);
  }

  if (done) return <Done r={done} onNext={reset} />;

  // ---- compact panel building blocks (dark header bar, label-left / control-right rows)
  const panel = (n: number, title: string, status: { ok: boolean; text: string } | null, body: ReactNode, o: { attn?: boolean; sub?: ReactNode; right?: ReactNode } = {}) => (
    <section className={`opanel mb14${o.attn ? " attn" : ""}`} aria-label={title}>
      <div className="opanel-h"><span className="ic" aria-hidden>≡</span><span className="pn">{n}</span><span className="tt">{title}</span>
        {o.right}{status && <span className={`st${status.ok ? " ok" : ""}`}>{status.ok ? "✓ " : ""}{status.text}</span>}</div>
      {o.sub && <div className="opanel-sub">{o.sub}</div>}
      <div className="opanel-b">{body}</div>
    </section>
  );
  const row = (label: string, sub: string, control: ReactNode, o: { req?: boolean; xw?: boolean } = {}) => (
    <div className={`ob ${o.xw ? "xw" : "wide"}`}>
      <label>{label}{o.req && <b className="rq"> *</b>}<span>{sub}</span></label>
      {control}
    </div>
  );
  const yn = (label: string, v: boolean, on: (b: boolean) => void, tone = "p1") => (
    <select className={v ? tone : ""} value={v ? "Yes" : "No"} onChange={(e) => on(e.target.value === "Yes")} aria-label={label}><option>No</option><option>Yes</option></select>
  );
  const status = (labels: string[]) => {
    const req = checks.filter(([l, , r]) => r && labels.includes(l));
    const left = req.filter(([, ok]) => !ok).length;
    return req.length === 0 ? null : { ok: left === 0, text: left === 0 ? "complete" : `${left} to do` };
  };
  const yes = (k: string) => f.flags[k] === true;

  return (
    <>
      <Kpis cols={4} items={[
        { k: "Registered today", v: atHere.length, d: `${here.name}, ${here.city} · this session` },
        { k: "Waiting for assessment", v: atHere.filter((r) => r.status === "waiting for assessment").length, d: "handed to nursing" },
        { k: "Sent to emergency", v: atHere.filter((r) => r.status === "sent to emergency").length, d: "red flag at the desk", tone: atHere.some((r) => r.priority === "emergency") ? "bad" : "" },
        { k: "Returning / new", v: `${atHere.filter((r) => r.returning).length} / ${atHere.filter((r) => !r.returning).length}`, d: "found in patient master vs created" },
      ]} />

      <div className="reg-grid">
        <div>
          {/* 1. Find */}
          {panel(1, "Find the patient first", f.returning ? { ok: true, text: "returning patient" } : null, (
            <>
              <input className="gsearch" style={{ width: "100%", padding: "10px 12px", fontSize: 14 }} autoFocus aria-label="Search the patient master"
                placeholder="Mobile number, name, MRN or enterprise ID (e.g. 99627, Fatima, CHN-644460)" value={q} onChange={(e) => setQ(e.target.value)} />
              {hits.length > 0 && (
                <div className="reg-hits">
                  {hits.map((p) => (
                    <div key={p.key} className="reg-hit">
                      <div><b>{p.name}</b> <span className="mut xs">{p.age}{p.sex === "Male" ? "M" : p.sex === "Female" ? "F" : p.sex}</span>{p.source === "today" && <> <Pill c="a">registered today</Pill></>}
                        <div className="xs mut">{p.phone ?? "no phone on file"} · <span className="num">{p.mrn}</span> · home centre {SITENAME[p.centre] ?? p.centre}</div></div>
                      <button className="btn sm p" onClick={() => pick(p)}>This is the patient</button>
                    </div>
                  ))}
                </div>
              )}
              {ql.length >= 3 && hits.length === 0 && <div className="sm mut" style={{ marginTop: 10 }}>No match in the patient master. Register as a new patient below.</div>}
              {f.returning && (
                <div className="reg-ok">
                  <span><b>Returning · {f.mrn}</b> — details pre-filled. Confirm two identifiers with the patient and update anything that has changed.
                    {f.pid && PROF.profiles.find((p) => p.pid === f.pid)?.missing.length ? <> Missing on file: <b>{PROF.profiles.find((p) => p.pid === f.pid)!.missing.join(", ")}</b>.</> : null}</span>
                  <button className="btn sm" onClick={reset}>Not this patient</button>
                </div>
              )}
            </>
          ), { sub: "Search before creating — most wound patients come back many times." })}

          <div className="reg-cols">
            <div>
              {/* 2. Red flags */}
              {panel(2, "Red-flag screen", screened ? (emergency ? { ok: false, text: `${redFlags.length} positive` } : { ok: true, text: "all clear" }) : { ok: false, text: `${RED_FLAGS.filter((r) => f.flags[r.id] === undefined).length} to ask` }, (
                <>
                  {RED_FLAGS.map((r) => (
                    <div key={r.id} className={`rf-row${yes(r.id) ? " on" : ""}`}>
                      <span>{r.text}</span>
                      <span className="yn">
                        <button className={`y${f.flags[r.id] === true ? " on" : ""}`} onClick={() => set("flags", { ...f.flags, [r.id]: true })}>Yes</button>
                        <button className={`n${f.flags[r.id] === false ? " on" : ""}`} onClick={() => set("flags", { ...f.flags, [r.id]: false })}>No</button>
                      </span>
                    </div>
                  ))}
                  {emergency && <div className="deny" style={{ marginTop: 10 }}><b>Emergency — move the patient now.</b> Only name, approximate age and sex are needed; finish the rest at the bedside.</div>}
                </>
              ), { attn: emergency, sub: "Ask before any paperwork.", right: !screened ? <button className="btn sm ghost" onClick={() => set("flags", Object.fromEntries(RED_FLAGS.map((r) => [r.id, false])))}>None of these</button> : undefined })}

              {/* 3. Identity */}
              {panel(3, "Who is the patient", status(["Name", "Age or date of birth", "Sex", "ID checked"]), (
                <>
                  {row("Full name", "as on the ID", <input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Murugan Selvam" aria-label="Full name" />, { req: true, xw: true })}
                  {row("Date of birth", "if known", <input type="date" value={f.dob} max={new Date().toISOString().slice(0, 10)} aria-label="Date of birth" onChange={(e) => { const a = ageFromDob(e.target.value); setF((x) => ({ ...x, dob: e.target.value, age: a || x.age, ageApprox: !a })); }} />, { xw: true })}
                  {row("Age", f.dob ? "years · from date of birth" : f.age ? "years · approximate" : "years", <input inputMode="numeric" className={Number(f.age) >= 75 ? "p1" : ""} value={f.age} aria-label="Age" onChange={(e) => setF((x) => ({ ...x, age: e.target.value.replace(/\D/g, "").slice(0, 3), ageApprox: !x.dob }))} placeholder="—" />, { req: true })}
                  {row("Sex", "", <select value={f.sex} onChange={(e) => set("sex", e.target.value)} aria-label="Sex"><option value="">Select…</option>{["Male", "Female", "Other"].map((s) => <option key={s}>{s}</option>)}</select>, { req: true })}
                  {row("Language", "for explanations and SMS", <select value={f.language} onChange={(e) => set("language", e.target.value)} aria-label="Language">{LANGS.map((l) => <option key={l}>{l}</option>)}</select>)}
                  {row("ABHA number", "optional · 14 digits", <input value={f.abha} onChange={(e) => set("abha", e.target.value.replace(/[^\d-]/g, "").slice(0, 17))} placeholder="—" aria-label="ABHA number" />, { xw: true })}
                  {!quick && row("Identity checked", "document seen · never store Aadhaar no.", (
                    <select value={f.idSeen} onChange={(e) => set("idSeen", e.target.value)} aria-label="Identity checked"><option value="">Select…</option>{["Aadhaar card (seen, not copied)", "Voter ID", "PAN card", "Driving licence", "Ration card", "Scheme card", "No ID — identified by relative"].map((x) => <option key={x}>{x}</option>)}</select>
                  ), { req: true, xw: true })}
                  {dupes.length > 0 && (
                    <div className="disc" style={{ marginTop: 6, marginBottom: 0 }}>
                      <b>Possible existing record.</b> Check before creating a new one.
                      {dupes.map((p) => (
                        <div key={p.key} className="reg-hit" style={{ background: "transparent", padding: "6px 0" }}>
                          <div className="sm"><b>{p.name}</b> <span className="xs mut">{p.age} · {p.phone ?? "no phone"} · {p.mrn}</span></div>
                          <button className="btn sm" onClick={() => pick(p)}>Use this record</button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ), { sub: <><b>{f.name.trim() || (f.returning ? "Returning patient" : "New patient")}</b> <span className="mut">{[f.mrn, f.age && `${f.age}${f.sex ? f.sex[0] : ""}`, f.language].filter(Boolean).join(" · ") || "details below"}</span></> })}

              {/* 4. Contact */}
              {!quick && panel(4, "Contact and next of kin", status(["Mobile verified (or reason recorded)", "Address (city and PIN)", "Next of kin"]), (
                <>
                  {row("Mobile", f.phoneVerified ? "verified by OTP" : "10 digits", (
                    <input inputMode="tel" className={f.phoneVerified ? "ok" : ""} value={f.phone} aria-label="Mobile number" placeholder="—"
                      onChange={(e) => setF((x) => ({ ...x, phone: e.target.value.replace(/[^\d+ ]/g, "").slice(0, 15), phoneVerified: false, otpSent: false, otp: "" }))} />
                  ), { req: true, xw: true })}
                  {!f.phoneVerified && row("Verify by OTP", f.otpSent ? `demo code ${DEMO_OTP}` : "sends a 4-digit code", !f.otpSent ? (
                    <button className="btn" disabled={digits(f.phone).length !== 10} onClick={() => { set("otpSent", true); toast(`Demo: OTP ${DEMO_OTP} sent to ${f.phone}.`); }}>Send OTP</button>
                  ) : (
                    <div style={{ display: "flex", gap: 6 }}>
                      <input value={f.otp} onChange={(e) => set("otp", e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="····" aria-label="OTP" />
                      <button className="btn p" onClick={() => (f.otp === DEMO_OTP ? setF((x) => ({ ...x, phoneVerified: true })) : toast("OTP does not match. Ask the patient to read it again."))}>Verify</button>
                    </div>
                  ), { xw: true })}
                  {!f.phoneVerified && row("Cannot verify — why", "e.g. phone with son", <input value={f.noPhoneReason} onChange={(e) => set("noPhoneReason", e.target.value)} placeholder="—" aria-label="No phone reason" />, { xw: true })}
                  {row("Area / street", "door no., street", <input value={f.area} onChange={(e) => set("area", e.target.value)} placeholder="—" aria-label="Area" />, { xw: true })}
                  {row("City / town", "", <input value={f.city} onChange={(e) => set("city", e.target.value)} aria-label="City" />, { req: true, xw: true })}
                  {row("State", "", <input value={f.state} onChange={(e) => set("state", e.target.value)} aria-label="State" />, { xw: true })}
                  {row("PIN code", "6 digits", <input inputMode="numeric" className={f.pin && !/^\d{6}$/.test(f.pin) ? "p1" : ""} value={f.pin} onChange={(e) => set("pin", e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="—" aria-label="PIN code" />, { req: true })}
                  <div className="ob-div">Next of kin</div>
                  {row("Name", "", <input value={f.kinName} onChange={(e) => set("kinName", e.target.value)} placeholder="—" aria-label="Next of kin name" />, { req: true, xw: true })}
                  {row("Relationship", "", <select value={f.kinRel} onChange={(e) => set("kinRel", e.target.value)} aria-label="Relationship"><option value="">Select…</option>{RELATIONS.map((r) => <option key={r}>{r}</option>)}</select>, { xw: true })}
                  {row("Mobile", "10 digits", <input inputMode="tel" value={f.kinPhone} onChange={(e) => set("kinPhone", e.target.value.replace(/[^\d+ ]/g, "").slice(0, 15))} placeholder="—" aria-label="Next of kin mobile" />, { req: true, xw: true })}
                </>
              ), { sub: "Used for appointment reminders and follow-up recall." })}
            </div>

            <div>
              {!quick && (
                <>
                  {/* 5. Visit */}
                  {panel(5, "Why they have come today", status(["Reason for visit"]), (
                    <>
                      {row("Arrived", "", <select value={f.arrival} onChange={(e) => set("arrival", e.target.value)} aria-label="Arrived">{ARRIVALS.map((a) => <option key={a}>{a}</option>)}</select>, { xw: true })}
                      {f.arrival !== "Walk-in" && f.arrival !== "Scheduled appointment" && row("Referred by", "collect the referral letter", <input value={f.referredBy} onChange={(e) => set("referredBy", e.target.value)} placeholder="Doctor, clinic or centre" aria-label="Referred by" />, { xw: true })}
                      {row("Service", visit ? visit.hint : "decides the clinic queue", (
                        <select value={f.visit} aria-label="Service" onChange={(e) => setF((x) => ({ ...x, visit: e.target.value, complaint: x.visit === e.target.value ? x.complaint : "" }))}>
                          <option value="">Select…</option>{VISITS.map((v) => <option key={v.id} value={v.id}>{v.label} · {v.q}</option>)}
                        </select>
                      ), { req: true, xw: true })}
                      {visit && row("Main complaint", "patient's words · pick or type", (
                        <>
                          <input list="complaints" value={f.complaint} onChange={(e) => set("complaint", e.target.value)} placeholder="—" aria-label="Main complaint" className={/rest|night|discoloured|cold/i.test(f.complaint) ? "p1" : ""} />
                          <datalist id="complaints">{visit.chips.map((c) => <option key={c} value={c} />)}</datalist>
                        </>
                      ), { req: true, xw: true })}
                      {visit && <div className="reg-chips">{visit.chips.map((c) => <button key={c} className={f.complaint === c ? "on" : ""} onClick={() => set("complaint", c)}>{c}</button>)}</div>}
                    </>
                  ), { sub: "Decides which clinic queue the patient joins." })}

                  {/* 6. Health background */}
                  {panel(6, "Quick health background", status(["Allergies recorded (or none known)"]), (
                    <>
                      {row("Diabetes", "", <select value={f.diabetes} className={f.diabetes === "Yes" ? "p1" : ""} onChange={(e) => set("diabetes", e.target.value)} aria-label="Diabetes"><option value="">Select…</option>{["Yes", "No", "Don't know"].map((x) => <option key={x}>{x}</option>)}</select>)}
                      {f.diabetes === "Yes" && row("Years with diabetes", "", <input inputMode="numeric" value={f.dmYears} onChange={(e) => set("dmYears", e.target.value.replace(/\D/g, "").slice(0, 2))} placeholder="—" aria-label="Years with diabetes" />)}
                      {f.diabetes === "Yes" && row("Takes insulin", "", yn("Takes insulin", f.insulin, (b) => set("insulin", b)))}
                      {row("Kidney problem", "", yn("Kidney problem", f.ckd, (b) => set("ckd", b)))}
                      {row("On dialysis", "", yn("On dialysis", f.dialysis, (b) => set("dialysis", b), "p2"))}
                      {row("Previous amputation", "toe, foot or leg", yn("Previous amputation", f.prevAmp, (b) => set("prevAmp", b), "p2"))}
                      {row("Previous angioplasty / bypass", "on the legs", yn("Previous angioplasty / bypass", f.prevRevasc, (b) => set("prevRevasc", b)))}
                      {row("Blood thinners", "e.g. warfarin, apixaban", yn("Blood thinners", f.anticoag, (b) => set("anticoag", b), "p2"))}
                      {row("Tobacco", "", <select value={f.smoking} className={/Current|Chewing/.test(f.smoking) ? "p1" : ""} onChange={(e) => set("smoking", e.target.value)} aria-label="Tobacco">{["Never", "Ex-smoker", "Current", "Chewing tobacco"].map((x) => <option key={x}>{x}</option>)}</select>)}
                      <div className="ob-div">Allergies and wound</div>
                      {row("No known allergies", "", yn("No known allergies", f.nkda, (b) => setF((x) => ({ ...x, nkda: b, allergies: b ? "" : x.allergies })), "ok"))}
                      {!f.nkda && row("Allergies", "medicines, dressings, contrast", <input value={f.allergies} className={f.allergies ? "p3" : ""} onChange={(e) => set("allergies", e.target.value)} placeholder="—" aria-label="Allergies" />, { req: true, xw: true })}
                      {row("Wound — where", "", <select value={f.woundSite} onChange={(e) => set("woundSite", e.target.value)} aria-label="Wound site"><option value="">Select…</option>{WOUND_SITES.map((w) => <option key={w}>{w}</option>)}</select>, { xw: true })}
                      {f.woundSite && f.woundSite !== "No wound" && row("Wound — how long", "weeks", <input inputMode="numeric" className={Number(f.woundWeeks) >= 4 ? "p1" : ""} value={f.woundWeeks} onChange={(e) => set("woundWeeks", e.target.value.replace(/\D/g, "").slice(0, 3))} placeholder="—" aria-label="Wound weeks" />)}
                      {row("Mobility", fallRisk ? "fall-risk band on the wristband" : "at arrival", <select value={f.mobility} className={fallRisk ? "p1" : ""} onChange={(e) => set("mobility", e.target.value)} aria-label="Mobility">{MOBILITY.map((m) => <option key={m}>{m}</option>)}</select>, { xw: true })}
                    </>
                  ), { sub: "Patient-reported at the desk · the nurse confirms at the assessment." })}

                  {/* 7. Payment */}
                  {panel(7, "Payment", status(["Payment / scheme"]), (
                    <>
                      {row("Scheme / payer", "", <select value={f.scheme} onChange={(e) => setF((x) => ({ ...x, scheme: e.target.value, schemeId: "" }))} aria-label="Scheme"><option value="">Select…</option>{SCHEMES.map((s) => <option key={s}>{s}</option>)}</select>, { req: true, xw: true })}
                      {SCHEME_ID[f.scheme] && row(SCHEME_ID[f.scheme], "", <input value={f.schemeId} onChange={(e) => set("schemeId", e.target.value)} placeholder="—" aria-label="Scheme ID" />, { req: true, xw: true })}
                      {f.scheme && f.scheme !== "Self-pay" && (f.visit === "hbot" || f.visit === "procedure" || f.visit === "vascular") && (
                        <div className="reg-note">Pre-authorisation will be needed if the doctor plans {f.visit === "hbot" ? "an HBOT course" : "an angiogram, angioplasty or surgery"}.</div>
                      )}
                    </>
                  ))}

                  {/* 8. Consent */}
                  {panel(8, "Consent", status(["Consent to treatment signed"]), (
                    <>
                      {row("Examination and treatment", "required", <select value={f.cCare ? "Yes" : "No"} className={f.cCare ? "ok" : ""} onChange={(e) => set("cCare", e.target.value === "Yes")} aria-label="Consent to treatment"><option>No</option><option>Yes</option></select>, { req: true })}
                      {row("Share with other centres", "Chennai, Bengaluru, Hyderabad", yn("Share with other centres", f.cShare, (b) => set("cShare", b), "ok"))}
                      {row("Research contact", "optional · care is the same", yn("Research contact", f.cResearch, (b) => set("cResearch", b), "ok"))}
                      {row("Wound photo use", "checked every time a photo is used", <select value={f.cPhoto} onChange={(e) => set("cPhoto", e.target.value)} aria-label="Wound photo use">{PHOTO_SCOPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>, { xw: true })}
                      <div className="ob-div">Signature {f.signed && <span style={{ color: "var(--green)" }}>✓ signed</span>}</div>
                      <div key={padKey}><SignaturePad onChange={(s) => set("signed", s)} /></div>
                    </>
                  ), { sub: `Explain in ${f.language}; the patient or a relative signs.` })}
                </>
              )}
            </div>
          </div>
        </div>

        {/* summary */}
        <div className="sticky-side">
          <section className="opanel">
            <div className="opanel-h"><span className="ic" aria-hidden>≡</span><span className="tt">Registration summary</span></div>
            <div className="opanel-sub"><b>{f.name.trim() || (f.returning ? "Returning patient" : "New patient")}</b> <span className="mut">{f.returning ? f.mrn : "MRN on registration"} · {here.name}</span></div>
            <div className="opanel-b">
              <div className="live" style={{ marginTop: 0, background: emergency ? "var(--red)" : priority === "priority" ? "var(--amber)" : queueCode === "—" ? "var(--line2)" : "var(--teal)", color: queueCode === "—" ? "var(--ink2)" : "#fff" }}>
                <div className="k">Route to · token</div>
                <div className="v" style={{ fontFamily: "var(--fm)" }}>{token}</div>
                <div className="a">{queueLabel}{priority !== "routine" ? ` · ${priority}` : ""}{priorityReasons.length ? ` — ${priorityReasons.join(", ")}` : ""}</div>
              </div>
              {(redFlags.length > 0 || f.diabetes === "Yes" || f.dialysis || f.anticoag || f.prevAmp || fallRisk || (f.allergies && !f.nkda)) && (
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 12 }}>
                  {redFlags.map((r) => <Pill key={r.id} c="r">{r.tag}</Pill>)}
                  {f.diabetes === "Yes" && <Pill>Diabetic{f.insulin ? " · insulin" : ""}</Pill>}
                  {f.dialysis && <Pill c="a">Dialysis</Pill>}{f.anticoag && <Pill c="a">Blood thinners</Pill>}{f.prevAmp && <Pill c="a">Previous amputation</Pill>}
                  {fallRisk && <Pill c="a">Fall risk</Pill>}{f.allergies && !f.nkda && <Pill c="r">Allergy</Pill>}
                </div>
              )}
              <div className="reg-prog" aria-label={`${checks.filter(([, ok, r]) => r && ok).length} of ${checks.filter(([, , r]) => r).length} done`}>
                <i style={{ width: `${(checks.filter(([, ok, r]) => r && ok).length / checks.filter(([, , r]) => r).length) * 100}%` }} />
              </div>
              <div className="fsec-h" style={{ margin: "8px 0 6px" }}><h4>{quick ? "Emergency quick registration" : "Checklist"}</h4><span className="hint">{checks.filter(([, ok, r]) => r && ok).length} / {checks.filter(([, , r]) => r).length}</span></div>
              {checks.filter(([, , req]) => req).map(([l, ok]) => (
                <div key={l} className={`reg-ck${ok ? " ok" : ""}`}><span>{ok ? "✓" : "○"}</span>{l}</div>
              ))}
              {quick && deferred.length > 0 && <div className="xs mut" style={{ marginTop: 6 }}>Deferred to bedside: {deferred.join(", ").toLowerCase()}.</div>}
              <button className={`btn ${emergency ? "" : "p"}`} style={{ width: "100%", marginTop: 14, padding: "11px", fontSize: 13, ...(emergency ? { background: "var(--red)", borderColor: "var(--red)", color: "#fff" } : {}) }}
                disabled={!canRegister} onClick={register}>
                {emergency ? "Register & send to Emergency" : f.returning ? "Confirm visit & issue token" : "Register & issue token"}
              </button>
              {!canRegister && <div className="xs mut" style={{ marginTop: 6 }}>{missing.length} item{missing.length > 1 ? "s" : ""} still needed.</div>}
              <button className="btn sm" style={{ width: "100%", marginTop: 8 }} onClick={reset}>Clear form</button>
            </div>
          </section>
        </div>
      </div>

      <TodayList />
    </>
  );
}

// ------------------------------------------------------------------ after registration

function Done({ r, onNext }: { r: Registration; onNext: () => void }) {
  const flags = [
    r.clinical.allergies !== "NKDA" && r.clinical.allergies !== "not recorded" && `ALLERGY: ${r.clinical.allergies}`,
    r.clinical.mobility !== "Walking unaided" || r.age >= 80 ? "FALL RISK" : "",
    r.clinical.diabetes === "Yes" && "DIABETIC", r.clinical.dialysis && "DIALYSIS", r.clinical.anticoag && "ANTICOAGULATED",
  ].filter(Boolean) as string[];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 360px", gap: 14, alignItems: "start" }}>
      <div>
        {r.priority === "emergency" ? (
          <div className="deny mb14" style={{ fontSize: 14 }}>
            <b>Emergency team alerted.</b> Take {r.name} to Emergency now with this slip. Red flags: {r.redFlags.join(", ")}.
            {r.emergencyQuick && " Registration was completed in quick mode — address, next of kin, payment and consent are pending and will be collected at the bedside."}
          </div>
        ) : (
          <div className="disc mb14" style={{ background: "var(--green-s)", borderColor: "#9bd3b4", color: "var(--ink2)" }}>
            <b style={{ color: "var(--green)" }}>Registered.</b> {r.name} joins the <b>{r.queueLabel}</b> queue with token <b>{r.token}</b>. Hand over the slip and wristband, and direct the patient to the triage bay — the nurse records vital signs and checks the wound before the doctor sees them.
          </div>
        )}
        <Card title="What happens next" className="mb14">
          <div className="chain">
            <div className="ev done"><b>Registration</b> · {new Date(r.at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} · {r.by}{r.returning ? " · returning patient" : " · new record created in the patient master"}</div>
            <div className={`ev ${r.priority === "emergency" ? "now" : "now"}`}><b>{r.priority === "emergency" ? "Emergency assessment" : "Initial nursing assessment"}</b> · vital signs, NEWS2, blood sugar, wound check</div>
            <div className="ev tbd"><b>Doctor consultation</b> · {r.queueLabel}</div>
            <div className="ev tbd"><b>Tests / procedure / dressing</b> · as ordered</div>
            <div className="ev tbd"><b>Billing & next appointment</b></div>
          </div>
          <Link className="btn sm" style={{ marginTop: 10 }} href="/clinical/triage">Open the assessment queue →</Link>
        </Card>
        <div style={{ display: "flex", gap: 9 }} className="noprint">
          <button className="btn p" onClick={() => window.print()}>Print slip & wristband</button>
          <button className="btn" onClick={onNext}>Register next patient</button>
          <Link className="btn" href="/clinical/profile">Open patient master</Link>
        </div>
      </div>

      <div>
        <div className="slip">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div><div className="xs mut">Vascular &amp; Diabetic Foot · {locById(r.location).name}, {locById(r.location).city}</div><div style={{ font: "700 16px/1.3 var(--f)", marginTop: 4 }}>{r.name.toUpperCase()}</div>
              <div className="sm">{r.age}{r.ageApprox ? " (approx.)" : ""} y · {r.sex}{r.dob ? ` · DOB ${r.dob}` : ""}</div></div>
            <div style={{ textAlign: "right" }}><div className="xs mut">Token</div><div className="token" style={{ color: r.priority === "emergency" ? "var(--red)" : "var(--ink)" }}>{r.token}</div></div>
          </div>
          <table className="t" style={{ marginTop: 10 }}><tbody>
            {[["MRN", r.mrn], ["Enterprise ID", r.epi], ["Queue", `${r.queueLabel}${r.priority !== "routine" ? ` · ${r.priority}` : ""}`], ["Complaint", r.complaint || r.redFlags.join(", ") || "—"],
              ["Arrived", `${new Date(r.at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })} · ${r.arrival}`], ["Payment", r.scheme], ["Language", r.language]].map(([k, v]) => (
              <tr key={k}><td className="xs mut" style={{ width: "36%" }}>{k}</td><td className="sm num">{v}</td></tr>
            ))}
          </tbody></table>
          <div style={{ marginTop: 12, border: "1px solid var(--line2)", borderRadius: 20, padding: "8px 14px", display: "flex", alignItems: "center", gap: 10 }}>
            <div aria-hidden style={{ display: "grid", gridTemplateColumns: "repeat(6,5px)", gap: 1 }}>{Array.from({ length: 36 }).map((_, i) => <span key={i} style={{ width: 5, height: 5, background: (i * 7 + r.mrn.length) % 3 ? "#10151c" : "#fff" }} />)}</div>
            <div className="xs" style={{ lineHeight: 1.35, flex: 1 }}><b>{r.name.toUpperCase()}</b><br />{r.age}y {r.sex[0]} · {r.mrn}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {flags.map((x) => <span key={x} className={`pill ${x.startsWith("ALLERGY") ? "r" : "a"}`} style={{ fontSize: 9 }}>{x.length > 26 ? x.slice(0, 25) + "…" : x}</span>)}
            </div>
          </div>
          <div className="xs mut" style={{ marginTop: 8 }}>Wristband · two identifiers (name + MRN) · check before every procedure</div>
        </div>
      </div>
    </div>
  );
}

function TodayList() {
  const st = useStore();
  const me = useMe();
  const rows = hereRegs(st, me);
  if (!rows.length) return null;
  function toTriage(id: string) {
    setState((s) => ({ registrations: s.registrations.map((r) => (r.id === id ? { ...r, status: "in assessment" } : r)) }));
    const r = rows.find((x) => x.id === id)!;
    audit(me.name, "write", `${r.epi} ${r.name}`, "Handed to assessment nurse");
  }
  return (
    <Card title="Today at the desk" hint="registered in this session · emergencies first" className="mt14">
      <table className="t">
        <thead><tr><th>Token</th><th>Patient</th><th>Queue</th><th>Complaint</th><th>Arrived</th><th>Waiting</th><th>Status</th><th /></tr></thead>
        <tbody>
          {[...rows].sort((a, b) => (a.priority === "emergency" ? -1 : 0) - (b.priority === "emergency" ? -1 : 0) || a.at.localeCompare(b.at)).map((r) => (
            <tr key={r.id}>
              <td className="num sm"><b style={{ color: r.priority === "emergency" ? "var(--red)" : undefined }}>{r.token}</b></td>
              <td className="sm"><b>{r.name}</b> <span className="xs mut">{r.age}{r.sex[0]}</span>{r.returning ? <> <Pill>returning</Pill></> : <> <Pill c="v">new</Pill></>}<div className="xs mut">{r.mrn}</div></td>
              <td className="sm">{r.queueLabel}{r.priority === "priority" && <> <Pill c="a">priority</Pill></>}</td>
              <td className="sm mut">{r.redFlags.length ? <span style={{ color: "var(--red)" }}>{r.redFlags.join(", ")}</span> : r.complaint}</td>
              <td className="num xs">{new Date(r.at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</td>
              <td className="num xs">{minsSince(r.at)} min</td>
              <td><Pill c={r.status === "sent to emergency" ? "r" : r.status === "ready for doctor" ? "g" : r.status === "in assessment" ? "b" : "a"}>{r.status}</Pill>{r.emergencyQuick && <div className="xs mut" style={{ marginTop: 3 }}>registration incomplete</div>}</td>
              <td style={{ textAlign: "right" }}>{r.status === "waiting for assessment" && <button className="btn sm" onClick={() => toTriage(r.id)}>Hand to nursing assessment</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
