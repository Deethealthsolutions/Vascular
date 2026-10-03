"use client";

// Step 2 of the patient journey (initial nursing assessment): the OPD nurse calls the patient from the
// registration queue, confirms identity, records vital signs (NEWS2 live), point-of-care
// glucose, a foot and limb check, and a first look at the wound. The screen suggests a
// triage category; the nurse confirms it and hands the patient to the doctor, or
// escalates to Emergency.

import Link from "next/link";
import { useEffect, useState } from "react";
import { Guard, Top, useMe } from "@/components/cx/Shell";
import { Card, Kpis, Modal, NewsBadge, Pill, Prog, toast } from "@/components/cx/ui";
import { SIGN, newsBand, news2 } from "@/lib/cx/data";
import { downscale } from "@/components/cx/photo";
import { audit, contentHash, storageOk, setState, uid, updateReg, useStore, type Limb, type Registration, type TriageRecord, type WoundPhoto } from "@/lib/cx/store";

const BAYS = ["Assessment bay 1", "Assessment bay 2", "Assessment bay 3", "Dressing room"];
const PULSES = ["Palpable", "Weak", "Doppler only", "Absent"];
const COLOURS = ["Normal", "Pale", "Dusky / blue", "Mottled", "Red"];
const TEMPS = ["Warm", "Cool", "Cold"];
const SENSATION = ["Intact", "Reduced", "Absent"];
const BEDS = ["Granulating (red)", "Slough (yellow)", "Necrotic (black)", "Dry eschar", "Mixed"];
const EXUDATE = ["None", "Light", "Moderate", "Heavy", "Purulent"];
const TARGET: Record<TriageRecord["category"], string> = { Emergency: "move now", Urgent: "doctor within 15 min", Standard: "doctor within 60 min", Routine: "doctor within 2 h" };
const CAT_TONE: Record<TriageRecord["category"], string> = { Emergency: "r", Urgent: "o", Standard: "a", Routine: "g" };

type LimbF = Limb;
type F = {
  idChecked: boolean;
  rr: string; spo2: string; o2: string; hr: string; sbp: string; dbp: string; pulse: string; temp: string; avpu: string;
  cbg: string; pain: string; weight: string; height: string;
  right: LimbF; left: LimbF; crt: string; restPain: boolean; claudicationM: string;
  hasWound: boolean; site: string; length: string; width: string; depth: string; bed: string; exudate: string; odour: boolean;
  erythemaCm: string; probeBone: boolean; photo: boolean;
  category: TriageRecord["category"] | ""; overrideReason: string; actions: string[]; note: string; attest: boolean;
};
const limb0 = (): LimbF => ({ dp: "", pt: "", colour: "Normal", temp: "Warm", sensation: "Intact", swelling: false });
const blank = (r?: Registration): F => ({
  idChecked: false, rr: "", spo2: "", o2: "0", hr: "", sbp: "", dbp: "", pulse: "", temp: "", avpu: "A", cbg: "", pain: "", weight: "", height: "",
  right: limb0(), left: limb0(), crt: "< 2 s", restPain: /rest|night/i.test(r?.complaint ?? ""), claudicationM: "",
  hasWound: !!r && r.clinical.woundSite !== "" && r.clinical.woundSite !== "No wound", site: r?.clinical.woundSite && r.clinical.woundSite !== "No wound" ? r.clinical.woundSite : "",
  length: "", width: "", depth: "", bed: "", exudate: "None", odour: false, erythemaCm: "0", probeBone: false, photo: false,
  category: "", overrideReason: "", actions: [], note: "", attest: false,
});

const num = (s: string) => (s.trim() === "" ? NaN : Number(s));
const minsSince = (at?: string) => (at ? Math.max(0, Math.round((Date.now() - Date.parse(at)) / 60000)) : 0);
const nowIso = () => new Date().toISOString();
const rank: Record<string, number> = { emergency: 0, priority: 1, routine: 2 };

export function Triage() {
  return (
    <Guard screen="triage">
      <Top title="Initial nursing assessment" sub="OPD nurse · vital signs, NEWS2, glucose, foot & limb check, first wound look → triage category → doctor" />
      <div className="wrap"><Body /></div>
    </Guard>
  );
}

