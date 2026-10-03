"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Guard, Top, useMe } from "@/components/cx/Shell";
import { Card, Denied, Disc, Pill, toast } from "@/components/cx/ui";
import { CLIN, newsBand, pat } from "@/lib/cx/data";
import { audit, nowIso, setState, uid, useStore, type MedChange, type VisitNote } from "@/lib/cx/store";
import { careRelationship } from "@/lib/cx/users";
import { latestNews } from "../round/Round";

const TRANSCRIPT = "Reviewed Mr Rajesh Kumar, post-operative day two following right superficial femoral artery angioplasty. He reports increased pain in the right great toe, about six out of ten, worse at night. On examination the dressing is soaked with purulent discharge and there is surrounding erythema extending roughly three centimetres from the wound edge. Dorsalis pedis is not palpable. Posterior tibial is monophasic on handheld Doppler. Capillary refill is four seconds. Creatinine has risen from one point five to three point one four and urine output is down to twenty five mils per hour. Impression is contrast induced nephropathy with a superimposed wound infection. Plan: hold metformin, start intravenous fluids at one hundred mils per hour, send a wound swab for culture and sensitivity, refer to nephrology today, and repeat creatinine and electrolytes in the morning.";

const EXTRACT: [string, string][] = [
  ["pain", "6"], ["painq", "Worse at night, right great toe"],
  ["wound", "Dressing soaked, purulent discharge, surrounding erythema ~3 cm from wound edge"],
  ["dp", "Absent"], ["pt", "Monophasic"], ["crt", "4"], ["creat", "3.14"], ["uo", "25"],
  ["imp", "Contrast-induced nephropathy with superimposed diabetic foot wound infection"],
  ["plan", "1. Hold metformin\n2. IV fluids 100 mL/h\n3. Wound swab for culture and sensitivity\n4. Nephrology referral today\n5. Repeat creatinine and electrolytes in the morning"],
];
const EXTRACT_MEDS: MedChange[] = [{ drug: "Metformin", change: "hold", detail: "1 g PO BD", reason: "eGFR < 30 after contrast" }];

const LABELS: Record<string, string> = {
  pain: "Pain score (0-10)", painq: "Pain character", dp: "Dorsalis pedis", pt: "Posterior tibial", crt: "Capillary refill (s)",
  wound: "Appearance and discharge", wagner: "Wagner grade", size: "Size (cm)", creat: "Creatinine (mg/dL)", uo: "Urine output (mL/h)",
  imp: "Impression", plan: "Plan", hbot: "HBOT / wound plan",
};

export function Visit({ pid }: { pid: string }) {
  return (
    <Guard screen="visit">
      <Top title="Visit analysis" sub="Structured entry with voice capture · draft → submit → sign" />
      <div className="wrap"><Body pid={pid} /></div>
    </Guard>
  );
}

