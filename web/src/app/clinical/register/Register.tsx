"use client";

// Step 1 of the patient journey: a patient walks in to the wound & vascular hospital
// and the front desk registers them. Registration finds or creates the enterprise
// identity (patient master), opens today's encounter, screens for limb- and
// life-threatening red flags, and routes the patient to the right queue with a token.

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
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
  const centre = me.centres[0];
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
  const nextNo = st.registrations.filter((r) => r.queue === queueCode && r.centre === centre).length + 1;
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
      id: uid("REG"), epi, mrn, token, queue: queueCode, queueLabel, priority, at, by: me.name, centre,
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

  const sec = (n: number, t: string, hint?: string, right?: ReactNode) => (
    <div className="card-h" style={{ padding: "0 0 10px", border: 0 }}>
      <h3><span className="pill n" style={{ marginRight: 6 }}>{n}</span>{t}</h3>{hint && <span className="hint">{hint}</span>}{right && <><div className="sp" />{right}</>}
    </div>
  );

  return (
    <>
      <Kpis cols={4} items={[
        { k: "Registered today", v: st.registrations.filter((r) => r.centre === centre).length, d: `${SITENAME[centre]} · this session` },
        { k: "Waiting for assessment", v: st.registrations.filter((r) => r.status === "waiting for assessment").length, d: "handed to nursing" },
        { k: "Sent to emergency", v: st.registrations.filter((r) => r.status === "sent to emergency").length, d: "red flag at the desk", tone: st.registrations.some((r) => r.priority === "emergency") ? "bad" : "" },
        { k: "Returning / new", v: `${st.registrations.filter((r) => r.returning).length} / ${st.registrations.filter((r) => !r.returning).length}`, d: "found in patient master vs created" },
      ]} />

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 340px", gap: 14, alignItems: "start" }}>
        <div>
          {/* 1. Find */}
          <Card className="mb14">
            {sec(1, "Find the patient first", "search before creating — most wound patients come back many times")}
            <input className="gsearch" style={{ width: "100%", padding: "9px 11px", fontSize: 14 }} autoFocus
              placeholder="Mobile number, name, MRN or enterprise ID (e.g. 99627, Fatima, CHN-644460)" value={q} onChange={(e) => setQ(e.target.value)} />
            {hits.length > 0 && (
              <table className="t" style={{ marginTop: 10 }}>
                <tbody>
                  {hits.map((p) => (
                    <tr key={p.key}>
                      <td className="sm"><b>{p.name}</b> <span className="mut xs">{p.age}{p.sex === "Male" ? "M" : p.sex === "Female" ? "F" : p.sex}</span>
                        {p.source === "today" && <> <Pill c="a">registered today</Pill></>}
                        <div className="xs mut">{p.phone ?? "no phone on file"}</div></td>
                      <td className="num xs">{p.mrn}<div className="mut">{p.epi}</div></td>
                      <td className="xs mut">home centre {SITENAME[p.centre] ?? p.centre}</td>
                      <td style={{ textAlign: "right" }}><button className="btn sm p" onClick={() => pick(p)}>This is the patient</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {ql.length >= 3 && hits.length === 0 && <div className="sm mut" style={{ marginTop: 10 }}>No match in the patient master. Register as a new patient below.</div>}
            {f.returning && (
              <div className="disc" style={{ marginTop: 12, marginBottom: 0, background: "var(--green-s)", borderColor: "#9bd3b4", color: "var(--ink2)" }}>
                <b style={{ color: "var(--green)" }}>Returning patient · {f.mrn} · {f.epi}.</b> Details below are pre-filled from the patient master. Confirm two identifiers (name + date of birth or mobile) with the patient, and update anything that has changed.
                {f.pid && PROF.profiles.find((p) => p.pid === f.pid)?.missing.length ? <> Missing on file: <b>{PROF.profiles.find((p) => p.pid === f.pid)!.missing.join(", ")}</b> — please collect.</> : null}
                <button className="btn sm" style={{ marginLeft: 8 }} onClick={reset}>Not this patient</button>
              </div>
            )}
          </Card>

          {/* 2. Red flags */}
          <Card className="mb14" attn={emergency}>
            {sec(2, "Red-flag screen — ask before any paperwork", "limb- and life-threatening conditions go straight to Emergency",
              <button className="btn sm" onClick={() => set("flags", Object.fromEntries(RED_FLAGS.map((r) => [r.id, false])))}>None of these</button>)}
            {RED_FLAGS.map((r) => (
              <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: "1px solid var(--line)" }}>
                <span className="sm" style={{ flex: 1 }}>{r.text}</span>
                <span className="yn">
                  <button className={`y${f.flags[r.id] === true ? " on" : ""}`} onClick={() => set("flags", { ...f.flags, [r.id]: true })}>Yes</button>
                  <button className={`n${f.flags[r.id] === false ? " on" : ""}`} onClick={() => set("flags", { ...f.flags, [r.id]: false })}>No</button>
                </span>
              </div>
            ))}
            {emergency && (
              <div className="deny" style={{ marginTop: 12 }}>
                <b>Emergency — do not make the patient wait at the desk.</b> Call the emergency nurse and move the patient now ({redFlags.map((r) => r.tag).join(", ")}). Only name, approximate age and sex are needed; the rest of the registration can be completed at the bedside.
              </div>
            )}
          </Card>

          {/* 3. Identity */}
          <Card className="mb14">
            {sec(3, "Who is the patient", f.returning ? "confirm and update" : "new patient")}
            <div className="frow">
              <div className="fld" style={{ gridColumn: "span 2" }}><label className="req-l">Full name (as on ID)</label><input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Murugan Selvam" /></div>
              <div className="fld"><label>Date of birth</label><input type="date" value={f.dob} max={new Date().toISOString().slice(0, 10)} onChange={(e) => { const a = ageFromDob(e.target.value); setF((x) => ({ ...x, dob: e.target.value, age: a || x.age, ageApprox: !a })); }} /></div>
              <div className="fld"><label className="req-l">Age (years)</label><input inputMode="numeric" value={f.age} onChange={(e) => setF((x) => ({ ...x, age: e.target.value.replace(/\D/g, "").slice(0, 3), ageApprox: !x.dob }))} placeholder="if DOB not known" />
                <div className="hint">{f.dob ? "from date of birth" : f.age ? "approximate — patient-reported" : ""}</div></div>
            </div>
            <div className="frow">
              <div className="fld"><label className="req-l">Sex</label>
                <div className="chipset">{["Male", "Female", "Other"].map((s) => <button key={s} className={f.sex === s ? "on" : ""} onClick={() => set("sex", s)}>{s}</button>)}</div></div>
              <div className="fld"><label>Preferred language</label><select value={f.language} onChange={(e) => set("language", e.target.value)}>{LANGS.map((l) => <option key={l}>{l}</option>)}</select></div>
              <div className="fld"><label>ABHA number (optional)</label><input value={f.abha} onChange={(e) => set("abha", e.target.value.replace(/[^\d-]/g, "").slice(0, 17))} placeholder="14-digit health ID" /></div>
            </div>
            {!quick && (
              <div className="frow">
                <div className="fld"><label className="req-l">Identity checked</label>
                  <select value={f.idSeen} onChange={(e) => set("idSeen", e.target.value)}>
                    <option value="">Select…</option>{["Aadhaar card (seen, not copied)", "Voter ID", "PAN card", "Driving licence", "Ration card", "Scheme card", "No ID — identified by relative"].map((x) => <option key={x}>{x}</option>)}
                  </select><div className="hint">Record which document was seen. Do not store the Aadhaar number.</div></div>
              </div>
            )}
            {dupes.length > 0 && (
              <div className="disc" style={{ marginTop: 6 }}>
                <b>Possible existing record — check before creating a new one.</b> Duplicate records split a patient&apos;s history across files.
                <table className="t" style={{ marginTop: 8 }}><tbody>
                  {dupes.map((p) => (
                    <tr key={p.key}><td className="sm"><b>{p.name}</b> <span className="xs mut">{p.age} · {p.phone ?? "no phone"}</span></td><td className="num xs">{p.mrn}</td>
                      <td style={{ textAlign: "right" }}><button className="btn sm" onClick={() => pick(p)}>Use this record</button></td></tr>
                  ))}
                </tbody></table>
              </div>
            )}
          </Card>

          {!quick && (
            <>
              {/* 4. Contact */}
              <Card className="mb14">
                {sec(4, "Contact and next of kin", "used for appointment reminders and follow-up recall")}
                <div className="frow">
                  <div className="fld"><label className="req-l">Mobile number</label>
                    <input inputMode="tel" value={f.phone} onChange={(e) => setF((x) => ({ ...x, phone: e.target.value.replace(/[^\d+ ]/g, "").slice(0, 15), phoneVerified: false, otpSent: false, otp: "" }))} placeholder="10-digit mobile" /></div>
                  <div className="fld"><label>Verify by OTP</label>
                    {f.phoneVerified ? <div><Pill c="g">✓ verified</Pill></div> : !f.otpSent ? (
                      <button className="btn" disabled={digits(f.phone).length !== 10} onClick={() => { set("otpSent", true); toast(`Demo: OTP ${DEMO_OTP} sent to ${f.phone}.`); }}>Send OTP</button>
                    ) : (
                      <div style={{ display: "flex", gap: 6 }}>
                        <input value={f.otp} onChange={(e) => set("otp", e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="4 digits" style={{ width: 90 }} />
                        <button className="btn p" onClick={() => (f.otp === DEMO_OTP ? setF((x) => ({ ...x, phoneVerified: true })) : toast("OTP does not match. Ask the patient to read it again."))}>Verify</button>
                      </div>
                    )}</div>
                  <div className="fld"><label>No phone / cannot verify — reason</label><input value={f.noPhoneReason} onChange={(e) => set("noPhoneReason", e.target.value)} placeholder="e.g. phone with son, number of relative given" disabled={f.phoneVerified} /></div>
                </div>
                <div className="frow">
                  <div className="fld" style={{ gridColumn: "span 2" }}><label>Area / street</label><input value={f.area} onChange={(e) => set("area", e.target.value)} placeholder="Door no., street, area" /></div>
                  <div className="fld"><label className="req-l">City / town</label><input value={f.city} onChange={(e) => set("city", e.target.value)} /></div>
                  <div className="fld"><label>State</label><input value={f.state} onChange={(e) => set("state", e.target.value)} /></div>
                  <div className="fld"><label className="req-l">PIN code</label><input inputMode="numeric" value={f.pin} onChange={(e) => set("pin", e.target.value.replace(/\D/g, "").slice(0, 6))} /></div>
                </div>
                <div className="frow">
                  <div className="fld"><label className="req-l">Next of kin — name</label><input value={f.kinName} onChange={(e) => set("kinName", e.target.value)} /></div>
                  <div className="fld"><label>Relationship</label><select value={f.kinRel} onChange={(e) => set("kinRel", e.target.value)}><option value="">Select…</option>{RELATIONS.map((r) => <option key={r}>{r}</option>)}</select></div>
                  <div className="fld"><label className="req-l">Next of kin — mobile</label><input inputMode="tel" value={f.kinPhone} onChange={(e) => set("kinPhone", e.target.value.replace(/[^\d+ ]/g, "").slice(0, 15))} /></div>
                </div>
              </Card>

              {/* 5. Visit */}
              <Card className="mb14">
                {sec(5, "Why they have come today", "decides which clinic queue the patient joins")}
                <div className="frow">
                  <div className="fld"><label>How did they arrive</label><select value={f.arrival} onChange={(e) => set("arrival", e.target.value)}>{ARRIVALS.map((a) => <option key={a}>{a}</option>)}</select></div>
                  {f.arrival !== "Walk-in" && f.arrival !== "Scheduled appointment" && (
                    <div className="fld" style={{ gridColumn: "span 2" }}><label>Referred by / from</label><input value={f.referredBy} onChange={(e) => set("referredBy", e.target.value)} placeholder="Doctor, clinic or centre — collect the referral letter" /></div>
                  )}
                </div>
                <div className="fld" style={{ marginBottom: 10 }}><label className="req-l">Service</label>
                  <div className="zgrid" style={{ gridTemplateColumns: "repeat(3,minmax(0,1fr))" }}>
                    {VISITS.map((v) => (
                      <button key={v.id} className={`zc${f.visit === v.id ? " on" : ""}`} style={{ textAlign: "left" }} onClick={() => setF((x) => ({ ...x, visit: v.id, complaint: x.visit === v.id ? x.complaint : "" }))}>
                        <div className="h"><span className="n">{v.label}</span><span className="v" style={{ fontSize: 12, color: "var(--ink3)" }}>{v.q}</span></div>
                        <div className="xs mut" style={{ marginTop: 3 }}>{v.hint}</div>
                      </button>
                    ))}
                  </div>
                </div>
                {visit && (
                  <div className="fld"><label className="req-l">Main complaint (patient&apos;s words)</label>
                    <div className="chipset" style={{ marginBottom: 7 }}>{visit.chips.map((c) => <button key={c} className={f.complaint === c ? "on" : ""} onClick={() => set("complaint", c)}>{c}</button>)}</div>
                    <input value={f.complaint} onChange={(e) => set("complaint", e.target.value)} placeholder="or type what the patient says" />
                  </div>
                )}
              </Card>

              {/* 6. Clinical basics */}
              <Card className="mb14">
                {sec(6, "Quick health background", "patient-reported at the desk · the nurse confirms at the nursing assessment")}
                <div className="frow">
                  <div className="fld"><label>Diabetes</label><div className="chipset">{["Yes", "No", "Don't know"].map((x) => <button key={x} className={f.diabetes === x ? "on" : ""} onClick={() => set("diabetes", x)}>{x}</button>)}</div></div>
                  {f.diabetes === "Yes" && <>
                    <div className="fld"><label>For how many years</label><input inputMode="numeric" value={f.dmYears} onChange={(e) => set("dmYears", e.target.value.replace(/\D/g, "").slice(0, 2))} /></div>
                    <div className="fld"><label>&nbsp;</label><label className="check"><input type="checkbox" checked={f.insulin} onChange={(e) => set("insulin", e.target.checked)} /> Takes insulin</label></div>
                  </>}
                </div>
                <div className="frow" style={{ gridTemplateColumns: "repeat(3,minmax(0,1fr))" }}>
                  {([["ckd", "Kidney problem"], ["dialysis", "On dialysis"], ["prevAmp", "Previous amputation (toe, foot or leg)"], ["prevRevasc", "Previous angioplasty / bypass on legs"], ["anticoag", "Takes blood thinners"]] as const).map(([k, l]) => (
                    <label key={k} className="check"><input type="checkbox" checked={f[k]} onChange={(e) => set(k, e.target.checked)} /> {l}</label>
                  ))}
                  <div className="fld"><label>Tobacco</label><select value={f.smoking} onChange={(e) => set("smoking", e.target.value)}>{["Never", "Ex-smoker", "Current", "Chewing tobacco"].map((x) => <option key={x}>{x}</option>)}</select></div>
                </div>
                <div className="frow">
                  <div className="fld" style={{ gridColumn: "span 2" }}><label className="req-l">Allergies</label>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input value={f.allergies} disabled={f.nkda} onChange={(e) => set("allergies", e.target.value)} placeholder="Medicines, dressings, plaster, contrast dye…" />
                      <label className="check" style={{ whiteSpace: "nowrap" }}><input type="checkbox" checked={f.nkda} onChange={(e) => setF((x) => ({ ...x, nkda: e.target.checked, allergies: e.target.checked ? "" : x.allergies }))} /> No known allergies</label>
                    </div></div>
                  <div className="fld"><label>Wound — where</label><select value={f.woundSite} onChange={(e) => set("woundSite", e.target.value)}><option value="">Select…</option>{WOUND_SITES.map((w) => <option key={w}>{w}</option>)}</select></div>
                  {f.woundSite && f.woundSite !== "No wound" && <div className="fld"><label>Wound — for how many weeks</label><input inputMode="numeric" value={f.woundWeeks} onChange={(e) => set("woundWeeks", e.target.value.replace(/\D/g, "").slice(0, 3))} /></div>}
                </div>
                <div className="fld"><label>Mobility at arrival</label>
                  <div className="chipset">{MOBILITY.map((m) => <button key={m} className={f.mobility === m ? "on" : ""} onClick={() => set("mobility", m)}>{m}</button>)}</div>
                  {fallRisk && <div className="hint" style={{ color: "var(--amber)", fontWeight: 600 }}>Fall-risk band will be printed on the wristband.</div>}
                </div>
              </Card>

              {/* 7. Payment */}
              <Card className="mb14">
                {sec(7, "Payment", "schemes often need pre-authorisation for angioplasty, amputation and HBOT")}
                <div className="frow">
                  <div className="fld"><label className="req-l">Scheme / payer</label><select value={f.scheme} onChange={(e) => setF((x) => ({ ...x, scheme: e.target.value, schemeId: "" }))}><option value="">Select…</option>{SCHEMES.map((s) => <option key={s}>{s}</option>)}</select></div>
                  {SCHEME_ID[f.scheme] && <div className="fld"><label className="req-l">{SCHEME_ID[f.scheme]}</label><input value={f.schemeId} onChange={(e) => set("schemeId", e.target.value)} /></div>}
                </div>
                {f.scheme && f.scheme !== "Self-pay" && (f.visit === "hbot" || f.visit === "procedure" || f.visit === "vascular") && (
                  <div className="disc" style={{ marginBottom: 0 }}>Pre-authorisation will be needed if the doctor plans {f.visit === "hbot" ? "an HBOT course" : "an angiogram, angioplasty or surgery"}. The insurance desk is notified automatically after the consultation.</div>
                )}
              </Card>

              {/* 8. Consent */}
              <Card className="mb14">
                {sec(8, "Consent", `explain in ${f.language}; the patient or a relative signs`)}
                <label className="check"><input type="checkbox" checked={f.cCare} onChange={(e) => set("cCare", e.target.checked)} /><span><b>Consent to examination and treatment</b> at this hospital (required).</span></label>
                <label className="check"><input type="checkbox" checked={f.cShare} onChange={(e) => set("cShare", e.target.checked)} /><span>Share my records with the network&apos;s other centres (Chennai, Bengaluru, Hyderabad) when I am treated there.</span></label>
                <label className="check"><input type="checkbox" checked={f.cResearch} onChange={(e) => set("cResearch", e.target.checked)} /><span>I may be contacted about research studies (optional — care is the same either way).</span></label>
                <div className="fld" style={{ margin: "8px 0 12px" }}><label>Wound photographs may be used for</label>
                  <div className="chipset">{PHOTO_SCOPES.map(([v, l]) => <button key={v} className={f.cPhoto === v ? "on" : ""} onClick={() => set("cPhoto", v)}>{l}</button>)}</div>
                  <div className="hint">Photos are always taken for care. Research and publication use are optional and enforced every time a photo is used.</div></div>
                <div key={padKey}><SignaturePad onChange={(s) => set("signed", s)} /></div>
              </Card>
            </>
          )}
        </div>

        {/* summary */}
        <div className="sticky-side">
          <Card title="Registration summary" bodyClass="card-b">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div>
                <div className="xs mut">Route to</div>
                <div style={{ font: "700 16px/1.3 var(--f)", color: emergency ? "var(--red)" : "var(--ink)" }}>{queueLabel}</div>
                <div style={{ marginTop: 5, display: "flex", gap: 5, flexWrap: "wrap" }}>
                  <Pill c={priority === "emergency" ? "r" : priority === "priority" ? "a" : "n"}>{priority}</Pill>
                  {priorityReasons.map((r) => <Pill key={r} c="a">{r}</Pill>)}
                </div>
              </div>
              <div style={{ textAlign: "right" }}><div className="xs mut">Token</div><div className="token" style={{ fontSize: 30, color: emergency ? "var(--red)" : "var(--ink)" }}>{token}</div></div>
            </div>
            <div className="xs mut" style={{ marginBottom: 4 }}>{f.returning ? `Returning · ${f.mrn}` : "New patient · MRN issued on registration"} · {SITENAME[centre]}</div>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", margin: "8px 0 12px" }}>
              {redFlags.map((r) => <Pill key={r.id} c="r">{r.tag}</Pill>)}
              {f.diabetes === "Yes" && <Pill>Diabetic{f.insulin ? " · insulin" : ""}</Pill>}
              {f.dialysis && <Pill c="a">Dialysis</Pill>}
              {f.anticoag && <Pill c="a">Blood thinners</Pill>}
              {f.prevAmp && <Pill c="a">Previous amputation</Pill>}
              {fallRisk && <Pill c="a">Fall risk</Pill>}
              {f.allergies && !f.nkda && <Pill c="r">Allergy</Pill>}
            </div>
            <div className="fsec-h" style={{ marginBottom: 8 }}><h4>{quick ? "Emergency quick registration" : "Checklist"}</h4></div>
            {checks.filter(([, , req]) => req).map(([l, ok]) => (
              <div key={l} className="sm" style={{ display: "flex", gap: 7, padding: "3px 0", color: ok ? "var(--ink2)" : "var(--ink)" }}>
                <span style={{ color: ok ? "var(--green)" : "var(--ink4)", fontWeight: 700 }}>{ok ? "✓" : "○"}</span>{l}
              </div>
            ))}
            {quick && deferred.length > 0 && <div className="xs mut" style={{ marginTop: 6 }}>Deferred to bedside: {deferred.join(", ").toLowerCase()}.</div>}
            <button className={`btn ${emergency ? "" : "p"}`} style={{ width: "100%", marginTop: 14, padding: "11px", fontSize: 13, ...(emergency ? { background: "var(--red)", borderColor: "var(--red)", color: "#fff" } : {}) }}
              disabled={!canRegister} onClick={register}>
              {emergency ? "Register & send to Emergency" : f.returning ? "Confirm visit & issue token" : "Register & issue token"}
            </button>
            {!canRegister && <div className="xs mut" style={{ marginTop: 6 }}>{missing.length} item{missing.length > 1 ? "s" : ""} still needed.</div>}
            <button className="btn sm" style={{ width: "100%", marginTop: 8 }} onClick={reset}>Clear form</button>
          </Card>
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
            <div><div className="xs mut">Vascular &amp; Diabetic Foot · {SITENAME[r.centre]}</div><div style={{ font: "700 16px/1.3 var(--f)", marginTop: 4 }}>{r.name.toUpperCase()}</div>
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
  const rows = st.registrations;
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