function Body() {
  const me = useMe();
  const st = useStore();
  const [sel, setSel] = useState<string | null>(null);
  const [f, setFState] = useState<F>(blank());
  const [panel, setPanel] = useState<string | null>(null);
  const [record, setRecord] = useState<string | null>(null);

  const regs = st.registrations.filter((r) => me.centres.includes(r.centre as never));
  const anchor = (r: Registration) => r.requeuedAt ?? r.at;
  const waiting = regs.filter((r) => r.status === "waiting for assessment")
    .sort((a, b) => rank[a.priority] - rank[b.priority] || anchor(a).localeCompare(anchor(b)));
  const inBay = regs.filter((r) => r.status === "in assessment");
  const done = regs.filter((r) => r.status === "ready for doctor").sort((a, b) => (b.triage?.at ?? "").localeCompare(a.triage?.at ?? ""));
  const ed = regs.filter((r) => r.status === "sent to emergency");
  const lwbs = regs.filter((r) => r.status === "left without being seen");
  const r = regs.find((x) => x.id === sel && x.status === "in assessment") ?? null;
  const occupant = (b: string) => inBay.find((x) => x.bay === b);
  const freeBay = BAYS.find((b) => !occupant(b));

  // Form edits persist as a draft on the registration, so switching patients loses nothing.
  const setF = (fn: (x: F) => F) => setFState(fn);
  useEffect(() => {
    if (!sel) return;
    const t = setTimeout(() => saveDraft(sel, f), 250);
    return () => clearTimeout(t);
  }, [sel, f]);
  const set = <K extends keyof F>(k: K, v: F[K]) => setF((x) => ({ ...x, [k]: v }));

  function open(x: Registration) {
    if (sel && sel !== x.id) saveDraft(sel, f); // flush the pending debounced save before switching
    setSel(x.id);
    setFState(x.draft ? (x.draft as unknown as F) : blank(x));
    setPanel(null);
    setTimeout(() => document.getElementById("triage-form")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  function callTo(x: Registration, bay: string) {
    const occ = occupant(bay);
    if (occ && occ.id !== x.id) { toast(`${bay} is occupied by ${occ.token}. Release it or choose another bay.`); return; }
    updateReg(x.id, me.name, `Called to ${bay}`, { status: "in assessment", bay, calledAt: x.calledAt ?? nowIso(), recalls: 0 });
    audit(me.name, "read", `${x.epi} ${x.name}`, `Called to ${bay} for initial nursing assessment`);
    toast(`Announcement: token ${x.token}, ${x.name.split(" ")[0]}, please come to ${bay}.`);
    open({ ...x, bay });
  }

  function seedDemo() {
    setState((s) => ({ registrations: [...demoArrivals(me.centres[0], "Kavya R."), ...s.registrations] }));
    toast("Four demo arrivals added to the queue.");
  }

  const pr = regs.find((x) => x.id === panel);
  const rec = regs.find((x) => x.id === record);

  return (
    <>
      <Kpis cols={5} items={[
        { k: "Waiting for assessment", v: waiting.length, d: "from the registration desk", tone: waiting.length > 4 ? "warn" : "" },
        { k: "In a bay now", v: `${inBay.length} / ${BAYS.length}`, d: freeBay ? `${freeBay} is free` : "all bays occupied", tone: freeBay ? "" : "warn" },
        { k: "Longest wait", v: waiting.length ? `${Math.max(...waiting.map((x) => minsSince(x.at)))} min` : "—", d: "since registration", tone: waiting.some((x) => minsSince(x.at) > 30) ? "bad" : "" },
        { k: "Ready for doctor", v: done.length, d: "assessment complete" },
        { k: "Emergency / left", v: `${ed.length} / ${lwbs.length}`, d: "sent to Emergency · left without being seen", tone: ed.length ? "bad" : "" },
      ]} />

      <Card title="Bays" hint="who is where · one patient per bay" className="mb14">
        <div className="zgrid" style={{ gridTemplateColumns: `repeat(${BAYS.length},minmax(0,1fr))` }}>
          {BAYS.map((b) => {
            const o = occupant(b);
            const pct = o ? progress(o) : 0;
            return (
              <div key={b} className={`zc${o && o.id === sel ? " on" : ""}`} style={{ cursor: "default", minHeight: 150, display: "flex", flexDirection: "column" }}>
                <div className="h"><span className="n">{b}</span>{o ? <Pill c={minsSince(o.calledAt) > 20 ? "a" : "b"}>{minsSince(o.calledAt)} min</Pill> : <Pill c="g">free</Pill>}</div>
                {o ? (
                  <>
                    <div style={{ marginTop: 8 }}><span className="num" style={{ font: "700 16px/1 var(--fm)" }}>{o.token}</span> <b className="sm">{o.name}</b></div>
                    <div className="xs mut" style={{ marginTop: 2 }}>{o.age}{o.sex[0]} · {o.queueLabel}</div>
                    <div style={{ margin: "8px 0 4px" }}><Prog pct={pct} label={`${pct}%`} /></div>
                    <div className="xs mut">assessment form complete</div>
                    <div style={{ display: "flex", gap: 5, marginTop: "auto", paddingTop: 8, flexWrap: "wrap" }}>
                      <button className="btn sm p" onClick={() => open(o)}>{o.id === sel ? "Editing" : "Open"}</button>
                      <button className="btn sm" onClick={() => setPanel(o.id)}>Actions</button>
                      <button className="btn sm" onClick={() => { updateReg(o.id, me.name, `Released from ${b}, back to waiting`, { status: "waiting for assessment", bay: undefined }); if (sel === o.id) setSel(null); }}>Release</button>
                    </div>
                  </>
                ) : (
                  <div style={{ marginTop: "auto" }}>
                    {waiting[0]
                      ? <button className="btn sm p" style={{ width: "100%" }} onClick={() => callTo(waiting[0], b)}>Call next · {waiting[0].token}</button>
                      : <div className="xs mut">Nobody waiting.</div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <Card title="Waiting for assessment" hint="priority first, then order of arrival · click a card for details and actions" className="mb14"
        right={<><Link className="btn sm" href="/clinical/register">Registration desk</Link>{waiting.length === 0 && <button className="btn sm v" onClick={seedDemo}>Load demo arrivals</button>}</>}>
        {waiting.length === 0 ? (
          <div className="sm mut">Nobody is waiting. Register patients at the desk{regs.length === 0 ? ", or load demo arrivals" : ""}.</div>
        ) : (
          <div className="zgrid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(250px,1fr))" }}>
            {waiting.map((x, i) => {
              const w = minsSince(x.at);
              return (
                <div key={x.id} className="zc" role="button" tabIndex={0} onClick={() => setPanel(x.id)} onKeyDown={(e) => e.key === "Enter" && setPanel(x.id)}>
                  <div className="h"><span className="num" style={{ font: "700 18px/1 var(--fm)" }}>{x.token}</span>
                    <span style={{ display: "flex", gap: 4 }}>{i === 0 && <Pill c="v">next</Pill>}{x.priority === "priority" && <Pill c="a">priority</Pill>}{x.requeuedAt && <Pill>re-queued</Pill>}</span></div>
                  <div className="sm" style={{ marginTop: 6 }}><b>{x.name}</b> <span className="xs mut">{x.age}{x.sex[0]} · {x.returning ? "returning" : "new"}</span></div>
                  <div className="xs mut" style={{ marginTop: 2 }}>{x.queueLabel} · {x.complaint || "—"}</div>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", margin: "6px 0" }}>
                    {x.clinical.diabetes === "Yes" && <Pill>Diabetic</Pill>}
                    {x.clinical.dialysis && <Pill c="a">Dialysis</Pill>}
                    {x.clinical.anticoag && <Pill c="a">Anticoag</Pill>}
                    {x.clinical.allergies !== "NKDA" && x.clinical.allergies !== "not recorded" && <Pill c="r">Allergy</Pill>}
                    {x.clinical.mobility !== "Walking unaided" && <Pill c="a">{x.clinical.mobility.split(" ")[0]}</Pill>}
                    {(x.notes?.length ?? 0) > 0 && <Pill c="b">{x.notes!.length} note</Pill>}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                    <span className="xs" style={{ color: w > 30 ? "var(--red)" : "var(--ink3)", fontWeight: w > 30 ? 600 : 400 }}>waiting {w} min</span>
                    <button className="btn sm p" disabled={!freeBay} onClick={(e) => { e.stopPropagation(); if (freeBay) callTo(x, freeBay); }}>
                      {freeBay ? `Call to ${freeBay.replace("Assessment ", "")}` : "No free bay"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <div id="triage-form" style={{ scrollMarginTop: 80 }}>
        {r ? <Form key={r.id} r={r} f={f} set={set} setF={setF} onDone={() => setSel(null)} onActions={() => setPanel(r.id)} /> : (
          <Card className="mb14"><div className="sm mut">Open a patient from a bay, or call the next patient, to start the assessment.</div></Card>
        )}
      </div>

      <div className="grid2 mt14">
        <Card title="Ready for doctor" hint="click a row to view the assessment record" right={<Pill c="g">{done.length}</Pill>}>
          {done.length === 0 ? <div className="sm mut">None yet.</div> : (
            <table className="t"><tbody>
              {done.map((x) => (
                <tr key={x.id} className="clk" onClick={() => setRecord(x.id)}>
                  <td className="num sm"><b>{x.token}</b></td>
                  <td className="sm"><b>{x.name}</b><div className="xs mut">{x.queueLabel}</div></td>
                  <td><NewsBadge n={x.triage!.news} size={30} /></td>
                  <td><Pill c={CAT_TONE[x.triage!.category]}>{x.triage!.category}</Pill><div className="xs mut" style={{ marginTop: 3 }}>{TARGET[x.triage!.category]}</div></td>
                  <td className="xs mut">{x.triage!.flags.slice(0, 2).join(" · ") || "no flags"}</td>
                </tr>
              ))}
            </tbody></table>
          )}
        </Card>
        <Card title="In Emergency · left without being seen" right={<Pill c={ed.length ? "r" : "n"}>{ed.length + lwbs.length}</Pill>}>
          {ed.length + lwbs.length === 0 ? <div className="sm mut">None.</div> : (
            <table className="t"><tbody>
              {ed.map((x) => (
                <tr key={x.id} className="clk" onClick={() => (x.triage ? setRecord(x.id) : setPanel(x.id))}><td className="num sm"><b style={{ color: "var(--red)" }}>{x.token}</b></td><td className="sm"><b>{x.name}</b> <span className="xs mut">{x.age}{x.sex[0]}</span></td>
                  <td className="xs" style={{ color: "var(--red)" }}>{x.triage ? `escalated from assessment · ${x.triage.flags.slice(0, 2).join(", ")}` : x.redFlags.join(", ") || "sent from assessment queue"}</td></tr>
              ))}
              {lwbs.map((x) => (
                <tr key={x.id} className="clk" onClick={() => setPanel(x.id)}><td className="num sm"><b>{x.token}</b></td><td className="sm"><b>{x.name}</b></td>
                  <td className="xs mut">left without being seen · follow-up call due</td></tr>
              ))}
            </tbody></table>
          )}
        </Card>
      </div>

      {pr && <PatientPanel r={pr} bays={BAYS} occupant={occupant} onClose={() => setPanel(null)} onCall={(b) => { callTo(pr, b); setPanel(null); }} onOpen={() => open(pr)} />}
      {rec && rec.triage && <RecordModal r={rec} onClose={() => setRecord(null)} onReopen={() => { const d = fromRecord(rec); updateReg(rec.id, me.name, "Assessment reopened for correction", { status: "in assessment", bay: freeBay ?? BAYS[0], draft: d as unknown as Record<string, unknown> }); setRecord(null); open({ ...rec, draft: d as unknown as Record<string, unknown> }); }} />}
    </>
  );
}

/** Rebuild the form from a completed triage record, for correction after reopening. */
function fromRecord(r: Registration): F {
  const t = r.triage!, v = t.vitals, w = t.wound, str = (n: number | null) => (n == null || isNaN(n) ? "" : String(n));
  return {
    ...blank(r), idChecked: true, rr: str(v.rr), spo2: str(v.spo2), o2: String(v.o2), hr: str(v.hr), sbp: str(v.sbp), dbp: str(v.dbp), pulse: str(v.pulse),
    temp: str(v.temp), avpu: v.avpu, cbg: str(v.cbg), pain: str(v.pain), weight: str(v.weight), height: str(v.height),
    right: t.limbs.right, left: t.limbs.left, crt: t.limbs.crt, restPain: t.limbs.restPain, claudicationM: t.limbs.claudicationM,
    hasWound: !!w, site: w?.site ?? "", length: w ? String(w.length) : "", width: w ? String(w.width) : "", depth: w?.depth ? String(w.depth) : "",
    bed: w?.bed ?? "", exudate: w?.exudate ?? "None", odour: w?.odour ?? false, erythemaCm: w ? String(w.erythemaCm) : "0", probeBone: w?.probeBone ?? false,
    category: t.category === t.suggested ? "" : t.category, overrideReason: t.overrideReason ?? "", actions: t.actions, note: t.note, attest: false,
  };
}

/** Persist the in-progress form on the registration (debounced from an effect). */
function saveDraft(id: string, f: F) {
  setState((s) => ({ registrations: s.registrations.map((y) => (y.id === id && y.status === "in assessment" ? { ...y, draft: f as unknown as Record<string, unknown> } : y)) }));
}

/** Rough completeness of the triage draft, for the bay board. */
function progress(r: Registration) {
  const d = r.draft as Partial<F> | undefined;
  if (!d) return 0;
  const parts = [d.idChecked, d.rr && d.spo2 && d.hr && d.sbp && d.dbp && d.temp, d.pain, d.right?.dp && d.left?.dp, !d.hasWound || (d.length && d.width && d.bed), d.attest];
  return Math.round((100 * parts.filter(Boolean).length) / parts.length);
}

// ------------------------------------------------------------------ patient panel (card actions)

const QUEUES = ["Wound clinic", "Diabetic foot clinic", "Vascular OPD", "HBOT assessment", "Follow-up / dressing", "Scheduled procedure"];

function PatientPanel({ r, bays, occupant, onClose, onCall, onOpen }: {
  r: Registration; bays: string[]; occupant: (b: string) => Registration | undefined; onClose: () => void; onCall: (bay: string) => void; onOpen: () => void;
}) {
  const me = useMe();
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [queue, setQueue] = useState(r.queueLabel);
  const recalls = r.recalls ?? 0;
  const inBay = r.status === "in assessment";
  const waiting = r.status === "waiting for assessment";
  const act = (text: string, patch: Partial<Registration> = {}, msg?: string) => {
    updateReg(r.id, me.name, text, patch);
    audit(me.name, "write", `${r.epi} ${r.name}`, text);
    if (msg) toast(msg);
  };

  return (
    <Modal title={<><span className="num">{r.token}</span> · {r.name}</>} onClose={onClose} width={800}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
        <Pill c={r.status === "sent to emergency" ? "r" : r.status === "in assessment" ? "b" : r.status === "ready for doctor" ? "g" : "a"}>{r.status}{r.bay && inBay ? ` · ${r.bay}` : ""}</Pill>
        <Pill c={r.priority === "priority" ? "a" : r.priority === "emergency" ? "r" : "n"}>{r.priority}</Pill>
        <Pill>{r.queueLabel}</Pill><Pill>{r.returning ? "returning" : "new"} · {r.mrn}</Pill>
        {recalls > 0 && <Pill c="a">called {recalls + 1}×</Pill>}
      </div>

      <div className="grid2" style={{ gap: 14 }}>
        <div>
          <div className="fsec-h"><h4>Registration details</h4></div>
          <table className="t"><tbody>
            {([["Age / sex", `${r.age}${r.ageApprox ? " (approx.)" : ""} · ${r.sex}`], ["Complaint", r.complaint || "—"], ["Arrival", `${r.arrival}${r.referredBy ? ` · ${r.referredBy}` : ""}`],
              ["Mobile", `${r.phone || "—"}${r.phoneVerified ? " ✓" : ""}`], ["Next of kin", r.kin ? `${r.kin.name} (${r.kin.rel}) ${r.kin.phone}` : "—"], ["Language", r.language],
              ["Payment", `${r.scheme}${r.schemeId ? ` · ${r.schemeId}` : ""}`], ["Allergies", r.clinical.allergies],
              ["Background", [r.clinical.diabetes === "Yes" && `diabetic ${r.clinical.dmYears}y${r.clinical.insulin ? ", insulin" : ""}`, r.clinical.dialysis && "dialysis", r.clinical.ckd && "kidney disease", r.clinical.prevAmp && "previous amputation", r.clinical.prevRevasc && "previous revascularisation", r.clinical.anticoag && "blood thinners", r.clinical.smoking !== "Never" && r.clinical.smoking.toLowerCase()].filter(Boolean).join(", ") || "none reported"],
              ["Wound", r.clinical.woundSite ? `${r.clinical.woundSite}${r.clinical.woundWeeks ? ` · ${r.clinical.woundWeeks} weeks` : ""}` : "—"], ["Mobility", r.clinical.mobility],
              ["Consent", `treatment ${r.consent.care ? "✓" : "pending"} · photos ${r.consent.photo}`]] as const).map(([k, v]) => (
              <tr key={k}><td className="xs mut" style={{ width: "30%" }}>{k}</td><td className="sm">{v}</td></tr>
            ))}
          </tbody></table>
        </div>

        <div>
          <div className="fsec-h"><h4>Actions</h4></div>
          {(waiting || inBay) && (
            <div className="fld" style={{ marginBottom: 10 }}><label>{inBay ? "Move to bay" : "Call to bay"}</label>
              <div className="chipset">{bays.map((b) => {
                const o = occupant(b);
                const mine = o?.id === r.id;
                return <button key={b} className={mine ? "on" : ""} disabled={!!o && !mine} onClick={() => (inBay ? act(`Moved from ${r.bay} to ${b}`, { bay: b }, `${r.token} moved to ${b}.`) : onCall(b))}>{b}{o && !mine ? ` · ${o.token}` : ""}</button>;
              })}</div></div>
          )}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
            {inBay && <button className="btn sm p" onClick={() => { onOpen(); onClose(); }}>Open assessment form</button>}
            {inBay && <button className="btn sm" onClick={() => act(`Recalled to ${r.bay} (announcement ${recalls + 2})`, { recalls: recalls + 1 }, `Announcement: token ${r.token}, please come to ${r.bay}.`)}>Recall (announce again)</button>}
            {inBay && recalls >= 2 && <button className="btn sm" onClick={() => { act(`Did not respond after ${recalls + 1} calls — re-queued behind patients of the same priority`, { status: "waiting for assessment", bay: undefined, requeuedAt: new Date().toISOString(), recalls: 0 }, `${r.token} did not respond — re-queued behind others at the same priority.`); onClose(); }}>Not responding → re-queue</button>}
            {inBay && <button className="btn sm" onClick={() => { act(`Released from ${r.bay}, back to waiting`, { status: "waiting for assessment", bay: undefined }); onClose(); }}>Release bay</button>}
            {waiting && (r.priority === "priority"
              ? <button className="btn sm" disabled={reason.trim().length < 3} onClick={() => act(`Priority removed: ${reason}`, { priority: "routine" }, "Priority removed.")}>Remove priority</button>
              : <button className="btn sm" disabled={reason.trim().length < 3} onClick={() => act(`Marked priority: ${reason}`, { priority: "priority" }, `${r.token} moved up as priority.`)}>Mark priority</button>)}
          </div>
          {waiting && <div className="fld" style={{ marginBottom: 10 }}><label>Reason (priority change, Emergency or leaving)</label><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. patient now feels faint; pain 9/10" /></div>}

          {(waiting || inBay) && (
            <div className="fld" style={{ marginBottom: 10 }}><label>Change service queue</label>
              <div style={{ display: "flex", gap: 6 }}>
                <select value={queue} onChange={(e) => setQueue(e.target.value)}>{QUEUES.map((q) => <option key={q}>{q}</option>)}</select>
                <button className="btn sm" disabled={queue === r.queueLabel} onClick={() => act(`Service changed from ${r.queueLabel} to ${queue}`, { queueLabel: queue }, `${r.token} now in ${queue}. Token unchanged.`)}>Change</button>
              </div></div>
          )}

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
            {(waiting || inBay) && <button className="btn sm" style={{ background: "var(--red)", borderColor: "var(--red)", color: "#fff" }} disabled={waiting && reason.trim().length < 3}
              onClick={() => { act(`Sent to Emergency from nursing assessment: ${reason || "nurse judgement"}`, { status: "sent to emergency", priority: "emergency", bay: undefined }, `${r.name} sent to Emergency. Emergency team alerted.`); onClose(); }}>Send to Emergency</button>}
            {waiting && <button className="btn sm" disabled={reason.trim().length < 3} onClick={() => { act(`Left without being seen: ${reason}`, { status: "left without being seen" }, `${r.token} marked left without being seen. A follow-up call is due.`); onClose(); }}>Left without being seen</button>}
            {r.status === "left without being seen" && <button className="btn sm p" onClick={() => { act("Returned — back in the queue", { status: "waiting for assessment", requeuedAt: new Date().toISOString() }, `${r.token} is back in the queue.`); onClose(); }}>Patient returned — re-queue</button>}
            <Link className="btn sm" href={`/clinical/audit?subject=${r.epi}`}>Access report</Link>
          </div>

          <div className="fld"><label>Add a note (visible to the doctor)</label>
            <div style={{ display: "flex", gap: 6 }}>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. relative stepped out, back in 10 min" />
              <button className="btn sm" disabled={!note.trim()} onClick={() => { updateReg(r.id, me.name, `Note: ${note}`, { notes: [...(r.notes ?? []), { at: new Date().toISOString(), by: me.name, text: note }] }); setNote(""); }}>Add</button>
            </div></div>
        </div>
      </div>

      <div className="fsec-h" style={{ marginTop: 14 }}><h4>History</h4></div>
      <div className="chain">
        <div className="ev done">{fmtT(r.at)} · <b>Registered</b> by {r.by} · token {r.token}</div>
        {(r.history ?? []).map((h, i) => <div key={i} className="ev done">{fmtT(h.at)} · {h.text} · {h.by}</div>)}
      </div>
    </Modal>
  );
}

const fmtT = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

// ------------------------------------------------------------------ triage record (read-only)

function RecordModal({ r, onClose, onReopen }: { r: Registration; onClose: () => void; onReopen: () => void }) {
  const t = r.triage!;
  const v = t.vitals;
  return (
    <Modal title={<>Initial nursing assessment · <span className="num">{r.token}</span> · {r.name}</>} onClose={onClose} width={760}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
        <NewsBadge n={t.news} size={50} />
        <div><Pill c={CAT_TONE[t.category]}>{t.category}</Pill> <span className="xs mut">{TARGET[t.category]} · suggested {t.suggested}{t.overrideReason ? ` · note: ${t.overrideReason}` : ""}</span>
          <div className="xs mut" style={{ marginTop: 4 }}>{t.by} · {fmtT(t.at)} · {t.algo}</div></div>
      </div>
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 12 }}>{t.flags.map((x) => <Pill key={x} c={/acute|Sepsis|Severe|Hypogly/.test(x) ? "r" : "a"}>{x}</Pill>)}</div>
      <div className="grid2" style={{ gap: 14 }}>
        <table className="t"><tbody>
          {([["RR", `${v.rr}/min`], ["SpO₂", `${v.spo2}%${v.o2 ? " on O₂" : " air"}`], ["HR", `${v.hr} bpm`], ["BP", `${v.sbp}/${v.dbp} mmHg`], ["Temp", `${v.temp} °C`], ["ACVPU", v.avpu],
            ["Glucose", v.cbg != null ? `${v.cbg} mg/dL` : "—"], ["Pain", `${v.pain}/10`]] as const).map(([k, x]) => <tr key={k}><td className="xs mut">{k}</td><td className="sm num">{x}</td></tr>)}
        </tbody></table>
        <table className="t"><tbody>
          {([["Right foot", `DP ${t.limbs.right.dp} · PT ${t.limbs.right.pt} · ${t.limbs.right.colour}, ${t.limbs.right.temp} · sensation ${t.limbs.right.sensation}`],
            ["Left foot", `DP ${t.limbs.left.dp} · PT ${t.limbs.left.pt} · ${t.limbs.left.colour}, ${t.limbs.left.temp} · sensation ${t.limbs.left.sensation}`],
            ["Capillary refill", t.limbs.crt], ["Rest pain", t.limbs.restPain ? "yes" : "no"],
            ["Wound", t.wound ? `${t.wound.site} · ${t.wound.length}×${t.wound.width}${t.wound.depth ? `×${t.wound.depth}` : ""} cm (${t.wound.area} cm²) · ${t.wound.bed} · exudate ${t.wound.exudate}${t.wound.erythemaCm ? ` · redness ${t.wound.erythemaCm} cm` : ""}${t.wound.probeBone ? " · probe-to-bone +" : ""}` : "none"],
            ["Infection", t.infection]] as const).map(([k, x]) => <tr key={k}><td className="xs mut">{k}</td><td className="sm">{x}</td></tr>)}
        </tbody></table>
      </div>
      {t.actions.length > 0 && <div className="sm" style={{ marginTop: 10 }}><b>Actions done:</b> {t.actions.join("; ")}</div>}
      {t.note && <div className="attest" style={{ marginTop: 10 }}>{t.note}</div>}
      {(r.notes?.length ?? 0) > 0 && <div className="sm" style={{ marginTop: 10 }}><b>Queue notes:</b> {r.notes!.map((n) => n.text).join("; ")}</div>}
      {r.status === "ready for doctor" && <button className="btn sm" style={{ marginTop: 12 }} onClick={onReopen}>Reopen assessment to correct</button>}
    </Modal>
  );
}

// ------------------------------------------------------------------ triage form

function Form({ r, f, set, setF, onDone, onActions }: { r: Registration; f: F; set: <K extends keyof F>(k: K, v: F[K]) => void; setF: (fn: (x: F) => F) => void; onDone: () => void; onActions: () => void }) {
  const me = useMe();
  const diabetic = r.clinical.diabetes !== "No";
  const [tab, setTab] = useState<"vitals" | "limb" | "wound" | "handover">("vitals");
  const [zoom, setZoom] = useState<string | null>(null);
  const photos = r.photos ?? [];
  const zoomed = photos.find((p) => p.id === zoom);

  // ---- vitals & NEWS2
  const v = { rr: num(f.rr), spo2: num(f.spo2), o2: Number(f.o2), hr: num(f.hr), sbp: num(f.sbp), dbp: num(f.dbp), pulse: num(f.pulse || f.hr), temp: num(f.temp) };
  const vitalsIn = [v.rr, v.spo2, v.hr, v.sbp, v.dbp, v.temp].every((x) => !isNaN(x));
  const ns = vitalsIn ? news2({ rr: v.rr, spo2: v.spo2, o2: v.o2, sbp: v.sbp, pulse: v.pulse, temp: v.temp, avpu: f.avpu }) : null;
  const cbg = num(f.cbg);
  const bmi = !isNaN(num(f.weight)) && num(f.height) > 0 ? num(f.weight) / (num(f.height) / 100) ** 2 : NaN;

  // ---- wound & infection (IWGDF/IDSA, simplified)
  const area = f.hasWound && num(f.length) > 0 && num(f.width) > 0 ? num(f.length) * num(f.width) : 0;
  const ery = num(f.erythemaCm) || 0;
  const sirs = [v.temp > 38 || v.temp < 36, v.hr > 90, v.rr > 20].filter(Boolean).length;
  const local = f.hasWound && (ery >= 0.5 || f.exudate === "Purulent" || f.odour);
  const infection: TriageRecord["infection"] = !f.hasWound || !local ? "none" : sirs >= 2 ? "severe" : ery > 2 || f.probeBone || num(f.depth) > 0.5 ? "moderate" : "mild";

  // ---- limb flags
  const absent = (l: LimbF) => ["Absent", "Doppler only"].includes(l.dp) && ["Absent", "Doppler only"].includes(l.pt);
  const acuteLimb = (l: LimbF) => absent(l) && l.temp === "Cold" && ["Pale", "Mottled", "Dusky / blue"].includes(l.colour);
  const sides: [string, LimbF][] = [["Right", f.right], ["Left", f.left]];
  const flags = [
    ...sides.filter(([, l]) => acuteLimb(l)).map(([s]) => `Possible acute limb ischaemia (${s.toLowerCase()})`),
    (f.restPain || (f.hasWound && sides.some(([, l]) => absent(l)))) && sides.some(([, l]) => absent(l) || l.pt === "Weak" || l.dp === "Weak") && "Suspected CLTI (rest pain / tissue loss with poor pulses)",
    ns && ns.total >= 5 && infection !== "none" && "Sepsis screen positive",
    infection === "severe" && "Severe foot infection",
    infection === "moderate" && "Moderate foot infection",
    f.probeBone && "Probe-to-bone positive — osteomyelitis risk",
    !isNaN(cbg) && cbg < 70 && `Hypoglycaemia (${cbg} mg/dL)`,
    !isNaN(cbg) && cbg > 300 && `Hyperglycaemia (${cbg} mg/dL)`,
    diabetic && sides.some(([, l]) => l.sensation !== "Intact") && "Neuropathy — high-risk diabetic foot",
    (r.clinical.mobility !== "Walking unaided" || r.age >= 80) && "Fall risk",
    r.clinical.anticoag && f.hasWound && "Anticoagulated with open wound",
  ].filter(Boolean) as string[];

  // ---- suggested category
  const emergency = (ns && (ns.total >= 7 || v.spo2 <= 91 || v.sbp <= 90)) || f.avpu !== "A" || (!isNaN(cbg) && cbg < 54) || infection === "severe" || sides.some(([, l]) => acuteLimb(l));
  const urgent = (ns && (ns.total >= 5 || ns.three)) || infection === "moderate" || flags.some((x) => x.startsWith("Suspected CLTI")) || (!isNaN(cbg) && (cbg < 70 || cbg > 300)) || f.probeBone;
  const standard = (ns && ns.total >= 1) || f.hasWound || r.priority === "priority" || num(f.pain) >= 7;
  const suggested: TriageRecord["category"] = emergency ? "Emergency" : urgent ? "Urgent" : standard ? "Standard" : "Routine";
  const category = (f.category || suggested) as TriageRecord["category"];
  const overridden = f.category !== "" && f.category !== suggested;

  // ---- nurse actions (context-driven checklist)
  const actionList = [
    !isNaN(cbg) && cbg < 70 && "Hypoglycaemia protocol: 15 g oral glucose, recheck in 15 min",
    flags.includes("Sepsis screen positive") && "Sepsis bundle: lactate, blood cultures before antibiotics, inform doctor now",
    urgent && "Doctor informed directly (urgent category)",
    f.hasWound && "Dressing left open / wound kept exposed for doctor review",
    r.clinical.allergies !== "NKDA" && r.clinical.allergies !== "not recorded" && "Allergy band applied",
    flags.includes("Fall risk") && "Fall-risk band and chair / trolley provided",
    diabetic && "Foot left uncovered; shoes and socks off for foot examination",
  ].filter(Boolean) as string[];

  const missing = [
    !f.idChecked && "identity confirmed",
    !vitalsIn && "vital signs",
    diabetic && isNaN(cbg) && "blood glucose",
    f.pain === "" && "pain score",
    (!f.right.dp || !f.right.pt || !f.left.dp || !f.left.pt) && "pedal pulses",
    f.hasWound && (!(num(f.length) > 0) || !(num(f.width) > 0) || !f.bed) && "wound size and bed",
    overridden && f.overrideReason.trim().length < 4 && "reason for overriding the suggested category",
    !f.attest && "nurse attestation",
  ].filter(Boolean) as string[];

  async function complete(escalate: boolean) {
    const at = nowIso();
    const cat: TriageRecord["category"] = escalate ? "Emergency" : category;
    const rec: TriageRecord = {
      at, by: me.name, idChecked: f.idChecked,
      vitals: { rr: v.rr, spo2: v.spo2, o2: v.o2, hr: v.hr, sbp: v.sbp, dbp: v.dbp, pulse: v.pulse, temp: v.temp, avpu: f.avpu, cbg: isNaN(cbg) ? null : cbg, pain: num(f.pain) || 0, weight: isNaN(num(f.weight)) ? null : num(f.weight), height: isNaN(num(f.height)) ? null : num(f.height) },
      news: ns?.total ?? 0, newsThree: ns?.three ?? false, algo: "NEWS2 · RCP 2017 · SpO₂ scale 1",
      limbs: { right: f.right, left: f.left, crt: f.crt, restPain: f.restPain, claudicationM: f.claudicationM },
      wound: f.hasWound ? { site: f.site, length: num(f.length), width: num(f.width), depth: num(f.depth) || 0, area: +area.toFixed(2), bed: f.bed, exudate: f.exudate, odour: f.odour, erythemaCm: ery, probeBone: f.probeBone, photo: photos.length > 0, photoIds: photos.map((p) => p.id) } : null,
      infection, flags, category: cat, suggested, overrideReason: overridden || escalate ? f.overrideReason || (escalate ? "Escalated by nurse" : undefined) : undefined,
      actions: f.actions, note: f.note,
    };
    const hash = await contentHash(rec);
    setState((s) => ({
      registrations: s.registrations.map((x) => (x.id === r.id ? { ...x, triage: rec, draft: undefined, bay: undefined, status: escalate || cat === "Emergency" ? "sent to emergency" : "ready for doctor", history: [...(x.history ?? []), { at, by: me.name, text: `Initial nursing assessment complete · triage category ${cat}` }] } : x)),
      ledger: [{ id: uid("SO"), at: at.slice(0, 16), kind: "clinical", docType: "obs", doc: `Initial nursing assessment · ${r.token} ${r.name}`, entered: me.name, enteredRole: me.role, centre: r.centre,
        action: "nurse-obs", signer: me.name, attest: SIGN.attest["nurse-obs"], version: 1, amended: false, hash, method: "SSO session + attestation", latencyMin: 0 }, ...s.ledger],
      pending: rec.news >= 5 || rec.newsThree ? [{ id: uid("SO"), kind: "clinical", doc: `Assessment observations · ${r.token} ${r.name}`, docType: "obs", entered: me.name, enteredRole: me.role, at: at.slice(0, 16),
        need: "counter", needFrom: "Duty doctor", priority: "high", why: `NEWS2 ${rec.news}${rec.newsThree ? " with a single parameter scoring 3" : ""} at OPD nursing assessment. Escalation rule A01 fired.`,
        subject: { type: "obs", ref: r.id }, content: JSON.stringify(rec.vitals), version: 1 }, ...s.pending] : s.pending,
    }));
    audit(me.name, "write", `${r.epi} ${r.name}`, `Initial nursing assessment complete · triage category ${cat}${overridden ? ` (override from ${suggested}: ${f.overrideReason})` : ""} · NEWS2 ${rec.news}${flags.length ? " · " + flags.join("; ") : ""}`);
    toast(cat === "Emergency" ? `${r.name} escalated to Emergency. Emergency team alerted.` : `${r.name} assessed: ${cat} — ${TARGET[cat]}. Ready for doctor.`);
    onDone();
  }

  // ---- tabs
  const TABS = [
    { id: "vitals", label: "Vitals", done: vitalsIn && f.pain !== "" && (!diabetic || !isNaN(cbg)) },
    { id: "limb", label: "Foot & limb", done: !!(f.right.dp && f.right.pt && f.left.dp && f.left.pt) },
    { id: "wound", label: `Wound${photos.length ? ` · ${photos.length} photo${photos.length > 1 ? "s" : ""}` : ""}`, done: !f.hasWound || (num(f.length) > 0 && num(f.width) > 0 && !!f.bed) },
    { id: "handover", label: "Handover", done: f.actions.length > 0 || f.note.trim() !== "" },
  ] as const;
  const idx = TABS.findIndex((t) => t.id === tab);
  const nextTab = TABS[idx + 1];

  // ---- compact entry helpers (label left, small box right — as on the ward observation screen)
  const scoreCls = (k: string) => { const p = ns?.p[k]; return p === 3 ? "p3" : p === 2 ? "p2" : p === 1 ? "p1" : ""; };
  const numRow = (label: string, sub: string, k: keyof F, opts?: { req?: boolean; score?: string; warn?: boolean }) => (
    <div className="ob" key={k}>
      <label htmlFor={`t_${k}`}>{label}{opts?.req !== false && <b style={{ color: "var(--red)" }}> *</b>}<span>{sub}</span></label>
      <input id={`t_${k}`} inputMode="decimal" value={f[k] as string} placeholder="—"
        className={opts?.score ? scoreCls(opts.score) : opts?.warn ? "p1" : ""}
        onChange={(e) => set(k, e.target.value.replace(/[^\d.]/g, "").slice(0, 5) as never)} />
    </div>
  );
  const selRow = (label: string, sub: string, value: string, options: readonly (string | readonly [string, string])[], onChange: (v: string) => void, cls = "") => (
    <div className={`ob${options.some((o) => (typeof o === "string" ? o : o[1]).length > 6) ? " wide" : ""}`} key={label}>
      <label>{label}<span>{sub}</span></label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={cls}>
        {options.map((o) => { const [v, l] = typeof o === "string" ? [o, o] : o; return <option key={v} value={v}>{l}</option>; })}
      </select>
    </div>
  );
  const abnormal = (v: string) => ["Absent", "Doppler only", "Weak", "Pale", "Dusky / blue", "Mottled", "Cold", "Reduced", "Yes"].includes(v);
  const limbSel = (sd: "right" | "left", k: keyof LimbF, opts: string[]) => {
    const val = k === "swelling" ? (f[sd].swelling ? "Yes" : "No") : (f[sd][k] as string);
    return (
      <select className={`cmp${abnormal(val) ? " warn" : ""}${val === "" ? " empty" : ""}`} value={val}
        onChange={(e) => setF((x) => ({ ...x, [sd]: { ...x[sd], [k]: k === "swelling" ? e.target.value === "Yes" : e.target.value } }))}>
        {val === "" && <option value="">Select…</option>}
        {opts.map((o) => <option key={o}>{o}</option>)}
      </select>
    );
  };
  const newsCol = ns ? ({ s0: "#12874a", s1: "#4b8fd4", s2: "#b57314", s3: "#d2541a", s4: "#c32b45" } as Record<string, string>)[ns.total >= 7 ? "s4" : ns.total >= 5 ? "s3" : ns.total >= 3 ? "s2" : ns.total >= 1 ? "s1" : "s0"] : "var(--line2)";

  // ---- photos
  async function addPhotos(files: FileList | null) {
    if (!files?.length) return;
    const room = 6 - photos.length;
    if (room <= 0) { toast("Up to 6 photos per visit in the prototype. Remove one first."); return; }
    const added: WoundPhoto[] = [];
    for (const file of Array.from(files).slice(0, room)) {
      if (!file.type.startsWith("image/")) { toast(`${file.name} is not an image.`); continue; }
      try {
        const d = await downscale(file);
        added.push({ id: uid("IMG"), at: nowIso(), by: me.name, site: f.site || r.clinical.woundSite || "wound", ...d, marker: false, source: "camera / upload", note: "" });
      } catch { toast(`${file.name} could not be read.`); }
    }
    if (!added.length) return;
    setState((s) => ({ registrations: s.registrations.map((x) => (x.id === r.id ? { ...x, photos: [...(x.photos ?? []), ...added] } : x)) }));
    if (!storageOk()) toast("Browser storage is full, so these photos will be lost on reload. The production system uploads to server storage.");
    audit(me.name, "write", `${r.epi} ${r.name}`, `${added.length} wound photo${added.length > 1 ? "s" : ""} added at nursing assessment (EXIF stripped, ${added.map((a) => a.kb + " KB").join(", ")})`);
    toast(`${added.length} photo${added.length > 1 ? "s" : ""} added. Tick "marker in frame" if the calibration sticker is visible.`);
  }
  const patchPhoto = (id: string, p: Partial<WoundPhoto>) =>
    setState((s) => ({ registrations: s.registrations.map((x) => (x.id === r.id ? { ...x, photos: (x.photos ?? []).map((q) => (q.id === id ? { ...q, ...p } : q)) } : x)) }));
  const removePhoto = (id: string) => {
    setState((s) => ({ registrations: s.registrations.map((x) => (x.id === r.id ? { ...x, photos: (x.photos ?? []).filter((q) => q.id !== id) } : x)) }));
    audit(me.name, "write", `${r.epi} ${r.name}`, `Wound photo ${id} removed before the assessment was completed`);
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 330px", gap: 14, alignItems: "start" }}>
      <div>
        <div className="phead" style={{ marginBottom: 10 }}>
          <div className="rt" style={{ order: 2 }}>
            <button className="btn sm" onClick={onActions}>Patient actions</button>
            <span className="xs mut">entries save automatically</span>
          </div>
          <div style={{ flex: 1 }}>
            <div className="nm">{r.name} <span className="mut sm">{r.age}{r.ageApprox ? " (approx.)" : ""} y · {r.sex}</span></div>
            <div className="mt">{r.token} · {r.mrn} · {r.queueLabel} · {r.bay} · called {minsSince(r.calledAt)} min ago</div>
            <div className="dx">&ldquo;{r.complaint || "—"}&rdquo;</div>
            {(r.notes?.length ?? 0) > 0 && <div className="sb" style={{ marginTop: 4 }}>Notes: {r.notes!.map((n) => n.text).join(" · ")}</div>}
            <div className="sb" style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 6 }}>
              {r.clinical.diabetes === "Yes" && <Pill>Diabetic{r.clinical.dmYears ? ` ${r.clinical.dmYears}y` : ""}{r.clinical.insulin ? " · insulin" : ""}</Pill>}
              {r.clinical.ckd && <Pill c="a">Kidney disease</Pill>}{r.clinical.dialysis && <Pill c="a">Dialysis</Pill>}
              {r.clinical.prevAmp && <Pill c="a">Previous amputation</Pill>}{r.clinical.prevRevasc && <Pill>Previous angioplasty / bypass</Pill>}
              {r.clinical.anticoag && <Pill c="a">Blood thinners</Pill>}{r.clinical.smoking === "Current" && <Pill c="a">Current smoker</Pill>}
              {r.clinical.allergies !== "NKDA" && <Pill c="r">Allergy: {r.clinical.allergies}</Pill>}
              <Pill>{r.clinical.mobility}</Pill><Pill>{r.language}</Pill>
            </div>
            <label className="check" style={{ marginTop: 8, padding: "6px 10px", borderRadius: 6, background: f.idChecked ? "var(--green-s)" : "var(--amber-s)", display: "inline-flex" }}>
              <input type="checkbox" checked={f.idChecked} onChange={(e) => set("idChecked", e.target.checked)} />
              <span>Identity confirmed — name and age/DOB match wristband <b>{r.mrn}</b></span>
            </label>
          </div>
        </div>

        <div className="card mb14">
          <div className="tabs" role="tablist" style={{ padding: "0 12px", marginBottom: 0 }}>
            {TABS.map((t) => (
              <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? "on" : ""} onClick={() => setTab(t.id)}>
                <span style={{ color: t.done ? "var(--green)" : "var(--ink4)", marginRight: 5 }}>{t.done ? "✓" : "○"}</span>{t.label}
              </button>
            ))}
          </div>
          <div className="card-b">
            {tab === "vitals" && (
              <>
                <div className="grid2" style={{ gap: "0 28px" }}>
                  <div>
                    {numRow("Respiratory rate", "breaths/min", "rr", { score: "rr" })}
                    {numRow("SpO₂", "%", "spo2", { score: "spo2" })}
                    {selRow("On oxygen", "air or supplemental", f.o2, [["0", "Air"], ["1", "O₂"]] as const, (x) => set("o2", x), f.o2 === "1" ? "p2" : "")}
                    {numRow("Heart rate", "beats/min", "hr", { score: "pulse" })}
                    {numRow("Systolic BP", "mmHg", "sbp", { score: "sbp" })}
                    {numRow("Diastolic BP", "mmHg", "dbp")}
                  </div>
                  <div>
                    {numRow("Temperature", "°C", "temp", { score: "temp" })}
                    {selRow("Consciousness", "ACVPU", f.avpu, ["A", "C", "V", "P", "U"], (x) => set("avpu", x), f.avpu !== "A" ? "p3" : "")}
                    {numRow("Blood glucose", diabetic ? "mg/dL · required (diabetic)" : "mg/dL", "cbg", { req: diabetic, warn: !isNaN(cbg) && (cbg < 70 || cbg > 300) })}
                    {numRow("Pain score", "0 – 10", "pain", { warn: num(f.pain) >= 7 })}
                    {numRow("Weight", "kg", "weight", { req: false })}
                    {numRow("Height", "cm", "height", { req: false })}
                  </div>
                </div>
                <div className="live" style={{ background: newsCol, color: ns ? "#fff" : "var(--ink2)", marginBottom: 0 }}>
                  <div className="k">NEWS2 — calculated as you type</div>
                  <div className="v">{ns ? ns.total : "–"}</div>
                  <div className="a">{ns ? newsBand(ns.total)[1] : "Enter RR, SpO₂, heart rate, BP and temperature"}{ns?.three && <><br /><b>One parameter scores 3 — escalates on its own.</b></>}
                    {!isNaN(bmi) && <span style={{ float: "right", opacity: 0.85 }}>BMI {bmi.toFixed(1)}</span>}</div>
                </div>
              </>
            )}

            {tab === "limb" && (
              <>
                <table className="t cmp-t">
                  <thead><tr><th style={{ width: "34%" }}>Both feet · shoes and socks off</th><th>Right</th><th>Left</th></tr></thead>
                  <tbody>
                    {([["Dorsalis pedis pulse", "dp", PULSES], ["Posterior tibial pulse", "pt", PULSES], ["Colour", "colour", COLOURS], ["Temperature", "temp", TEMPS],
                      ["Sensation", "sensation", SENSATION], ["Swelling", "swelling", ["No", "Yes"]]] as const).map(([l, k, o]) => (
                      <tr key={k}><td className="sm">{l}{(k === "dp" || k === "pt") && <b style={{ color: "var(--red)" }}> *</b>}{k === "sensation" && <div className="xs mut">10 g monofilament</div>}</td>
                        <td>{limbSel("right", k, [...o])}</td><td>{limbSel("left", k, [...o])}</td></tr>
                    ))}
                  </tbody>
                </table>
                <div className="grid2" style={{ gap: "0 28px", marginTop: 12 }}>
                  <div>{selRow("Capillary refill", "big toe", f.crt, ["< 2 s", "2–4 s", "> 4 s"], (x) => set("crt", x), f.crt === "> 4 s" ? "p2" : f.crt === "2–4 s" ? "p1" : "")}
                    {selRow("Pain at rest / night", "better hanging leg down?", f.restPain ? "Yes" : "No", ["No", "Yes"], (x) => set("restPain", x === "Yes"), f.restPain ? "p2" : "")}</div>
                  <div className="ob"><label>Walks before leg pain<span>distance</span></label><input value={f.claudicationM} onChange={(e) => set("claudicationM", e.target.value)} placeholder="e.g. 100 m" style={{ fontFamily: "var(--f)", fontWeight: 500, fontSize: 12 }} /></div>
                </div>
              </>
            )}

            {tab === "wound" && (
              <>
                <div className="seg" style={{ marginBottom: 12 }}>
                  <button className={f.hasWound ? "on" : ""} onClick={() => set("hasWound", true)}>Wound present</button>
                  <button className={!f.hasWound ? "on" : ""} onClick={() => set("hasWound", false)}>No open wound</button>
                </div>
                {f.hasWound && (
                  <>
                    <div className="ob" style={{ gridTemplateColumns: "1fr 2fr" }}><label>Site<span>side and location</span></label>
                      <input value={f.site} onChange={(e) => set("site", e.target.value)} placeholder="e.g. Right great toe, plantar" style={{ fontFamily: "var(--f)", fontWeight: 500, fontSize: 13, textAlign: "left" }} /></div>
                    <div className="grid2" style={{ gap: "0 28px" }}>
                      <div>
                        {numRow("Length", "cm, head-to-toe", "length")}
                        {numRow("Width", "cm, side-to-side", "width")}
                        {numRow("Depth", "cm, if measurable", "depth", { req: false })}
                        <div className="ob"><label>Area<span>length × width</span></label><div className="num" style={{ textAlign: "center", fontWeight: 700 }}>{area > 0 ? `${area.toFixed(2)} cm²` : "—"}</div></div>
                      </div>
                      <div>
                        {selRow("Wound bed", "dominant tissue *", f.bed, [["", "Select…"], ...BEDS.map((b) => [b, b] as const)], (x) => set("bed", x), /Necrotic|eschar/i.test(f.bed) ? "p2" : f.bed.startsWith("Slough") ? "p1" : "")}
                        {selRow("Exudate", "amount / type", f.exudate, EXUDATE, (x) => set("exudate", x), f.exudate === "Purulent" ? "p3" : f.exudate === "Heavy" ? "p1" : "")}
                        {numRow("Redness", "cm from wound edge", "erythemaCm", { req: false, warn: ery > 2 })}
                        {selRow("Foul odour", "after cleaning", f.odour ? "Yes" : "No", ["No", "Yes"], (x) => set("odour", x === "Yes"), f.odour ? "p1" : "")}
                        {selRow("Probe to bone", "sterile probe", f.probeBone ? "Yes" : "No", ["No", "Yes"], (x) => set("probeBone", x === "Yes"), f.probeBone ? "p2" : "")}
                      </div>
                    </div>
                  </>
                )}

                <div className="fsec-h" style={{ marginTop: 14 }}>
                  <h4>Wound photographs</h4>
                  <Pill c={r.consent.photo === "care-only" ? "a" : "v"}>consent: {r.consent.photo}</Pill>
                  <span className="xs mut" style={{ marginLeft: "auto" }}>{photos.length}/6 · resized in the browser, location data removed</span>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                  <label className="btn p" style={{ cursor: "pointer" }}>📷 Take photo
                    <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => { addPhotos(e.target.files); e.target.value = ""; }} />
                  </label>
                  <label className="btn" style={{ cursor: "pointer" }}>⤒ Upload from device
                    <input type="file" accept="image/*" multiple className="sr-only" aria-label="Upload wound photos" onChange={(e) => { addPhotos(e.target.files); e.target.value = ""; }} />
                  </label>
                  <span className="xs mut" style={{ alignSelf: "center" }}>Place the calibration sticker next to the wound, 30 cm away, perpendicular, flash off.</span>
                </div>
                {photos.length === 0 ? <div className="sm mut">No photos yet.</div> : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 10 }}>
                    {photos.map((p) => (
                      <div key={p.id} style={{ border: `1px solid ${p.marker ? "var(--line)" : "var(--amber)"}`, borderRadius: 8, overflow: "hidden", background: "#fff" }}>
                        <button onClick={() => setZoom(p.id)} style={{ padding: 0, border: 0, display: "block", width: "100%", background: "#000" }} aria-label="Enlarge photo">
                          {/* eslint-disable-next-line @next/next/no-img-element -- local data URL */}
                          <img src={p.dataUrl} alt={`Wound photo ${p.site}`} style={{ width: "100%", height: 110, objectFit: "cover", display: "block" }} />
                        </button>
                        <div style={{ padding: "6px 8px" }}>
                          <div className="xs mut">{new Date(p.at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} · {p.kb} KB</div>
                          <label className="check" style={{ fontSize: 11, padding: "2px 0" }}><input type="checkbox" checked={p.marker} onChange={(e) => patchPhoto(p.id, { marker: e.target.checked })} /> marker in frame</label>
                          {!p.marker && <div className="xs" style={{ color: "var(--amber)" }}>no measurement without marker</div>}
                          <button className="btn sm" style={{ marginTop: 4, width: "100%" }} onClick={() => removePhoto(p.id)}>Remove</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {tab === "handover" && (
              <>
                <div className="fsec-h"><h4>Nurse actions</h4><span className="xs mut">generated from the findings</span></div>
                {actionList.length === 0 && <div className="sm mut">No specific actions suggested.</div>}
                {actionList.map((a) => (
                  <label key={a} className="check"><input type="checkbox" checked={f.actions.includes(a)} onChange={(e) => set("actions", e.target.checked ? [...f.actions, a] : f.actions.filter((x) => x !== a))} /> {a}</label>
                ))}
                <div className="fld" style={{ marginTop: 12 }}><label>Note for the doctor</label>
                  <textarea value={f.note} onChange={(e) => set("note", e.target.value)} placeholder="Anything the numbers do not capture — e.g. patient anxious about amputation, walked in with slipper on wounded foot" /></div>
              </>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14 }}>
              <button className="btn sm" disabled={idx === 0} onClick={() => setTab(TABS[idx - 1].id)}>← Back</button>
              {nextTab ? <button className="btn sm p" onClick={() => setTab(nextTab.id)}>Next: {nextTab.label.split(" · ")[0]} →</button> : <span className="xs mut">Complete from the summary on the right →</span>}
            </div>
          </div>
        </div>
      </div>

      {/* summary */}
      <div className="sticky-side">
        <Card title="Assessment summary" bodyClass="card-b">
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
            {ns ? <NewsBadge n={ns.total} size={54} /> : <div className="news s0" style={{ width: 54, height: 54, background: "var(--line2)" }}>–<small>NEWS2</small></div>}
            <div className="xs" style={{ color: "var(--ink2)" }}>{ns ? <>{newsBand(ns.total)[1]}{ns.three && <><br /><b style={{ color: "var(--red)" }}>One parameter scores 3</b></>}</> : "Enter vital signs to score"}</div>
          </div>
          {!isNaN(cbg) && <div className="sm" style={{ marginBottom: 6 }}>Glucose <b style={{ color: cbg < 70 || cbg > 300 ? "var(--red)" : undefined }}>{cbg} mg/dL</b></div>}
          {f.hasWound && <div className="sm" style={{ marginBottom: 6 }}>Infection (IWGDF): <Pill c={infection === "severe" ? "r" : infection === "moderate" ? "o" : infection === "mild" ? "a" : "g"}>{infection}</Pill>{photos.length > 0 && <span className="xs mut"> · {photos.length} photo{photos.length > 1 ? "s" : ""}</span>}</div>}
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", margin: "8px 0 12px" }}>
            {flags.length ? flags.map((x) => <Pill key={x} c={/acute|Sepsis|Severe|Hypogly/.test(x) ? "r" : "a"}>{x}</Pill>) : <span className="xs mut">No flags so far.</span>}
          </div>

          <div className="fsec-h" style={{ marginBottom: 8 }}><h4>Triage category</h4></div>
          <div className="xs mut" style={{ marginBottom: 6 }}>Suggested: <Pill c={CAT_TONE[suggested]}>{suggested}</Pill> · {TARGET[suggested]}</div>
          <div className="chipset" style={{ marginBottom: 8 }}>
            {(["Emergency", "Urgent", "Standard", "Routine"] as const).map((c) => (
              <button key={c} className={category === c ? (c === "Emergency" ? "on red" : "on") : ""} onClick={() => set("category", c === suggested ? "" : c)}>{c}</button>
            ))}
          </div>
          {overridden && <div className="fld" style={{ marginBottom: 8 }}><label className="req-l">Reason for changing the suggestion</label><input value={f.overrideReason} onChange={(e) => set("overrideReason", e.target.value)} placeholder="Clinical judgement…" /></div>}

          <label className="check" style={{ margin: "8px 0" }}><input type="checkbox" checked={f.attest} onChange={(e) => set("attest", e.target.checked)} /> <span className="xs">{SIGN.attest["nurse-obs"]}</span></label>

          {category === "Emergency" ? (
            <button className="btn" style={{ width: "100%", padding: 11, background: "var(--red)", borderColor: "var(--red)", color: "#fff" }} disabled={!f.idChecked || !f.attest} onClick={() => complete(true)}>Escalate to Emergency now</button>
          ) : (
            <button className="btn p" style={{ width: "100%", padding: 11 }} disabled={missing.length > 0} onClick={() => complete(false)}>Complete assessment → ready for doctor</button>
          )}
          {category !== "Emergency" && missing.length > 0 && <div className="xs mut" style={{ marginTop: 6 }}>Still needed: {missing.join(", ")}.</div>}
          {category === "Emergency" && <div className="xs" style={{ marginTop: 6, color: "var(--red)" }}>Do not wait to finish the form — escalate, and continue observations in Emergency.</div>}
          {category !== "Emergency" && <button className="btn sm" style={{ width: "100%", marginTop: 8 }} onClick={() => complete(true)} disabled={!f.idChecked || !f.attest}>Escalate to Emergency instead</button>}
        </Card>
      </div>

      {zoomed && (
        <Modal title={`Wound photo · ${zoomed.site} · ${new Date(zoomed.at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}`} onClose={() => setZoom(null)} width={900}>
          {/* eslint-disable-next-line @next/next/no-img-element -- local data URL */}
          <img src={zoomed.dataUrl} alt="Wound photo enlarged" style={{ width: "100%", maxHeight: "65vh", objectFit: "contain", background: "#000", borderRadius: 6 }} />
          <div className="xs mut" style={{ marginTop: 8 }}>{zoomed.w}×{zoomed.h}px · {zoomed.kb} KB · taken by {zoomed.by} · {zoomed.marker ? "calibration marker in frame" : "no calibration marker — not measurable"}</div>
          <div className="fld" style={{ marginTop: 10 }}><label>Caption / note</label>
            <input value={zoomed.note} onChange={(e) => patchPhoto(zoomed.id, { note: e.target.value })} placeholder="e.g. after cleaning, before debridement" /></div>
        </Modal>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ demo arrivals

export function demoArrivals(centre: string, by: string): Registration[] {
  const base = Date.now();
  const mk = (i: number, o: Partial<Registration> & { name: string; age: number; sex: string; visit: string; queue: string; queueLabel: string; complaint: string }, c: Partial<Registration["clinical"]>): Registration => ({
    id: uid("REG"), epi: `EPI-079${1000 + i}`, mrn: `${centre}-7${String(40000 + i * 137).slice(0, 5)}`, token: `${o.queue}-9${i}`, priority: "routine",
    at: new Date(base - (40 - i * 9) * 60000).toISOString(), by, centre, returning: i % 2 === 0, emergencyQuick: false, ageApprox: false,
    phone: "98765 0000" + i, phoneVerified: true, language: ["Tamil", "Telugu", "Tamil", "Hindi"][i], area: "", city: "Chennai", state: "Tamil Nadu", pin: "600017",
    idSeen: "Voter ID", arrival: "Walk-in", redFlags: [], scheme: "Ayushman Bharat PM-JAY", schemeId: "PMJAY-DEMO",
    consent: { care: true, share: true, research: false, photo: "care+research" }, status: "waiting for assessment",
    clinical: { diabetes: "Yes", dmYears: "10", insulin: false, ckd: false, dialysis: false, prevAmp: false, prevRevasc: false, anticoag: false, smoking: "Never", allergies: "NKDA", woundSite: "", woundWeeks: "", mobility: "Walking unaided", ...c },
    ...o,
  });
  return [
    mk(0, { name: "Selvi Ramasamy", age: 62, sex: "Female", visit: "dfoot", queue: "D", queueLabel: "Diabetic foot clinic", complaint: "Foot ulcer", priority: "routine" }, { dmYears: "15", insulin: true, woundSite: "Right foot", woundWeeks: "6" }),
    mk(1, { name: "Venkatesh Rao", age: 71, sex: "Male", visit: "vascular", queue: "V", queueLabel: "Vascular OPD", complaint: "Pain at rest / at night", priority: "priority" }, { smoking: "Current", prevRevasc: true, anticoag: true, woundSite: "Left toe(s)", woundWeeks: "3" }),
    mk(2, { name: "Abdul Kareem", age: 55, sex: "Male", visit: "wound", queue: "W", queueLabel: "Wound clinic", complaint: "Wound not healing" }, { diabetes: "No", allergies: "Sulfa drugs", woundSite: "Left leg", woundWeeks: "10" }),
    mk(3, { name: "Meenakshi Sundar", age: 81, sex: "Female", visit: "review", queue: "R", queueLabel: "Follow-up / dressing", complaint: "Dressing change", priority: "priority" }, { dmYears: "22", dialysis: true, ckd: true, prevAmp: true, woundSite: "Right heel", woundWeeks: "14", mobility: "Wheelchair" }),
  ];
}
