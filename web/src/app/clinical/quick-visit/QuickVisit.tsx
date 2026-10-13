"use client";

// Quick visit: the whole outpatient visit on one screen, as an alternative to the step-by-step
// patient journey. Finds a returning patient (details and background fill in), records today's
// wound, circulation, diagnosis, treatment and outcome, and scores how complete the record is
// for research. Saved to Supabase through /api/quick-visit (lib/qv/model.ts for the form).

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Top, useMe } from "@/components/cx/Shell";
import { Pill, toast } from "@/components/cx/ui";
import { uploadPending, WoundPhotos, type Pending, type PhotoMeta } from "./Photos";
import { currentLocation, locById } from "@/lib/cx/locations";
import { useStore } from "@/lib/cx/store";
import {
  abiBand, blankBackground, blankPatient, blankVisit, COMPLAINTS, DIAGNOSES, INFECTION, OUTCOMES, PULSE, requiredMissing,
  researchReadiness, SITES, toSave, TREATMENTS, visitFromSaved, WAGNER, woundArea, type Patient, type Visit,
} from "@/lib/qv/model";

type Hit = { id: string; patient_no: string; hospital_id: string | null; name: string; sex: string; age_years: number | null; phone: string | null; area: string | null; city: string | null; visits: number; last_visit: string | null };
type SavedVisit = { id: string; visit_date: string; visit_type: string; location: string | null; diagnoses: string[]; wound_site: string | null; wound_area_cm2: number | null; wagner: number | null; outcome: string | null; research_score: number; created_by: string; data: Partial<Visit> };
type SavedPatient = Omit<Patient, "age_years" | "background" | "id"> & { id: string; age_years: number | null; background: Partial<Patient["background"]>; visits: SavedVisit[] };
type Recent = { id: string; patient_id: string; patient_no: string; name: string; sex: string; age_years: number | null; visit_type: string; diagnoses: string[]; outcome: string | null; research_score: number; created_by: string; created_at: string };