function Body({ pid }: { pid: string }) {
  const me = useMe();
  const st = useStore();
  const router = useRouter();
  const p = pat(pid) ?? CLIN.patients[0];
  const ok = careRelationship(me, "CHN");
  const notes = st.notes.filter((n) => n.pid === p.id).sort((a, b) => b.at.localeCompare(a.at));
  const open = notes.find((n) => (n.status === "draft" || n.status === "returned") && n.by === me.name);
  const submitted = notes.find((n) => n.status === "submitted");
  const lastSigned = notes.find((n) => n.status === "signed");

  const blank = (): Record<string, string> => ({ wagner: "Grade 3 — deep ulcer with abscess or osteomyelitis", size: "2.4 × 1.8", hbot: "" });
  const [fields, setFields] = useState<Record<string, string>>(() => open?.fields ?? blank());
  const [meds, setMeds] = useState<MedChange[]>(() => open?.meds ?? []);
  const [aiFields, setAiFields] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<"typed" | "voice">(open?.mode ?? "typed");
  const [tx, setTx] = useState<string>("");
  const [rec, setRec] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [key, setKey] = useState(p.id);
  if (key !== p.id) { setKey(p.id); setFields(open?.fields ?? blank()); setMeds(open?.meds ?? []); setAiFields(new Set()); setTx(""); }

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);
  if (!ok) return <Denied why={`${me.name} has no care relationship with Chennai in-patients.`} />;

  const L = p.labs[3];
  const locked = !!submitted && submitted.by === me.name;
  const set = (k: string, v: string) => { setFields({ ...fields, [k]: v }); setAiFields((s) => { const n = new Set(s); n.delete(k); return n; }); };

  function dictate() {
    if (p.id !== "P-4412") { toast("The scripted demo dictation is for Rajesh Kumar (P-4412)."); return; }
    if (rec) { if (timer.current) clearInterval(timer.current); setRec(false); return; }
    const words = TRANSCRIPT.split(" ");
    let i = 0;
    setRec(true);
    timer.current = setInterval(() => {
      i += 3;
      setTx(words.slice(0, i).join(" "));
      if (i >= words.length) {
        if (timer.current) clearInterval(timer.current);
        setRec(false);
        setFields((f) => ({ ...f, ...Object.fromEntries(EXTRACT) }));
        setMeds(EXTRACT_MEDS);
        setAiFields(new Set(EXTRACT.map(([k]) => k)));
        setMode("voice");
        audit(me.name, "ai", `${p.id} ${p.name}`, `Voice pipeline extracted ${EXTRACT.length} fields into a draft (model: speech-v0.3 + clinical-ner-v0.2)`);
      }
    }, 45);
  }

  function upsert(status: VisitNote["status"]) {
    const at = nowIso();
    const id = open?.id ?? uid("VN");
    const version = open?.version ?? (lastSigned ? lastSigned.version + 1 : 1);
    const note: VisitNote = { id, pid: p.id, by: me.name, at, status, mode, version, fields, meds };
    setState((s) => ({ notes: [note, ...s.notes.filter((n) => n.id !== id)] }));
    return note;
  }

  function saveDraft() {
    upsert("draft");
    audit(me.name, "write", `${p.id} ${p.name}`, "Visit note draft saved (not current clinical truth)");
    toast("Draft saved. Drafts are not shown as current clinical record.");
  }

  function submit() {
    const note = upsert("submitted");
    const trainee = me.cls === "trainee";
    setState((s) => ({
      pending: [{
        id: uid("SO"), kind: "clinical", doc: `Visit analysis · ${p.id} ${p.name}${note.version > 1 ? ` · v${note.version} amendment` : ""}`, docType: "visit",
        entered: me.name, enteredRole: me.role, at: note.at, need: trainee ? "counter" : "author", needFrom: trainee ? p.consultant : me.name,
        priority: trainee && (p.acuity === "deteriorating" || p.acuity === "critical") ? "high" : "medium",
        why: trainee ? `Trainee entry on a ${p.acuity} patient. Countersignature required before the plan is actioned.` : "Author attestation. The note becomes the current record once signed.",
        subject: { type: "visit", ref: note.id }, content: JSON.stringify({ fields: note.fields, meds: note.meds }), version: note.version,
        amendOf: note.version > 1 ? lastSigned?.id : undefined,
        aiDraft: note.mode === "voice" ? `Voice-derived draft · speech-v0.3 + clinical-ner-v0.2 · on behalf of ${me.name}` : undefined,
      }, ...s.pending],
    }));
    audit(me.name, "write", `${p.id} ${p.name}`, `Visit note v${note.version} submitted for ${trainee ? "countersignature" : "signature"}`);
    toast(trainee ? `Submitted to ${p.consultant} for countersignature.` : "Submitted. Sign it in Review & sign-off to make it current.");
  }

  function amend() {
    if (!lastSigned) return;
    setFields(lastSigned.fields);
    setMeds(lastSigned.meds);
    const draft: VisitNote = { ...lastSigned, id: uid("VN"), status: "draft", by: me.name, at: nowIso(), version: lastSigned.version + 1 };
    setState((s) => ({ notes: [draft, ...s.notes] }));
    toast(`Amendment v${draft.version} opened. The signed v${lastSigned.version} stays readable and is superseded only when this is signed.`);
  }

  const fld = (k: string, opts?: { area?: boolean; span?: number; ro?: string }) => (
    <div className={`fld${aiFields.has(k) ? " ai" : ""}`} style={opts?.span ? { gridColumn: `span ${opts.span}` } : undefined}>
      <label>{LABELS[k] ?? k}</label>
      {opts?.ro != null ? <input value={opts.ro} readOnly /> : opts?.area
        ? <textarea value={fields[k] ?? ""} placeholder="—" readOnly={locked} onChange={(e) => set(k, e.target.value)} style={k === "plan" ? { minHeight: 112 } : undefined} />
        : <input value={fields[k] ?? ""} placeholder="—" readOnly={locked} onChange={(e) => set(k, e.target.value)} />}
      <div className="src">◉ from dictation — confirm</div>
    </div>
  );

  return (
    <>
      <Disc><b>Voice capture is simulated.</b> Recording replays a scripted dictation. Voice-derived content is always a draft (REQ-VISIT-002): it is attributed to the model and the invoking doctor, and nothing becomes current until a human signs.</Disc>

      <div className="phead">
        <div>
          <div className="fld" style={{ maxWidth: 320, marginBottom: 8 }}>
            <label>Patient</label>
            <select value={p.id} onChange={(e) => router.replace(`/clinical/visit?pid=${e.target.value}`, { scroll: false })}>
              {CLIN.patients.map((x) => <option key={x.id} value={x.id}>{x.bed} · {x.name}</option>)}
            </select>
          </div>
          <div className="nm">{p.name} <span className="mut sm">{p.age}{p.sex}</span></div>
          <div className="mt">{p.id} · {p.bed} · day {p.los} · {p.consultant}</div>
          <div className="dx">{p.dx}</div>
        </div>
        <div className="rt">
          <Pill c="b">In-patient visit note</Pill>
          {open && <Pill c={open.status === "returned" ? "r" : "a"}>v{open.version} {open.status}</Pill>}
          {submitted && <Pill c="v">v{submitted.version} awaiting signature</Pill>}
          {lastSigned && <Pill c="g">v{lastSigned.version} signed · current</Pill>}
          <span className="xs mut">{CLIN.now.replace("T", " ")}</span>
        </div>
      </div>

      <div className="mic">
        <button className={`mic-b${rec ? " rec" : ""}`} onClick={dictate} aria-label={rec ? "Stop dictation" : "Start dictation"} disabled={locked}>●</button>
        <div><div className="t">{rec ? "Listening… tap to stop" : aiFields.size ? `Ready — ${aiFields.size} values extracted` : "Dictate the visit"}</div>
          <div className="s">Speak naturally. Clinical values are extracted into the template and highlighted for you to confirm before submitting.</div></div>
        <div className="sp" />
        <button className="btn" onClick={() => { setTx(""); setFields(blank()); setMeds([]); setAiFields(new Set()); setMode("typed"); }} disabled={locked}>Clear</button>
      </div>
      <div className="tx-box">{tx ? <>{tx}{rec && <span className="cur" />}</> : <span className="mut">Transcript will appear here…</span>}</div>

      <div className="grid2">
        <Card title="Visit analysis" hint="violet fields were extracted from speech">
          {locked && <div className="disc">v{submitted!.version} is submitted and locked. It becomes current once signed; any change after that is an amendment.</div>}
          <div className="fsec"><div className="fsec-h"><h4>Subjective</h4></div><div className="frow">{fld("pain")}{fld("painq", { span: 2 })}</div></div>
          <div className="fsec"><div className="fsec-h"><h4>Vascular assessment</h4><Pill>diabetic foot protocol</Pill></div>
            <div className="frow">{fld("dp")}{fld("pt")}{fld("crt")}<div className="fld"><label>ABI</label><input placeholder="not recorded today" readOnly={locked} /></div></div></div>
          <div className="fsec"><div className="fsec-h"><h4>Wound assessment</h4></div>
            {fld("wound", { area: true })}
            <div className="frow mt14">
              <div className="fld"><label>Wagner grade</label><select value={fields.wagner} disabled={locked} onChange={(e) => set("wagner", e.target.value)}>
                {["Grade 1 — superficial", "Grade 2 — deep to tendon or capsule", "Grade 3 — deep ulcer with abscess or osteomyelitis", "Grade 4 — forefoot gangrene", "Grade 5 — whole-foot gangrene"].map((g) => <option key={g}>{g}</option>)}
              </select></div>
              {fld("size")}
              <div className="fld"><label>Photograph</label><Link href="/clinical/wound?wid=W-2318" className="btn sm" style={{ display: "inline-block" }}>Open wound series</Link></div>
            </div>
          </div>
          <div className="fsec"><div className="fsec-h"><h4>Renal and glycaemic</h4><Pill c="v">auto-populated from results</Pill></div>
            <div className="frow">{fld("creat")}{fld("uo")}{fld("egfr", { ro: String(L.egfr) })}{fld("tir", { ro: p.tir + "%" })}</div></div>
          <div className="fsec"><div className="fsec-h"><h4>Impression</h4></div>{fld("imp", { area: true })}</div>
          <div className="fsec"><div className="fsec-h"><h4>Plan</h4><Pill>each line becomes a tracked task · rule A22</Pill></div>{fld("plan", { area: true })}</div>

          <div className="fsec"><div className="fsec-h"><h4>Medication changes</h4><Pill c="a">reviewed against renal dosing · rule A09</Pill></div>
            {meds.length === 0 && <div className="sm mut mb14">No medication changes.</div>}
            {meds.map((m, i) => (
              <div key={i} className="frow" style={{ gridTemplateColumns: "1.3fr .8fr 1fr 1.4fr auto", alignItems: "end" }}>
                <div className={`fld${aiFields.has("plan") ? " ai" : ""}`}><label>Drug</label><input value={m.drug} readOnly={locked} onChange={(e) => setMeds(meds.map((x, j) => (j === i ? { ...x, drug: e.target.value } : x)))} /></div>
                <div className="fld"><label>Change</label><select value={m.change} disabled={locked} onChange={(e) => setMeds(meds.map((x, j) => (j === i ? { ...x, change: e.target.value as MedChange["change"] } : x)))}>{["start", "stop", "hold", "dose"].map((c) => <option key={c}>{c}</option>)}</select></div>
                <div className="fld"><label>Dose / route</label><input value={m.detail} readOnly={locked} onChange={(e) => setMeds(meds.map((x, j) => (j === i ? { ...x, detail: e.target.value } : x)))} /></div>
                <div className="fld"><label>Reason</label><input value={m.reason} readOnly={locked} onChange={(e) => setMeds(meds.map((x, j) => (j === i ? { ...x, reason: e.target.value } : x)))} /></div>
                {!locked && <button className="btn sm" onClick={() => setMeds(meds.filter((_, j) => j !== i))} aria-label="Remove">✕</button>}
              </div>
            ))}
            {!locked && <button className="btn sm" onClick={() => setMeds([...meds, { drug: "", change: "start", detail: "", reason: "" }])}>+ Add medication change</button>}
          </div>

          <div className="fsec"><div className="fsec-h"><h4>Wound / HBOT note</h4></div>{fld("hbot", { area: true })}</div>

          <div style={{ display: "flex", gap: 9, alignItems: "center", flexWrap: "wrap" }}>
            {!locked && <button className="btn p" onClick={submit} disabled={!fields.imp || !fields.plan}>{me.cls === "trainee" ? "Submit for countersignature" : "Submit for signature"}</button>}
            {!locked && <button className="btn" onClick={saveDraft}>Save draft</button>}
            {lastSigned && !open && !submitted && <button className="btn" onClick={amend}>Amend signed note</button>}
            {submitted && <Link className="btn v" href="/clinical/signoff">Go to sign-off queue</Link>}
            <span className="xs mut" style={{ marginLeft: "auto" }}>{mode === "voice" ? "Voice-derived: transcript attached for audit" : "Typed entry"}</span>
          </div>
        </Card>

        <div>
          <Card title="Extracted by the pipeline" hint="confirm each value" className="mb14">
            {aiFields.size === 0 ? <div className="mut sm">Nothing extracted yet. Start the dictation to populate the template.</div> : (
              <table className="t"><tbody>
                {EXTRACT.filter(([k]) => aiFields.has(k)).map(([k, v]) => (
                  <tr key={k}><td className="xs mut">{LABELS[k]}</td><td className="sm"><b>{v.split("\n")[0].slice(0, 46)}{v.length > 46 ? "…" : ""}</b></td>
                    <td style={{ textAlign: "right" }}><button className="btn sm v" onClick={() => setAiFields((s) => { const n = new Set(s); n.delete(k); return n; })}>confirm</button></td></tr>
                ))}
              </tbody></table>
            )}
          </Card>
          <Card title="Context the doctor did not have to ask for" className="mb14">
            <table className="t"><tbody>
              {([["Creatinine", `${p.labs[0].creat} → ${L.creat} mg/dL`, "r"], ["eGFR", `${L.egfr} mL/min/1.73m²`, L.egfr < 30 ? "r" : "a"], ["KDIGO stage", p.aki ? `Stage ${p.aki}` : "none", p.aki ? "r" : "g"],
                ["Urine output", `${p.uo6} mL/kg/h over 6h`, p.uo6 < 0.5 ? "r" : "g"], ["NEWS2", `${latestNews(st, p)} · ${newsBand(latestNews(st, p))[0]}`, "a"], ["Time in range", p.tir + "%", p.tir < 70 ? "a" : "g"],
                ["Nursing notes since last round", p.notes.filter((n) => n.h >= 48).length + st.obs.filter((o) => o.pid === p.id).length, "b"]] as const).map((r) => (
                <tr key={r[0]}><td className="sm mut">{r[0]}</td><td style={{ textAlign: "right" }}><Pill c={r[2]}>{r[1]}</Pill></td></tr>
              ))}
            </tbody></table>
          </Card>
          <Card title="Note history" hint="versions are never overwritten">
            {notes.length === 0 ? <div className="sm mut">No notes for this patient in this session.</div> : (
              <div className="chain">{notes.map((n) => (
                <div key={n.id} className={`ev ${n.status === "signed" ? "done" : n.status === "submitted" ? "now" : "tbd"}`}>
                  <b>v{n.version} {n.status}</b> · {n.by} · {n.at.replace("T", " ")} · {n.mode}
                </div>
              ))}</div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