const fmtDate = (s: string | null) => (s ? new Date(`${s}T00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");
const tone = (score: number) => (score >= 80 ? "var(--green)" : score >= 50 ? "var(--amber)" : "var(--red)");

function patientFromSaved(s: SavedPatient): Patient {
  return {
    id: s.id, patient_no: s.patient_no, hospital_id: s.hospital_id ?? "", name: s.name, sex: s.sex, age_years: s.age_years != null ? String(s.age_years) : "",
    dob: s.dob ?? "", phone: s.phone ?? "", area: s.area ?? "", city: s.city ?? "", abha: s.abha ?? "", background: { ...blankBackground(), ...s.background },
  };
}

// ------------------------------------------------------------------ small building blocks

function Panel({ n, title, status, children, right }: { n: number; title: string; status?: ReactNode; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="opanel mb14" aria-label={title}>
      <div className="opanel-h"><span className="ic" aria-hidden>≡</span><span className="pn">{n}</span><span className="tt">{title}</span>{right}{status}</div>
      <div className="opanel-b">{children}</div>
    </section>
  );
}

function F({ label, req, hint, className = "", children }: { label: string; req?: boolean; hint?: string; className?: string; children: ReactNode }) {
  return (
    <div className={`qv-f ${className}`}>
      <label>{label}{req && <b className="rq"> *</b>}</label>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

function Tog<T extends string>({ value, options, onChange, label }: { value: T; options: readonly T[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="qv-tog" role="group" aria-label={label}>
      {options.map((o) => <button key={o} type="button" className={value === o ? "on" : ""} aria-pressed={value === o} onClick={() => onChange(o)}>{o}</button>)}
    </div>
  );
}

function YesNo({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return <Tog label={label} value={value ? "Yes" : "No"} options={["No", "Yes"] as const} onChange={(x) => onChange(x === "Yes")} />;
}

function Chips({ value, options, onChange, label }: { value: string[]; options: string[]; onChange: (v: string[]) => void; label: string }) {
  return (
    <div className="chipset" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o} type="button" className={value.includes(o) ? "on" : ""} aria-pressed={value.includes(o)}
          onClick={() => onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o])}>{o}</button>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ screen

export function QuickVisit() {
  const st = useStore();
  const me = useMe();
  const here = currentLocation(st, me);
  const [p, setP] = useState<Patient>(blankPatient);
  const [v, setV] = useState<Visit>(blankVisit);
  const [hist, setHist] = useState<SavedVisit[]>([]);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [recent, setRecent] = useState<Recent[] | null>(null);
  const [recentTick, setRecentTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [setupErr, setSetupErr] = useState("");
  const [photos, setPhotos] = useState<PhotoMeta[]>([]);      // saved photos of this patient (all visits)
  const [pending, setPending] = useState<Pending[]>([]);     // new photos for this visit, uploaded on Save

  const setPf = <K extends keyof Patient>(k: K, val: Patient[K]) => setP((x) => ({ ...x, [k]: val }));
  const setBg = <K extends keyof Patient["background"]>(k: K, val: Patient["background"][K]) => setP((x) => ({ ...x, background: { ...x.background, [k]: val } }));
  const setVf = <K extends keyof Visit>(k: K, val: Visit[K]) => setV((x) => ({ ...x, [k]: val }));

  // Patient search (debounced).
  useEffect(() => {
    let live = true;
    const t = setTimeout(() => {
      if (q.trim().length < 2) { setHits(null); return; }
      fetch(`/api/quick-visit?q=${encodeURIComponent(q.trim())}`).then(async (r) => {
        const b = await r.json().catch(() => []);
        if (!live) return;
        if (!r.ok) { setSetupErr(b.error ?? "Search failed."); setHits([]); return; }
        setHits(b as Hit[]);
      }).catch(() => live && setHits([]));
    }, 250);
    return () => { live = false; clearTimeout(t); };
  }, [q]);

  // Today's quick visits at this location.
  useEffect(() => {
    let live = true;
    fetch(`/api/quick-visit?recent=1&location=${encodeURIComponent(here.id)}`).then(async (r) => {
      const b = await r.json().catch(() => []);
      if (!live) return;
      if (!r.ok) { setSetupErr(b.error ?? "Could not load today's visits."); setRecent([]); return; }
      setRecent(b as Recent[]);
    }).catch(() => live && setRecent([]));
    return () => { live = false; };
  }, [here.id, recentTick]);

  async function openPatient(id: string, visitId?: string) {
    setQ(""); setHits(null); setErr("");
    const r = await fetch(`/api/quick-visit?patient=${encodeURIComponent(id)}`);
    const b = (await r.json().catch(() => null)) as SavedPatient | { error: string } | null;
    if (!r.ok || !b || "error" in b) return toast((b && "error" in b && b.error) || "Could not open the patient.");
    setP(patientFromSaved(b));
    setHist(b.visits);
    setPending([]);
    void loadPhotos(id);
    const editing = visitId ? b.visits.find((x) => x.id === visitId) : undefined;
    setV(editing ? visitFromSaved(editing) : { ...blankVisit(), visit_type: b.visits.length ? "Follow-up" : "New" });
  }

  async function loadPhotos(patientId: string) {
    const r = await fetch(`/api/quick-visit/photo?patient=${encodeURIComponent(patientId)}`).catch(() => null);
    const b = r ? await r.json().catch(() => []) : [];
    setPhotos(r?.ok && Array.isArray(b) ? (b as PhotoMeta[]) : []);
  }

  async function removePhoto(ph: PhotoMeta) {
    const reason = prompt("Why remove this photo? (it stays in the audit record)");
    if (!reason || reason.trim().length < 3) return;
    const r = await fetch(`/api/quick-visit/photo?id=${encodeURIComponent(ph.id)}&reason=${encodeURIComponent(reason.trim())}`, { method: "DELETE" });
    const b = await r.json().catch(() => ({}));
    if (!r.ok) return toast(b.error ?? "Could not remove the photo.");
    toast("Photo removed from the record.");
    if (p.id) void loadPhotos(p.id);
  }

  function startNew() {
    setP(blankPatient()); setV(blankVisit()); setHist([]); setErr(""); setQ(""); setPhotos([]); setPending([]);
  }

  const area = woundArea(v);
  const savedHere = v.id ? photos.filter((x) => x.visit_id === v.id) : [];
  const previousPhotos = photos.filter((x) => x.visit_id !== v.id);
  const photoCount = savedHere.length + pending.length;
  const ready = useMemo(() => researchReadiness(p, v, photoCount), [p, v, photoCount]);
  const missing = requiredMissing(p, v);
  const first = [...hist].reverse().find((h) => h.wound_area_cm2 != null);
  const healing = first && area != null && Number(first.wound_area_cm2) > 0 && first.id !== v.id
    ? Math.round(((Number(first.wound_area_cm2) - area) / Number(first.wound_area_cm2)) * 100) : null;

  async function save() {
    setBusy(true); setErr("");
    const r = await fetch("/api/quick-visit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(toSave(p, v, here.id, photoCount)) }).catch(() => null);
    const b = r ? await r.json().catch(() => ({})) : {};
    if (!r || !r.ok) { setBusy(false); return setErr(b.error ?? "Could not save. Check your connection."); }
    // Photos upload after the visit exists (they belong to it).
    const failed = pending.length ? await uploadPending(b.visit_id, pending, [v.side, v.site].filter(Boolean).join(" "), v.photo_consent) : 0;
    setBusy(false);
    if (failed) {
      // Keep the screen on this visit so the failed photos can be retried.
      setErr(`Visit saved, but ${failed} of ${pending.length} photo(s) did not upload. Open the visit from "Earlier visits" and add them again.`);
      setRecentTick((t) => t + 1);
      return;
    }
    const shots = pending.length ? ` · ${pending.length} photo${pending.length === 1 ? "" : "s"}` : "";
    toast(`${v.id ? "Visit updated" : "Visit saved"} · ${p.name.trim()} · ${b.patient_no}${shots}${ready.score < 100 ? ` · research ${ready.score}%` : " · research-ready"}`);
    setRecentTick((t) => t + 1);
    startNew();
  }

  const L = locById(here.id);

  return (
    <>
      <Top title="Quick visit" sub={<>One screen for the whole visit · find the patient, record today, save · {L.name}, {L.city}</>} />
      <div className="wrap">
        {setupErr && <div className="disc" style={{ marginBottom: 14 }}>{setupErr}</div>}
        <div className="qv">
          <div>
            {/* 1 · find or start */}
            <Panel n={1} title="Find the patient" status={<span className={`st${p.id ? " ok" : ""}`}>{p.id ? `Returning · ${p.patient_no}` : "New patient"}</span>}>
              <div className="qv-find">
                <input className="gsearch" style={{ width: "100%", padding: "10px 12px" }} value={q} onChange={(e) => setQ(e.target.value)}
                  placeholder="Search by mobile number, name, patient no. (PT-…) or hospital ID" aria-label="Search patients" />
                {hits && (
                  <div className="qv-hits">
                    {hits.length === 0 && <div className="mut sm" style={{ padding: 12 }}>No match — fill in the details below to add a new patient.</div>}
                    {hits.map((h) => (
                      <button key={h.id} type="button" className="qv-hit" onClick={() => void openPatient(h.id)}>
                        <span className="num" style={{ minWidth: 76 }}>{h.patient_no}</span>
                        <span style={{ flex: 1 }}><b>{h.name}</b> <span className="mut">{h.age_years ?? "?"}{h.sex[0]} · {h.phone ?? "no phone"}{h.area ? ` · ${h.area}` : ""}</span></span>
                        <span className="mut xs">{h.visits} visit{h.visits === 1 ? "" : "s"}{h.last_visit ? ` · last ${fmtDate(h.last_visit)}` : ""}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {(p.id || p.name) && (
                <div className="qv-who">
                  <b>{p.name || "New patient"}</b>
                  {p.id && <span className="mut">{p.patient_no} · {hist.length} earlier visit{hist.length === 1 ? "" : "s"}</span>}
                  {v.id && <Pill c="a">Editing the visit of {fmtDate(v.visit_date)}</Pill>}
                  <span style={{ flex: 1 }} />
                  <button className="btn sm" onClick={startNew}>Start a new patient</button>
                </div>
              )}
            </Panel>

            {/* 2 · patient */}
            <Panel n={2} title="Patient details">
              <div className="qv-grid">
                <F label="Full name" req className="w2"><input value={p.name} onChange={(e) => setPf("name", e.target.value)} aria-label="Full name" placeholder="as on ID" /></F>
                <F label="Sex" req><Tog label="Sex" value={p.sex} options={["Male", "Female", "Other"]} onChange={(x) => setPf("sex", x)} /></F>
                <F label="Age (years)" req={!p.dob}><input inputMode="numeric" value={p.age_years} onChange={(e) => setPf("age_years", e.target.value.replace(/\D/g, "").slice(0, 3))} aria-label="Age" /></F>
                <F label="Date of birth" hint="if known"><input type="date" value={p.dob} onChange={(e) => setPf("dob", e.target.value)} aria-label="Date of birth" /></F>
                <F label="Mobile"><input inputMode="tel" value={p.phone} onChange={(e) => setPf("phone", e.target.value.replace(/[^\d +]/g, "").slice(0, 16))} aria-label="Mobile" placeholder="98xxx xxxxx" /></F>
                <F label="Area / locality"><input value={p.area} onChange={(e) => setPf("area", e.target.value)} aria-label="Area" /></F>
                <F label="City"><input value={p.city} onChange={(e) => setPf("city", e.target.value)} aria-label="City" placeholder={L.city} /></F>
                <F label="Hospital ID / UHID" hint="if the hospital has one"><input value={p.hospital_id} onChange={(e) => setPf("hospital_id", e.target.value)} aria-label="Hospital ID" /></F>
                <F label="ABHA no." hint="optional"><input value={p.abha} onChange={(e) => setPf("abha", e.target.value)} aria-label="ABHA" /></F>
              </div>
            </Panel>

            {/* 3 · background */}
            <Panel n={3} title="Background" right={<span className="mut xs" style={{ color: "#9fb0c1" }}>kept with the patient for the next visit</span>}>
              <div className="qv-grid">
                <F label="Diabetes"><select value={p.background.diabetes} onChange={(e) => setBg("diabetes", e.target.value)} aria-label="Diabetes">
                  <option value="">Select…</option>{["No", "Type 2", "Type 1", "Prediabetes"].map((o) => <option key={o}>{o}</option>)}</select></F>
                {p.background.diabetes && p.background.diabetes !== "No" && <>
                  <F label="Years with diabetes"><input inputMode="numeric" value={p.background.dm_years} onChange={(e) => setBg("dm_years", e.target.value.replace(/\D/g, "").slice(0, 2))} aria-label="Years with diabetes" /></F>
                  <F label="HbA1c (%)" hint="latest"><input inputMode="decimal" value={p.background.hba1c} onChange={(e) => setBg("hba1c", e.target.value.replace(/[^\d.]/g, "").slice(0, 4))} aria-label="HbA1c" /></F>
                  <F label="On insulin"><YesNo label="On insulin" value={p.background.insulin} onChange={(x) => setBg("insulin", x)} /></F>
                </>}
                <F label="High BP"><YesNo label="High BP" value={p.background.hypertension} onChange={(x) => setBg("hypertension", x)} /></F>
                <F label="Kidney disease"><Tog label="Kidney disease" value={p.background.ckd} options={["No", "CKD", "Dialysis"]} onChange={(x) => setBg("ckd", x)} /></F>
                <F label="Smoking / tobacco"><Tog label="Smoking" value={p.background.smoking} options={["Never", "Former", "Current"]} onChange={(x) => setBg("smoking", x)} /></F>
                <F label="Previous amputation"><Tog label="Previous amputation" value={p.background.amputation} options={["None", "Minor", "Major"]} onChange={(x) => setBg("amputation", x)} /></F>
                <F label="Previous angioplasty / bypass"><YesNo label="Previous revascularisation" value={p.background.revasc} onChange={(x) => setBg("revasc", x)} /></F>
                <F label="Blood thinners"><YesNo label="Blood thinners" value={p.background.anticoag} onChange={(x) => setBg("anticoag", x)} /></F>
                <F label="Allergies" className="w2"><input value={p.background.allergies} onChange={(e) => setBg("allergies", e.target.value)} aria-label="Allergies" placeholder="e.g. penicillin — or NKDA" /></F>
                <F label="Current medicines" className="full"><input value={p.background.medicines} onChange={(e) => setBg("medicines", e.target.value)} aria-label="Current medicines" placeholder="e.g. metformin 500 BD, aspirin 75 OD" /></F>
              </div>
            </Panel>

            {/* 4 · today */}
            <Panel n={4} title="Today's visit">
              <div className="qv-grid">
                <F label="Visit date"><input type="date" value={v.visit_date} onChange={(e) => setVf("visit_date", e.target.value)} aria-label="Visit date" /></F>
                <F label="Visit type"><Tog label="Visit type" value={v.visit_type} options={["New", "Follow-up", "Emergency"]} onChange={(x) => setVf("visit_type", x)} /></F>
                <F label="Reason for visit" req><select value={v.complaint} onChange={(e) => setVf("complaint", e.target.value)} aria-label="Reason for visit">
                  <option value="">Select…</option>{COMPLAINTS.map((o) => <option key={o}>{o}</option>)}</select></F>
                <F label="Referred by" hint="doctor / clinic, if any"><input value={v.referred_by} onChange={(e) => setVf("referred_by", e.target.value)} aria-label="Referred by" /></F>
                <F label="Blood sugar (mg/dL)" hint="random"><input inputMode="numeric" value={v.rbs} onChange={(e) => setVf("rbs", e.target.value.replace(/\D/g, "").slice(0, 3))} aria-label="Blood sugar" /></F>
                <F label="BP (mmHg)"><input value={v.bp} onChange={(e) => setVf("bp", e.target.value.replace(/[^\d/]/g, "").slice(0, 7))} aria-label="Blood pressure" placeholder="138/82" /></F>
                <F label="In the patient's words" className="full"><input value={v.complaint_detail} onChange={(e) => setVf("complaint_detail", e.target.value)} aria-label="Complaint details" placeholder="e.g. ulcer under right big toe for 6 weeks, worse after new shoes" /></F>
              </div>
            </Panel>

            {/* 5 · wound */}
            <Panel n={5} title="Wound" right={<span style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 500, fontSize: 12 }}>Wound present <YesNo label="Wound present" value={v.wound} onChange={(x) => setVf("wound", x)} /></span>}>
              {!v.wound ? <div className="mut sm">No wound today — skip to circulation.</div> : (
                <div className="qv-grid">
                  <F label="Side"><Tog label="Side" value={v.side} options={["Right", "Left"]} onChange={(x) => setVf("side", x)} /></F>
                  <F label="Site"><select value={v.site} onChange={(e) => setVf("site", e.target.value)} aria-label="Wound site"><option value="">Select…</option>{SITES.map((o) => <option key={o}>{o}</option>)}</select></F>
                  <F label="Length × width (cm)" hint={area != null ? `Area ${area} cm²` : "area worked out for you"}>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <input inputMode="decimal" value={v.length} onChange={(e) => setVf("length", e.target.value.replace(/[^\d.]/g, "").slice(0, 5))} aria-label="Length" />
                      <span className="mut">×</span>
                      <input inputMode="decimal" value={v.width} onChange={(e) => setVf("width", e.target.value.replace(/[^\d.]/g, "").slice(0, 5))} aria-label="Width" />
                    </div>
                  </F>
                  <F label="Depth (cm)"><input inputMode="decimal" value={v.depth} onChange={(e) => setVf("depth", e.target.value.replace(/[^\d.]/g, "").slice(0, 4))} aria-label="Depth" /></F>
                  <F label="How long (weeks)"><input inputMode="numeric" value={v.weeks} onChange={(e) => setVf("weeks", e.target.value.replace(/\D/g, "").slice(0, 3))} aria-label="Wound duration" /></F>
                  <F label="Wagner grade"><select value={v.wagner} onChange={(e) => setVf("wagner", e.target.value)} aria-label="Wagner grade"><option value="">Select…</option>{WAGNER.map((w) => <option key={w.v} value={w.v}>{w.t}</option>)}</select></F>
                  <F label="Infection (IWGDF)" className="w2"><Tog label="Infection" value={v.infection} options={INFECTION} onChange={(x) => setVf("infection", x)} /></F>
                  <F label="Probes to bone"><YesNo label="Probes to bone" value={v.probe_bone} onChange={(x) => setVf("probe_bone", x)} /></F>
                  <F label="Gangrene"><Tog label="Gangrene" value={v.gangrene} options={["None", "Dry", "Wet"]} onChange={(x) => setVf("gangrene", x)} /></F>
                </div>
              )}
              {healing != null && (
                <div className="qv-who" style={{ background: healing >= 0 ? "var(--green-s)" : "var(--red-s)" }}>
                  Wound area {healing >= 0 ? "down" : "up"} <b>{Math.abs(healing)}%</b> since {fmtDate(first!.visit_date)} ({first!.wound_area_cm2} → {area} cm²)
                  {healing >= 0 && healing < 40 && hist.length >= 2 && <span className="mut"> · under 40% in this time — consider why it is slow</span>}
                </div>
              )}
              {v.wound && <WoundPhotos saved={savedHere} pending={pending} setPending={setPending} previous={previousPhotos} onRemoveSaved={(ph) => void removePhoto(ph)} />}
            </Panel>

            {/* 6 · circulation */}
            <Panel n={6} title="Circulation">
              <div className="qv-grid">
                <F label="Foot pulses" className="w2">
                  <div className="qv-pulses">
                    <span />{["Right", "Left"].map((s) => <span key={s} className="qv-l">{s}</span>)}
                    {(["dp", "pt"] as const).map((k) => (
                      <PulseRow key={k} k={k} v={v} onChange={(key, val) => setVf("pulses", { ...v.pulses, [key]: val })} />
                    ))}
                  </div>
                </F>
                <F label="ABI right" hint={abiBand(v.abi_right)?.label}><input inputMode="decimal" value={v.abi_right} onChange={(e) => setVf("abi_right", e.target.value.replace(/[^\d.]/g, "").slice(0, 4))} aria-label="ABI right" placeholder="e.g. 0.82" /></F>
                <F label="ABI left" hint={abiBand(v.abi_left)?.label}><input inputMode="decimal" value={v.abi_left} onChange={(e) => setVf("abi_left", e.target.value.replace(/[^\d.]/g, "").slice(0, 4))} aria-label="ABI left" /></F>
                <F label="Pain at rest / at night"><YesNo label="Rest pain" value={v.rest_pain} onChange={(x) => setVf("rest_pain", x)} /></F>
                <F label="Walks before calf pain (m)" hint="blank if no claudication"><input inputMode="numeric" value={v.claudication_m} onChange={(e) => setVf("claudication_m", e.target.value.replace(/\D/g, "").slice(0, 4))} aria-label="Claudication distance" /></F>
              </div>
            </Panel>

            {/* 7 · diagnosis, treatment, outcome */}
            <Panel n={7} title="Diagnosis, treatment and outcome">
              <div className="qv-grid">
                <F label="Diagnosis" className="full"><Chips label="Diagnosis" value={v.diagnoses} options={DIAGNOSES} onChange={(x) => setVf("diagnoses", x)} /></F>
                <F label="Done today" className="full"><Chips label="Treatment today" value={v.treatments} options={TREATMENTS} onChange={(x) => setVf("treatments", x)} /></F>
                <F label="Outcome" req className="w2"><select value={v.outcome} onChange={(e) => setVf("outcome", e.target.value)} aria-label="Outcome"><option value="">Select…</option>{OUTCOMES.map((o) => <option key={o}>{o}</option>)}</select></F>
                <F label="Next review"><input type="date" value={v.next_review} onChange={(e) => setVf("next_review", e.target.value)} aria-label="Next review" /></F>
                <F label="Notes" className="full"><textarea rows={3} value={v.notes} onChange={(e) => setVf("notes", e.target.value)} aria-label="Notes" placeholder="Plan, medicines started or changed, advice given…" /></F>
              </div>
            </Panel>

            {/* 8 · research */}
            <Panel n={8} title="Research">
              <div className="qv-grid">
                <F label="Patient agrees to use of this record for research" className="w2" hint="de-identified before it leaves the clinical record">
                  <Tog label="Research consent" value={v.research_consent} options={["Yes", "No", "Not asked"]} onChange={(x) => setVf("research_consent", x)} />
                </F>
                <F label="Wound photos may be used for" className="w2" hint="faces and identifying marks must not be in the photo">
                  <Tog label="Photo consent" value={v.photo_consent} options={["Care only", "Care + research"] as const} onChange={(x) => setVf("photo_consent", x)} />
                </F>
                <F label="Study / audit tag" hint="optional, e.g. HBOT-DFU-2026"><input value={v.study} onChange={(e) => setVf("study", e.target.value.toUpperCase().slice(0, 30))} aria-label="Study tag" /></F>
              </div>
            </Panel>
          </div>

          {/* side: save, readiness, history, today */}
          <aside className="qv-side">
            <section className="opanel">
              <div className="opanel-h"><span className="tt">{v.id ? "Update this visit" : "Save the visit"}</span></div>
              <div className="opanel-b">
                <div className="qv-l">Research readiness</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}><b style={{ fontSize: 26, color: tone(ready.score) }}>{ready.score}%</b><span className="mut xs">{ready.total - ready.missing.length} of {ready.total} core items</span></div>
                <div className="qv-meter"><span style={{ width: `${ready.score}%`, background: tone(ready.score) }} /></div>
                {ready.missing.length > 0 && <div className="xs mut" style={{ marginBottom: 10 }}>Missing: {ready.missing.join(" · ")}</div>}
                {missing.length > 0 && <div className="xs" style={{ color: "var(--red)", marginBottom: 8 }}>Needed to save: {missing.join(", ")}.</div>}
                {err && <div className="deny" style={{ marginBottom: 8 }}>{err}</div>}
                <button className="btn p" style={{ width: "100%", padding: 11 }} disabled={busy || missing.length > 0} onClick={() => void save()}>
                  {busy ? "Saving…" : v.id ? "Update visit" : p.id ? "Save follow-up visit" : "Save patient & visit"}
                </button>
              </div>
            </section>

            {p.id && (
              <section className="opanel">
                <div className="opanel-h"><span className="tt">Earlier visits</span><span className="pn">{hist.length}</span></div>
                <div className="opanel-b qv-hist">
                  {hist.length === 0 && <div className="mut xs">No visits yet.</div>}
                  {hist.map((h) => (
                    <button key={h.id} type="button" className={v.id === h.id ? "on" : ""} onClick={() => void openPatient(p.id!, h.id)} title="Open to view or correct">
                      <b>{fmtDate(h.visit_date)}</b> <span className="mut">· {h.visit_type}{h.location ? ` · ${locById(h.location).short}` : ""}</span><br />
                      {h.diagnoses.length ? h.diagnoses.join(", ") : <span className="mut">no diagnosis recorded</span>}
                      <br /><span className="mut xs">{photos.some((x) => x.visit_id === h.id) ? `📷 ${photos.filter((x) => x.visit_id === h.id).length} · ` : ""}{h.wound_area_cm2 != null ? `${h.wound_site ?? "wound"} ${h.wound_area_cm2} cm²` : "no wound measured"}{h.wagner != null ? ` · Wagner ${h.wagner}` : ""} · {h.outcome ?? "—"} · by {h.created_by}</span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            <section className="opanel">
              <div className="opanel-h"><span className="tt">Today at {L.short}</span><span className="pn">{recent?.length ?? "…"}</span></div>
              <div className="opanel-b qv-hist">
                {recent && recent.length === 0 && <div className="mut xs">No quick visits saved here today.</div>}
                {recent?.map((r) => (
                  <button key={r.id} type="button" onClick={() => void openPatient(r.patient_id)}>
                    <b>{r.name}</b> <span className="mut">{r.age_years ?? "?"}{r.sex[0]} · {r.patient_no}</span>
                    <span style={{ float: "right", color: tone(r.research_score), fontWeight: 600 }}>{r.research_score}%</span><br />
                    <span className="mut xs">{r.diagnoses.join(", ") || "no diagnosis"} · {r.outcome ?? "—"} · {r.created_by}</span>
                  </button>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </>
  );
}

function PulseRow({ k, v, onChange }: { k: "dp" | "pt"; v: Visit; onChange: (key: keyof Visit["pulses"], val: string) => void }) {
  const keys = k === "dp" ? (["dpR", "dpL"] as const) : (["ptR", "ptL"] as const);
  return (
    <>
      <span className="qv-l">{k === "dp" ? "Dorsalis pedis" : "Posterior tibial"}</span>
      {keys.map((key) => (
        <select key={key} value={v.pulses[key]} onChange={(e) => onChange(key, e.target.value)} aria-label={`${k === "dp" ? "Dorsalis pedis" : "Posterior tibial"} ${key.endsWith("R") ? "right" : "left"}`}>
          <option value="">—</option>{PULSE.map((o) => <option key={o}>{o}</option>)}
        </select>
      ))}
    </>
  );
}
