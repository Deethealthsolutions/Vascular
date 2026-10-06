"use client";

// Step 3 of the patient journey: the doctor calls the next patient from "Ready for doctor"
// (ordered by triage category and time against target), reviews the nursing assessment, takes
// the history, examines (pulses, ABI/TBI, IWGDF diabetic foot exam), assesses every wound
// (size, bed, depth, IWGDF/IDSA infection, Wagner, UT, per-limb WIfI), records treatment given
// today (debridement, dressings, offloading), diagnoses and orders, reconciles medicines
// (kidney dosing, antibiotic stewardship, best medical therapy), documents the discussion and
// procedure consent, then signs. Tabs: Tabs.tsx · state: model.ts · rules: lib/cx/consult.ts.

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { Guard, Top, useMe } from "@/components/cx/Shell";
import { Card, Kpis, Modal, NewsBadge, Pill, toast } from "@/components/cx/ui";
import { SIGN } from "@/lib/cx/data";
import { ABX, DX, RISK, abiBand, alerts, num, renalAlerts, suggestOrders, treatmentAlerts, type Alert } from "@/lib/cx/consult";
import { currentLocation, hereRegs, placeAt } from "@/lib/cx/locations";
import { audit, contentHash, setState, uid, updateReg, useStore, type ConsultRecord, type Limb, type Registration, type TriageRecord } from "@/lib/cx/store";
import type { Staff } from "@/lib/cx/users";
import { blank, derive, fromDraft, type C, type WoundF } from "./model";
import { ConsentTab, ExamTab, HistoryTab, MedsTab, OrdersTab, TreatmentTab, WoundsTab, type TabProps } from "./Tabs";

const ROOMS = ["Consult room 1", "Consult room 2", "Consult room 3"];
const TARGET_MIN: Record<string, number> = { Emergency: 0, Urgent: 15, Standard: 60, Routine: 120 };
const CAT_RANK: Record<string, number> = { Emergency: 0, Urgent: 1, Standard: 2, Routine: 3 };
const CAT_TONE: Record<string, string> = { Emergency: "r", Urgent: "o", Standard: "a", Routine: "g" };
const DEMO_PIN = "1234";
const INSTRUCTIONS = [
  "Keep weight off the foot — use the offloading device at all times",
  "Check both feet daily; come back if redness, swelling, fever or new pain",
  "Keep the dressing dry and intact until the next visit",
  "Blood glucose log twice daily, bring it to the next visit",
  "Stop smoking — cessation service offered",
  "Raise the leg above heart level when resting",
  "Come back immediately if the foot turns cold, pale or very painful",
];
const DISPOSITIONS: { id: string; label: string; status: Registration["status"]; tone: string }[] = [
  { id: "checkout", label: "Home · checkout & follow-up", status: "to checkout", tone: "g" },
  { id: "procedure", label: "Dressing room / procedure today", status: "for procedure", tone: "b" },
  { id: "admit", label: "Admit to ward", status: "awaiting admission", tone: "o" },
  { id: "emergency", label: "Emergency department", status: "sent to emergency", tone: "r" },
];
const FOLLOW = ["3 days", "1 week", "2 weeks", "4 weeks", "After test results"];

const minsSince = (at?: string) => (at ? Math.max(0, Math.round((Date.now() - Date.parse(at)) / 60000)) : 0);
const nowIso = () => new Date().toISOString();
/** Minutes past a target time (negative = still due). */
const lateMin = (dueMs: number) => Math.round((Date.now() - dueMs) / 60000);
const clock = (at?: string) => (at ? new Date(at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—");

export function Consult() {
  return (
    <Guard screen="consult">
      <Top title="Doctor consultation" sub="Step 3 · nursing assessment → history → examination → every wound → treatment today → diagnosis and orders → medicines → discussion and consent → plan and sign" />
      <div className="wrap"><Body /></div>
    </Guard>
  );
}

function saveDraft(id: string, c: C) {
  setState((s) => ({ registrations: s.registrations.map((y) => (y.id === id && (y.status === "with doctor" || y.status === "at tests") ? { ...y, consultDraft: c as unknown as Record<string, unknown> } : y)) }));
}

function Body() {
  const me = useMe();
  const st = useStore();
  const [sel, setSel] = useState<string | null>(null);
  const [c, setC] = useState<C | null>(null);
  const [record, setRecord] = useState<string | null>(null);

  const here = currentLocation(st, me);
  const regs = hereRegs(st, me);
  const due = (r: Registration) => Date.parse(r.triage?.at ?? r.at) + (TARGET_MIN[r.triage?.category ?? "Routine"] ?? 120) * 60000;
  const ready = regs.filter((r) => r.status === "ready for doctor" && r.triage)
    .sort((a, b) => CAT_RANK[a.triage!.category] - CAT_RANK[b.triage!.category] || due(a) - due(b));
  const withDoc = regs.filter((r) => r.status === "with doctor");
  const atTests = regs.filter((r) => r.status === "at tests");
  const seen = regs.filter((r) => r.consult && r.status !== "with doctor" && r.status !== "at tests").sort((a, b) => b.consult!.at.localeCompare(a.consult!.at));
  const occupant = (room: string) => withDoc.find((x) => x.room === room);
  const myRoom = ROOMS.find((rm) => !occupant(rm));
  const r = regs.find((x) => x.id === sel && x.status === "with doctor") ?? null;
  const over = ready.filter((x) => lateMin(due(x)) > 0);

  useEffect(() => {
    if (!sel || !c) return;
    const t = setTimeout(() => saveDraft(sel, c), 250);
    return () => clearTimeout(t);
  }, [sel, c]);

  function open(x: Registration) {
    if (sel && c && sel !== x.id) saveDraft(sel, c);
    setSel(x.id);
    setC(x.consultDraft ? fromDraft(x, x.consultDraft) : blank(x));
    setTimeout(() => document.getElementById("consult-form")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  function call(x: Registration, room?: string) {
    const rm = room ?? myRoom;
    if (!rm) { toast("All consult rooms are occupied. Finish or send a patient to tests first."); return; }
    updateReg(x.id, me.name, `Called to ${rm} by ${me.name}${x.backFromTests ? " (back from tests)" : ""}`, { status: "with doctor", room: rm, doctor: me.name, seenAt: x.seenAt ?? nowIso() });
    audit(me.name, "read", `${x.epi} ${x.name}`, `Consultation started in ${rm} · nursing assessment opened`);
    toast(`Announcement: token ${x.token}, ${x.name.split(" ")[0]}, please come to ${rm}.`);
    open({ ...x, room: rm });
  }

  function backFromTests(x: Registration) {
    updateReg(x.id, me.name, "Back from tests — waiting to see the doctor again", { status: "ready for doctor", backFromTests: true, room: undefined });
    toast(`${x.token} is back in the doctor queue.`);
  }

  function seedDemo() {
    setState((s) => ({ registrations: [...placeAt(demoAssessed(here.centre), here.id), ...s.registrations] }));
    toast("Three assessed patients added to Ready for doctor.");
  }

  const rec = regs.find((x) => x.id === record);

  return (
    <>
      <Kpis cols={5} items={[
        { k: "Ready for doctor", v: ready.length, d: "nursing assessment complete", tone: ready.length > 5 ? "warn" : "" },
        { k: "Over target", v: over.length, d: "Urgent 15 min · Standard 60 · Routine 120", tone: over.length ? "bad" : "" },
        { k: "In consultation", v: `${withDoc.length} / ${ROOMS.length}`, d: "consult rooms in use" },
        { k: "At tests", v: atTests.length, d: "to be seen again today" },
        { k: "Seen", v: seen.length, d: `${seen.filter((x) => x.consult!.countersign === "awaiting consultant").length} awaiting countersignature` },
      ]} />

      <Card title="Consult rooms" hint="one patient per room" className="mb14">
        <div className="zgrid" style={{ gridTemplateColumns: `repeat(${ROOMS.length},minmax(0,1fr))` }}>
          {ROOMS.map((rm) => {
            const o = occupant(rm);
            return (
              <div key={rm} className={`zc${o && o.id === sel ? " on" : ""}`} style={{ cursor: "default", minHeight: 128, display: "flex", flexDirection: "column" }}>
                <div className="h"><span className="n">{rm}</span>{o ? <Pill c="b">{minsSince(o.seenAt)} min</Pill> : <Pill c="g">free</Pill>}</div>
                {o ? (
                  <>
                    <div style={{ marginTop: 8 }}><span className="num" style={{ font: "700 16px/1 var(--fm)" }}>{o.token}</span> <b className="sm">{o.name}</b></div>
                    <div className="xs mut" style={{ marginTop: 2 }}>{o.doctor} · {o.triage && <Pill c={CAT_TONE[o.triage.category]}>{o.triage.category}</Pill>}</div>
                    <div style={{ display: "flex", gap: 5, marginTop: "auto", paddingTop: 8 }}>
                      <button className="btn sm p" onClick={() => open(o)}>{o.id === sel ? "Open now" : "Open"}</button>
                      <button className="btn sm" onClick={() => { updateReg(o.id, me.name, `Returned to the doctor queue from ${rm}`, { status: "ready for doctor", room: undefined }); if (sel === o.id) setSel(null); }}>Back to queue</button>
                    </div>
                  </>
                ) : (
                  <div style={{ marginTop: "auto" }}>
                    {ready[0] ? <button className="btn sm p" style={{ width: "100%" }} onClick={() => call(ready[0], rm)}>Call next · {ready[0].token}</button> : <div className="xs mut">Nobody waiting.</div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <Card title="Ready for doctor" hint="triage category first, then time against target" className="mb14"
        right={<><Link className="btn sm" href="/clinical/triage">Nursing assessment</Link>{ready.length === 0 && <button className="btn sm v" onClick={seedDemo}>Load demo patients</button>}</>}>
        {ready.length === 0 ? <div className="sm mut">Nobody is waiting for a doctor. Complete a nursing assessment{regs.length === 0 ? ", or load demo patients" : ""}.</div> : (
          <table className="t">
            <thead><tr><th>Token</th><th>Patient</th><th>Category</th><th>Target</th><th>NEWS2</th><th>Nurse flags</th><th /></tr></thead>
            <tbody>
              {ready.map((x) => {
                const late = lateMin(due(x));
                return (
                  <tr key={x.id}>
                    <td className="num"><b>{x.token}</b></td>
                    <td className="sm"><b>{x.name}</b> <span className="xs mut">{x.age}{x.sex[0]}</span><div className="xs mut">{x.queueLabel}{x.backFromTests && <> · <Pill c="v">back from tests</Pill></>}</div></td>
                    <td><Pill c={CAT_TONE[x.triage!.category]}>{x.triage!.category}</Pill></td>
                    <td className="xs" style={{ color: late > 0 ? "var(--red)" : "var(--ink2)", fontWeight: late > 0 ? 700 : 400 }}>{late > 0 ? `${late} min over` : `due in ${-late} min`}</td>
                    <td><NewsBadge n={x.triage!.news} size={28} /></td>
                    <td className="xs mut">{x.triage!.flags.slice(0, 2).join(" · ") || "none"}</td>
                    <td style={{ textAlign: "right" }}><button className="btn sm p" disabled={!myRoom} onClick={() => call(x)}>{myRoom ? `Call to ${myRoom.replace("Consult ", "")}` : "No free room"}</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      <div id="consult-form" style={{ scrollMarginTop: 80 }}>
        {r && c ? <Form key={r.id} r={r} c={c} setC={setC} me={me} onDone={() => setSel(null)} /> : (
          <Card className="mb14"><div className="sm mut">Call a patient to a consult room, or open one from a room, to start the consultation.</div></Card>
        )}
      </div>

      <div className="grid2">
        <Card title="At tests" hint="orders placed · patient will be seen again" right={<Pill c="v">{atTests.length}</Pill>}>
          {atTests.length === 0 ? <div className="sm mut">None.</div> : (
            <table className="t"><tbody>
              {atTests.map((x) => (
                <tr key={x.id}><td className="num sm" style={{ whiteSpace: "nowrap" }}><b>{x.token}</b></td><td className="sm"><b>{x.name}</b><div className="xs mut">{((x.consultDraft as unknown as C | undefined)?.orders ?? []).join(", ") || "tests"}</div></td>
                  <td className="xs mut" style={{ whiteSpace: "nowrap" }}>{minsSince(x.testsAt)} min</td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}><button className="btn sm" onClick={() => backFromTests(x)}>Results back</button></td></tr>
              ))}
            </tbody></table>
          )}
        </Card>
        <Card title="Seen today" hint="click a row for the consultation record" right={<Pill c="g">{seen.length}</Pill>}>
          {seen.length === 0 ? <div className="sm mut">None yet.</div> : (
            <table className="t"><tbody>
              {seen.map((x) => (
                <tr key={x.id} className="clk" onClick={() => setRecord(x.id)}>
                  <td className="num sm" style={{ whiteSpace: "nowrap" }}><b>{x.token}</b></td>
                  <td className="sm"><b>{x.name}</b><div className="xs mut">{x.consult!.diagnoses.map((d) => d.label).slice(0, 2).join(" · ")}</div></td>
                  <td><Pill c={DISPOSITIONS.find((d) => d.status === x.status)?.tone ?? "n"}>{x.status}</Pill>
                    {x.consult!.countersign === "awaiting consultant" && <div className="xs" style={{ color: "var(--amber)", marginTop: 3 }}>awaiting countersignature</div>}</td>
                </tr>
              ))}
            </tbody></table>
          )}
        </Card>
      </div>

      {rec && rec.consult && <RecordModal r={rec} onClose={() => setRecord(null)} />}
    </>
  );
}

// ------------------------------------------------------------------ consultation form

type TabId = "nursing" | "history" | "exam" | "wounds" | "treatment" | "orders" | "meds" | "consent" | "plan";

function Form({ r, c, setC, me, onDone }: { r: Registration; c: C; setC: (fn: (x: C | null) => C | null) => void; me: Staff; onDone: () => void }) {
  const [tab, setTab] = useState<TabId>("nursing");
  const [pin, setPin] = useState("");
  const [zoom, setZoom] = useState<string | null>(null);
  const set = <K extends keyof C>(k: K, v: C[K]) => setC((x) => (x ? { ...x, [k]: v } : x));
  const upd = (fn: (x: C) => C) => setC((x) => (x ? fn(x) : x));

  const d = derive(r, c);
  const t = d.t, cl = d.cl;
  const photos = r.photos ?? [];
  const hasWound = c.wounds.length > 0;
  const sideName = d.worst.side;
  const iMax = d.maxI < 0 ? null : d.maxI;
  const abiAff = d.abiBy[sideName];
  const venous = !d.diabetic && d.wounds.some((x) => x.w.location === "Ankle / leg" && (d.ischBy[x.w.side].grade ?? 0) === 0);
  const neuropathic = d.diabetic && hasWound && (iMax ?? 0) === 0;

  const sugDx = [
    d.diabetic && hasWound && ((iMax ?? 0) >= 1 ? "dfu-ni" : "dfu-n"),
    d.clti && "clti",
    !d.clti && (iMax ?? 0) >= 1 && t.limbs.claudicationM && "pad",
    d.gangreneDigits && "gangrene",
    d.maxFi >= 1 && (d.diabetic ? "dfi" : "cell"),
    (d.anyBone || d.wounds.some((x) => x.inf.osteo)) && "osteo",
    venous && "vlu",
    d.wounds.some((x) => x.w.location === "Heel") && /Wheelchair|Bed/i.test(cl.mobility) && "pu",
    (c.foot.right.deformity.includes("Charcot deformity") || c.foot.left.deformity.includes("Charcot deformity")) && "charcot",
  ].filter(Boolean) as string[];
  const sugOrders = suggestOrders({ diabetic: d.diabetic, probeBone: d.anyBone, iGrade: iMax, clti: d.clti, fi: d.maxFi, wagner: d.maxWag, venous, abiAffected: abiAff, neuropathic, abiMissing: d.abiMissing })
    .filter((o) => !c.orders.includes(o));

  const al: Alert[] = [
    ...alerts({ allergies: c.allergies, anticoag: cl.anticoag, ckd: cl.ckd, dialysis: cl.dialysis, orders: c.orders, rx: c.rx, abiAffected: abiAff, iGrade: iMax, fi: d.maxFi, wagner: d.maxWag }),
    ...renalAlerts(c.rx, num(c.egfr), cl.ckd, cl.dialysis),
    ...treatmentAlerts({
      wounds: d.wounds.map((x) => ({ n: x.n, plantar: x.plantar, necrotic: x.necrotic, exudate: x.w.exudate, fi: x.inf.fi, side: x.w.side, debrided: x.w.debride, primary: x.w.primary, secondary: x.w.secondary })),
      iBySide: { right: d.ischBy.right.grade, left: d.ischBy.left.grade }, abiBySide: d.abiBy, offload: c.offload, diabetic: d.diabetic,
    }),
  ];
  const blocks = al.filter((a) => a.level === "block");
  const unresolved = blocks.filter((a) => (c.overrides[a.id] ?? "").trim().length < 4);
  const disp = DISPOSITIONS.find((x) => x.id === c.disposition);
  const abxRx = c.rx.filter((x) => ABX.test(x.drug));
  const procedures = c.wounds.some((w) => w.debride);
  const needAmpTalk = d.clti || d.involved.some((l) => (l.stage ?? 0) >= 4);
  const needDecision = needAmpTalk;

  // What is still needed before signing, grouped by the tab that holds it.
  const need: [TabId, string | false | 0 | undefined][] = [
    ["history", c.hpi.trim().length < 3 && "history of presenting complaint"],
    ["exam", (!c.pulses.dp.r || !c.pulses.dp.l || !c.pulses.pt.r || !c.pulses.pt.l) && "pedal pulses"],
    ["exam", d.abiMissing && c.abiNotDone.trim().length < 4 && "ABI / toe pressure, or why not done"],
    ["exam", d.diabetic && (!c.foot.right.vibration || !c.foot.left.vibration) && "vibration sense"],
    ["exam", d.diabetic && !c.footwear && "footwear"],
    ...d.wounds.flatMap((x): [TabId, string | false][] => [
      ["wounds", !x.w.location && `wound ${x.n} location`],
      ["wounds", (!(num(x.w.length) > 0) || !(num(x.w.width) > 0)) && `wound ${x.n} size`],
      ["wounds", x.tissueSum !== 100 && `wound ${x.n} wound bed % (now ${x.tissueSum})`],
      ["treatment", (!x.w.primary || !x.w.freq || !x.w.by) && `wound ${x.n} dressing plan`],
      ["treatment", x.w.debride && (!x.w.method || !x.w.anaesthesia) && `wound ${x.n} debridement details`],
    ]),
    ["treatment", d.diabetic && d.wounds.some((x) => x.plantar) && !c.offload && "offloading decision"],
    ["orders", c.dx.length === 0 && "a diagnosis"],
    ["meds", c.home.some((m) => !m.action) && "a decision for each current medicine"],
    ["meds", c.home.some((m) => m.action && m.action !== "Continue" && m.reason.trim().length < 3) && "reason for stopped, held or changed medicines"],
    ["meds", abxRx.length > 0 && (!c.abx.indication || !c.abx.culture || !c.abx.duration || !c.abx.review) && "antibiotic indication, culture, duration and review"],
    ["meds", d.bmt.some((b) => !b.met && !c.bmt[b.id]) && "best medical therapy (add or give a reason)"],
    ["consent", !c.interpreter && "interpreter"],
    ["consent", !c.discussed.includes("Diagnosis") && "diagnosis discussed"],
    ["consent", needAmpTalk && !c.discussed.includes("Amputation risk") && "amputation risk discussed"],
    ["consent", needDecision && !c.decision && "treatment decision"],
    ["consent", !c.teachBack && "teach-back"],
    ["consent", procedures && (!c.consent.type || c.consent.risks.length < 3 || (c.consent.by !== "Patient" && c.consent.relName.trim().length < 3) || (c.consent.type === "Written (signed)" && !c.consent.signed)) && "procedure consent"],
    ["plan", c.plan.trim().length < 3 && "plan"],
    ["plan", !c.disposition && "outcome"],
    ["plan", c.disposition === "checkout" && !c.followUp && "follow-up interval"],
  ];
  const missingBy = (id: TabId) => need.filter(([tb, m]) => tb === id && m).map(([, m]) => m as string);
  const missing = [...need.filter(([, m]) => m).map(([, m]) => m as string), ...(unresolved.length ? ["override reason for blocking checks"] : []), ...(!c.attest ? ["attestation"] : [])];

  const TABS: { id: TabId; label: string }[] = [
    { id: "nursing", label: "Nursing" }, { id: "history", label: "History" }, { id: "exam", label: "Exam" },
    { id: "wounds", label: `Wounds${hasWound ? ` · ${c.wounds.length}` : ""}` }, { id: "treatment", label: "Treatment" },
    { id: "orders", label: `Diagnosis${c.orders.length ? ` · ${c.orders.length} orders` : ""}` }, { id: "meds", label: "Medicines" },
    { id: "consent", label: "Consent" }, { id: "plan", label: "Plan & sign" },
  ];
  const idx = TABS.findIndex((x) => x.id === tab);
  const next = TABS[idx + 1];
  const tp: TabProps = { r, c, d, me, al, set, upd };

  async function sign() {
    if (pin !== DEMO_PIN) { toast("PIN not recognised. Consultation not signed."); audit(me.name, "deny", `${r.epi} ${r.name}`, "Failed re-authentication at consultation signing"); return; }
    const at = nowIso();
    const trainee = me.cls === "trainee";
    const photoIds = (w: WoundF) => photos.filter((p) => p.woundRef === w.id || (w.fromNurse && !p.woundRef)).map((p) => p.id);
    const base: Omit<ConsultRecord, "hash"> = {
      at, by: me.name, byRole: me.role, room: r.room,
      hpi: c.hpi, duration: c.duration, symptoms: c.symptoms, pmh: c.pmh, meds: c.home.map((m) => `${m.drug} ${m.dose}`.trim()).join("; "), allergies: c.allergies, hba1c: c.hba1c,
      pulses: c.pulses,
      abi: { r: d.abiBy.right, l: d.abiBy.left, tbiR: d.tbiBy.right, tbiL: d.tbiBy.left, notDone: d.abiMissing ? c.abiNotDone : undefined },
      wounds: d.wounds.map((x) => ({
        n: x.n, side: x.w.side, site: x.w.site, location: x.w.location, length: num(x.w.length) || 0, width: num(x.w.width) || 0, depth: num(x.w.depth) || 0, area: x.area,
        tissue: { granulation: num(x.w.granulation) || 0, slough: num(x.w.slough) || 0, necrotic: num(x.w.necrotic) || 0, epithelial: num(x.w.epithelial) || 0 },
        undermining: num(x.w.undermining) || 0, tunnelling: num(x.w.tunnelling) || 0, exposed: x.w.exposed, probeBone: x.w.probeBone, periwound: x.w.periwound, exudate: x.w.exudate, gangrene: x.w.gangrene,
        infection: { local: x.w.local, deep: x.w.deep, erythemaCm: num(x.w.erythemaCm) || 0, grade: x.inf.grade, label: x.inf.label },
        wagner: x.wag, ut: x.ut, photoIds: photoIds(x.w),
      })),
      limbs: d.involved.map((l) => ({ side: l.side, w: l.w, i: l.isch.grade, fi: l.fi, stage: l.stage, risk: l.risk || "not staged" })),
      footExam: d.diabetic ? { right: c.foot.right, left: c.foot.left, footwear: c.footwear, ulcerHistory: c.ulcerHistory, risk: d.risk } : null,
      treatment: {
        debridements: d.wounds.filter((x) => x.w.debride).map((x) => ({ wound: x.n, method: x.w.method, anaesthesia: x.w.anaesthesia, removed: x.w.removed, depthTo: x.w.depthTo, haemostasis: x.w.haemostasis, tolerated: x.w.tolerated })),
        dressings: d.wounds.map((x) => ({ wound: x.n, primary: x.w.primary, secondary: x.w.secondary, freq: x.w.freq, by: x.w.by })),
        offload: c.offload,
      },
      medRec: c.home, egfr: isNaN(num(c.egfr)) ? null : num(c.egfr), wbc: isNaN(num(c.wbc)) ? null : num(c.wbc),
      antibiotic: abxRx.length ? c.abx : null,
      bmt: d.bmt.map((b) => ({ label: b.label, met: b.met, reason: b.met ? undefined : c.bmt[b.id] })),
      discussion: { present: c.present, interpreter: c.interpreter, discussed: c.discussed, decision: c.decision, goals: c.goals, teachBack: c.teachBack },
      consent: procedures ? c.consent : null,
      diagnoses: c.dx.map((x) => { const y = DX.find((z) => z.id === x.id)!; return { id: x.id, code: y.code, label: y.label, side: x.side }; }),
      orders: c.orders, rx: c.rx, alerts: al.map((a) => ({ text: a.text, level: a.level, override: c.overrides[a.id] })),
      plan: c.plan, instructions: c.instructions, disposition: disp!.label, followUp: c.followUp,
      countersign: trainee ? "awaiting consultant" : "not needed",
    };
    const hash = await contentHash(base);
    const rec: ConsultRecord = { ...base, hash };
    const text = `${rec.diagnoses.map((x) => `${x.label} (${x.code})${x.side ? " " + x.side : ""}`).join("; ")}. ${(rec.limbs ?? []).map((l) => `WIfI ${l.side} W${l.w} I${l.i ?? "?"} fI${l.fi}${l.stage ? ` stage ${l.stage}` : ""}`).join("; ")}. ${rec.treatment!.debridements.length ? `Debrided: wound ${rec.treatment!.debridements.map((x) => x.wound).join(", ")}. ` : ""}Orders: ${rec.orders.join(", ") || "none"}. Rx: ${rec.rx.map((x) => `${x.drug} ${x.dose} ${x.freq}`).join(", ") || "none"}. Plan: ${rec.plan}. Outcome: ${rec.disposition}.`;
    setState((s) => ({
      registrations: s.registrations.map((x) => (x.id === r.id ? { ...x, consult: rec, consultDraft: undefined, status: disp!.status, room: undefined, backFromTests: false,
        history: [...(x.history ?? []), { at, by: me.name, text: `Consultation signed · ${disp!.label}` }] } : x)),
      ledger: [{ id: uid("SO"), at: at.slice(0, 16), kind: "clinical", docType: "visit", doc: `Consultation · ${r.token} ${r.name}`, entered: me.name, enteredRole: me.role, centre: r.centre,
        action: "author", signer: me.name, attest: SIGN.attest.author, version: 1, amended: false, hash, method: "SSO + PIN", latencyMin: minsSince(r.seenAt) }, ...s.ledger],
      pending: trainee ? [{ id: uid("SO"), kind: "clinical", doc: `Consultation · ${r.token} ${r.name}`, docType: "visit", entered: me.name, enteredRole: me.role, at: at.slice(0, 16),
        need: "counter", needFrom: "Consultant", priority: disp!.id === "admit" || disp!.id === "emergency" ? "high" : "medium", why: "Consultation by a trainee: consultant countersignature required.",
        subject: { type: "consult", ref: r.id }, content: text, version: 1 }, ...s.pending] : s.pending,
    }));
    audit(me.name, "sign", `${r.epi} ${r.name}`, `Consultation signed · hash ${hash} · ${disp!.label}${procedures ? " · procedure consent " + c.consent.type : ""}${al.length ? ` · ${al.length} check(s), ${blocks.length} overridden` : ""}`);
    toast(`Consultation signed${trainee ? " and sent for consultant countersignature" : ""}. ${r.name}: ${disp!.label}.`);
    onDone();
  }

  function toTests() {
    if (!c.orders.length) { toast("Add at least one order before sending the patient to tests."); setTab("orders"); return; }
    saveDraft(r.id, c);
    updateReg(r.id, me.name, `Sent for tests: ${c.orders.join(", ")}`, { status: "at tests", testsAt: nowIso(), room: undefined });
    audit(me.name, "write", `${r.epi} ${r.name}`, `Orders placed, sent for tests: ${c.orders.join(", ")}`);
    toast(`${r.name} sent for tests. The consultation stays open and resumes when results are back.`);
    onDone();
  }

  const zoomed = photos.find((p) => p.id === zoom);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 340px", gap: 14, alignItems: "start" }}>
      <div>
        <div className="phead" style={{ marginBottom: 10 }}>
          <div className="rt" style={{ order: 2 }}>
            <NewsBadge n={t.news} size={44} />
            <span className="xs mut">entries save automatically</span>
          </div>
          <div style={{ flex: 1 }}>
            <div className="nm">{r.name} <span className="mut sm">{r.age} y · {r.sex}</span> <Pill c={CAT_TONE[t.category]}>{t.category}</Pill></div>
            <div className="mt">{r.token} · {r.mrn} · {r.queueLabel} · {r.room} · with {r.doctor} for {minsSince(r.seenAt)} min{r.backFromTests && " · back from tests"}</div>
            <div className="dx">&ldquo;{r.complaint || "—"}&rdquo;</div>
            <div className="sb" style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 6 }}>
              {c.allergies && !/^(nkda|none)/i.test(c.allergies) ? <Pill c="r">Allergy: {c.allergies}</Pill> : <Pill c="g">No known drug allergy</Pill>}
              {d.diabetic && <Pill>Diabetic{cl.dmYears ? ` ${cl.dmYears}y` : ""}{cl.insulin ? " · insulin" : ""}</Pill>}
              {cl.ckd && <Pill c="a">Kidney disease</Pill>}{cl.dialysis && <Pill c="a">Dialysis</Pill>}{cl.anticoag && <Pill c="a">Blood thinners</Pill>}
              {cl.prevAmp && <Pill c="a">Previous amputation</Pill>}{cl.prevRevasc && <Pill>Previous revascularisation</Pill>}
              <Pill>{r.language}</Pill><Pill>{r.scheme}</Pill>
            </div>
          </div>
        </div>

        <div className="card mb14">
          <div className="tabs stick-tabs" role="tablist" style={{ padding: "0 10px", marginBottom: 0 }}>
            {TABS.map((x) => {
              const done = x.id === "nursing" || missingBy(x.id).length === 0;
              return (
                <button key={x.id} role="tab" aria-selected={tab === x.id} className={tab === x.id ? "on" : ""} onClick={() => setTab(x.id)} style={{ whiteSpace: "nowrap", padding: "11px 9px" }}>
                  <span style={{ color: done ? "var(--green)" : "var(--ink4)", marginRight: 5 }}>{done ? "✓" : "○"}</span>{x.label}
                </button>
              );
            })}
          </div>
          <div className="card-b">
            {tab === "nursing" && (
              <>
                <div className="xs mut" style={{ marginBottom: 10 }}>By {t.by} at {clock(t.at)} · {t.algo}{t.overrideReason && <> · category changed from {t.suggested}: {t.overrideReason}</>}</div>
                <table className="t cmp-t" style={{ marginBottom: 12 }}><tbody>
                  <tr>{[["RR", t.vitals.rr], ["SpO₂", `${t.vitals.spo2}%${t.vitals.o2 ? " O₂" : ""}`], ["HR", t.vitals.hr], ["BP", `${t.vitals.sbp}/${t.vitals.dbp}`], ["Temp", `${t.vitals.temp}°`], ["ACVPU", t.vitals.avpu], ["Glucose", t.vitals.cbg ?? "—"], ["Pain", `${t.vitals.pain}/10`]].map(([k, v]) => (
                    <td key={k as string}><div className="xs mut">{k}</div><b className="num">{v}</b></td>))}</tr>
                </tbody></table>
                <div className="grid2" style={{ gap: "0 24px" }}>
                  <div>
                    <div className="fsec-h"><h4>Foot & limb (nurse)</h4></div>
                    <table className="t cmp-t"><thead><tr><th /><th>Right</th><th>Left</th></tr></thead><tbody>
                      {(["dp", "pt", "colour", "temp", "sensation"] as const).map((k) => (
                        <tr key={k}><td className="xs">{({ dp: "Dorsalis pedis", pt: "Posterior tibial", colour: "Colour", temp: "Temperature", sensation: "Monofilament" })[k]}</td>
                          <td className="sm">{t.limbs.right[k] || "—"}</td><td className="sm">{t.limbs.left[k] || "—"}</td></tr>))}
                    </tbody></table>
                    <div className="xs mut" style={{ marginTop: 6 }}>Capillary refill {t.limbs.crt || "—"} · rest pain {t.limbs.restPain ? <b style={{ color: "var(--red)" }}>yes</b> : "no"}{t.limbs.claudicationM && ` · walks ${t.limbs.claudicationM}`}</div>
                  </div>
                  <div>
                    <div className="fsec-h"><h4>Wound (nurse)</h4><span className="hint">IWGDF infection: {t.infection}</span></div>
                    {t.wound ? (
                      <div className="sm" style={{ lineHeight: 1.7 }}>
                        <b>{t.wound.site}</b> · {t.wound.length} × {t.wound.width}{t.wound.depth ? ` × ${t.wound.depth}` : ""} cm = <b>{t.wound.area} cm²</b><br />
                        Bed {t.wound.bed} · exudate {t.wound.exudate} · redness {t.wound.erythemaCm} cm{t.wound.odour && " · odour"}{t.wound.probeBone && <> · <b style={{ color: "var(--red)" }}>probe-to-bone +</b></>}
                      </div>
                    ) : <div className="sm mut">No open wound.</div>}
                    {photos.length > 0 && (
                      <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                        {photos.map((p) => (
                          <button key={p.id} onClick={() => setZoom(p.id)} style={{ padding: 0, border: "1px solid var(--line2)", borderRadius: 5, overflow: "hidden", background: "#000" }} aria-label="Enlarge wound photo">
                            {/* eslint-disable-next-line @next/next/no-img-element -- local data URL */}
                            <img src={p.dataUrl} alt={`Wound photo ${p.site}`} style={{ width: 92, height: 70, objectFit: "cover", display: "block" }} />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="fsec-h mt14"><h4>Flags, actions and nurse note</h4></div>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 6 }}>{t.flags.length ? t.flags.map((x) => <Pill key={x} c="a">{x}</Pill>) : <span className="xs mut">No flags.</span>}</div>
                {t.actions.length > 0 && <div className="xs" style={{ color: "var(--ink2)" }}>Done by nurse: {t.actions.join(" · ")}</div>}
                {t.note && <div className="sm" style={{ marginTop: 6 }}>&ldquo;{t.note}&rdquo;</div>}
                {(r.results?.length ?? 0) > 0 && (
                  <>
                    <div className="fsec-h mt14"><h4>Test results</h4><span className="hint">from the results desk</span></div>
                    <table className="t cmp-t"><tbody>
                      {r.results!.map((x) => (
                        <tr key={x.order}>
                          <td className="sm" style={{ width: "30%" }}><b>{x.order}</b><div className="xs mut">{x.dept} · {clock(x.at)}</div></td>
                          <td className="sm">{Object.entries(x.values).filter(([, v]) => v).map(([k2, v]) => `${k2}: ${v}`).join(" · ")}</td>
                          <td style={{ width: 170 }}>{x.critical ? <Pill c="r">{x.critical}</Pill> : /Pending/.test(x.values.status ?? "") ? <Pill c="a">pending</Pill> : <Pill c="g">reported</Pill>}</td>
                        </tr>
                      ))}
                    </tbody></table>
                  </>
                )}
              </>
            )}
            {tab === "history" && <HistoryTab {...tp} />}
            {tab === "exam" && <ExamTab {...tp} />}
            {tab === "wounds" && <WoundsTab {...tp} />}
            {tab === "treatment" && <TreatmentTab {...tp} />}
            {tab === "orders" && <OrdersTab {...tp} sugDx={sugDx} sugOrders={sugOrders} sideName={sideName} />}
            {tab === "meds" && <MedsTab {...tp} />}
            {tab === "consent" && <ConsentTab {...tp} />}
            {tab === "plan" && (
              <>
                <div className="fld"><label className="req-l">Plan</label>
                  <textarea value={c.plan} onChange={(e) => set("plan", e.target.value)} placeholder="Treatment today; what happens next and who is responsible" /></div>
                <div className="fsec-h mt14"><h4>Outcome</h4></div>
                <div className="chipset" style={{ marginBottom: 10 }}>
                  {DISPOSITIONS.map((x) => <button key={x.id} className={c.disposition === x.id ? (x.id === "emergency" ? "on red" : "on") : ""} onClick={() => set("disposition", x.id)}>{x.label}</button>)}
                </div>
                {c.disposition === "checkout" && (
                  <div className="ob wide" style={{ maxWidth: 420 }}><label>Follow-up *<span>{d.diabetic && hasWound ? "active ulcer: usually 1–2 weeks" : "next clinic visit"}</span></label>
                    <select value={c.followUp} onChange={(e) => set("followUp", e.target.value)}><option value="">Select…</option>{FOLLOW.map((f) => <option key={f}>{f}</option>)}</select></div>
                )}
                <div className="fsec-h mt14"><h4>Instructions for the patient</h4><span className="hint">printed on the visit summary</span></div>
                {INSTRUCTIONS.map((i) => <label key={i} className="check"><input type="checkbox" checked={c.instructions.includes(i)} onChange={() => set("instructions", c.instructions.includes(i) ? c.instructions.filter((y) => y !== i) : [...c.instructions, i])} /> {i}</label>)}
                <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--line)", display: "flex", gap: 8, alignItems: "center" }}>
                  <button className="btn" onClick={toTests}>Send for tests, see again today</button>
                  <span className="xs mut">Keeps the consultation open; the patient returns to your queue when results are back.</span>
                </div>
              </>
            )}

            {tab !== "nursing" && missingBy(tab).length > 0 && <div className="xs" style={{ marginTop: 12, color: "var(--amber)" }}>Still needed here: {missingBy(tab).join(", ")}.</div>}
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
              <button className="btn sm" disabled={idx === 0} onClick={() => setTab(TABS[idx - 1].id)}>← Back</button>
              {next ? <button className="btn sm p" onClick={() => setTab(next.id)}>Next: {next.label.split(" · ")[0]} →</button> : <span className="xs mut">Sign from the summary on the right →</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="sticky-side">
        <Card title="Consultation summary" bodyClass="card-b">
          <div className="sm" style={{ lineHeight: 1.8 }}>
            ABI R <b className="num">{d.abiBy.right ?? "—"}</b> · L <b className="num">{d.abiBy.left ?? "—"}</b>{abiAff != null && <> <Pill c={abiBand(abiAff)[1]}>{sideName}: {abiBand(abiAff)[0]}</Pill></>}<br />
            {d.involved.map((l) => <div key={l.side}>WIfI {l.side} <b>W{l.w} I{l.isch.grade ?? "?"} fI{l.fi}</b>{l.stage && <> · <Pill c={["", "g", "b", "o", "r"][l.stage]}>stage {l.stage} · {RISK[l.stage]}</Pill></>}</div>)}
            {d.wounds.map((x) => <div key={x.w.id} className="xs">Wound {x.n} ({x.w.side}{x.w.location && `, ${x.w.location.toLowerCase()}`}) · {x.area || "—"} cm² · Wagner {x.wag} · IWGDF {x.inf.grade}</div>)}
            {d.diabetic && <div className="xs">IWGDF foot risk <b>{d.risk.cat}</b> ({d.risk.label}){c.wounds.length ? " after healing" : ""}</div>}
          </div>
          <div className="fsec-h mt14" style={{ marginBottom: 6 }}><h4>Diagnoses</h4></div>
          <div className="xs">{c.dx.length ? c.dx.map((x) => <div key={x.id}>• {DX.find((y) => y.id === x.id)!.label}{x.side && ` (${x.side})`}</div>) : <span className="mut">none yet</span>}</div>
          <div className="xs mut" style={{ marginTop: 6 }}>
            {c.orders.length} order{c.orders.length === 1 ? "" : "s"} · {c.rx.length} new medicine{c.rx.length === 1 ? "" : "s"} · {c.wounds.filter((w) => w.debride).length} debrided{c.offload && c.offload !== "Not needed" ? ` · ${c.offload.toLowerCase()}` : ""}
          </div>

          {al.length > 0 && (
            <>
              <div className="fsec-h mt14" style={{ marginBottom: 6 }}><h4>Safety checks</h4><span className="hint">{blocks.length} blocking</span></div>
              {al.map((a) => (
                <div key={a.id} className="xs" style={{ padding: "6px 8px", marginBottom: 6, borderRadius: 5, background: a.level === "block" ? "var(--red-s)" : "var(--amber-s)", color: a.level === "block" ? "var(--red)" : "#6b4a0a" }}>
                  {a.level === "block" ? "⛔ " : "⚠ "}{a.text}
                  {a.fix && <button className="btn sm" style={{ marginTop: 5, display: "block" }} onClick={() => set("rx", c.rx.map((x) => (x.drug === a.fix!.drug ? { ...x, dose: a.fix!.dose, freq: a.fix!.freq } : x)))}>Apply {a.fix.dose} {a.fix.freq}</button>}
                  {a.level === "block" && <input className="cmp" style={{ marginTop: 5 }} placeholder="Override reason (or remove the item)" value={c.overrides[a.id] ?? ""} onChange={(e) => set("overrides", { ...c.overrides, [a.id]: e.target.value })} aria-label="Override reason" />}
                </div>
              ))}
            </>
          )}

          <div className="fsec-h mt14" style={{ marginBottom: 6 }}><h4>Outcome</h4></div>
          <div className="sm">{disp ? <Pill c={disp.tone}>{disp.label}</Pill> : <span className="xs mut">not chosen</span>}{c.followUp && <span className="xs mut"> · follow-up {c.followUp}</span>}</div>

          <label className="check" style={{ margin: "12px 0 8px" }}><input type="checkbox" checked={c.attest} onChange={(e) => set("attest", e.target.checked)} /> <span className="xs">{SIGN.attest.author}</span></label>
          <div className="fld" style={{ marginBottom: 8 }}><label>Re-enter PIN to sign</label><input type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="demo: 1234" /></div>
          <button className="btn p" style={{ width: "100%", padding: 11 }} disabled={missing.length > 0 || pin.length < 4} onClick={sign}>Sign consultation</button>
          {missing.length > 0 && <div className="xs mut" style={{ marginTop: 6 }}>Still needed: {missing.join(", ")}.</div>}
          {me.cls === "trainee" && <div className="xs" style={{ marginTop: 6, color: "var(--amber)" }}>You are signing as a trainee: a consultant countersignature will be requested.</div>}
        </Card>
      </div>

      {zoomed && (
        <Modal title={`Wound photo · ${zoomed.site}`} onClose={() => setZoom(null)} width={900}>
          {/* eslint-disable-next-line @next/next/no-img-element -- local data URL */}
          <img src={zoomed.dataUrl} alt="Wound photo enlarged" style={{ width: "100%", maxHeight: "65vh", objectFit: "contain", background: "#000", borderRadius: 6 }} />
          <div className="xs mut" style={{ marginTop: 8 }}>{zoomed.by} · {clock(zoomed.at)} · {zoomed.marker ? "calibration marker in frame" : "no calibration marker — not measurable"}{zoomed.note && ` · ${zoomed.note}`}</div>
        </Modal>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ consultation record (read-only)

function RecordModal({ r, onClose }: { r: Registration; onClose: () => void }) {
  const k = r.consult!;
  const row = (l: string, v: ReactNode) => <tr key={l}><td className="xs mut" style={{ width: 150, verticalAlign: "top" }}>{l}</td><td className="sm">{v}</td></tr>;
  const list = (a?: string[]) => (a && a.length ? a.join(", ") : "—");
  return (
    <Modal title={<>Consultation · <span className="num">{r.token}</span> · {r.name}</>} onClose={onClose} width={820}>
      <div className="xs mut" style={{ marginBottom: 10 }}>Signed by {k.by} ({k.byRole}) at {clock(k.at)} · hash <span className="num">{k.hash}</span> · countersignature: {k.countersign}</div>
      <table className="t cmp-t"><tbody>
        {row("History", <>{k.hpi}{k.duration && ` · ${k.duration}`}<div className="xs mut">{[...k.symptoms, ...k.pmh].join(" · ")}</div></>)}
        {row("Allergies", k.allergies || "—")}
        {k.medRec && k.medRec.length > 0 && row("Current medicines", k.medRec.map((m) => `${m.drug}${m.dose ? " " + m.dose : ""}: ${m.action.toLowerCase()}${m.reason ? ` (${m.reason})` : ""}`).join(" · "))}
        {row("Pulses R / L", (["fem", "pop", "dp", "pt"] as const).map((p) => `${p.toUpperCase()} ${k.pulses[p].r || "—"}/${k.pulses[p].l || "—"}`).join(" · "))}
        {row("ABI / TBI", k.abi.notDone ? `not measured: ${k.abi.notDone}` : `ABI R ${k.abi.r ?? "—"} L ${k.abi.l ?? "—"} · TBI R ${k.abi.tbiR ?? "—"} L ${k.abi.tbiL ?? "—"}`)}
        {k.footExam && row("Diabetic foot", <>Vibration R {k.footExam.right.vibration || "—"} / L {k.footExam.left.vibration || "—"} · footwear {k.footExam.footwear || "—"} · deformity {list([...k.footExam.right.deformity, ...k.footExam.left.deformity])}<div className="xs mut">IWGDF risk {k.footExam.risk.cat} ({k.footExam.risk.label}) · check {k.footExam.risk.interval}</div></>)}
        {k.wounds?.map((w) => row(`Wound ${w.n} (${w.side})`, <>{w.site || w.location} · {w.length} × {w.width}{w.depth ? ` × ${w.depth}` : ""} cm = {w.area} cm² · bed {w.tissue.granulation}% granulation, {w.tissue.slough}% slough, {w.tissue.necrotic}% necrotic{w.undermining ? ` · undermining ${w.undermining} cm` : ""}<div className="xs mut">Exposed {list(w.exposed)}{w.probeBone ? " · probe-to-bone +" : ""} · gangrene {w.gangrene} · IWGDF {w.infection.grade} ({w.infection.label}) · Wagner {w.wagner} · UT {w.ut}{w.photoIds.length ? ` · ${w.photoIds.length} photo(s)` : ""}</div></>))}
        {k.limbs?.map((l) => row(`WIfI ${l.side}`, `W${l.w} I${l.i ?? "?"} fI${l.fi}${l.stage ? ` · stage ${l.stage} (${l.risk})` : ""}`))}
        {!k.wounds && k.woundExam && row("Wound", `${k.woundExam.depth} · ${k.woundExam.location} · gangrene ${k.woundExam.gangrene}`)}
        {!k.wounds && k.wifi && row("Classification", `${k.wagner != null ? `Wagner ${k.wagner} · UT ${k.ut} · ` : ""}WIfI W${k.wifi.w} I${k.wifi.i ?? "?"} fI${k.wifi.fi}${k.wifi.stage ? ` · stage ${k.wifi.stage} (${k.wifi.risk})` : ""}`)}
        {k.treatment && row("Treatment today", <>{k.treatment.debridements.map((x) => `Wound ${x.wound}: ${x.method}, ${x.anaesthesia.toLowerCase()}, removed ${list(x.removed).toLowerCase()}${x.depthTo ? ` to ${x.depthTo.toLowerCase()}` : ""}`).join(" · ") || "No debridement"}
          <div className="xs mut">{k.treatment.dressings.map((x) => `Wound ${x.wound}: ${x.primary}${x.secondary ? ` + ${x.secondary}` : ""}, ${x.freq.toLowerCase()} by ${x.by.toLowerCase()}`).join(" · ")}{k.treatment.offload ? ` · offloading: ${k.treatment.offload}` : ""}</div></>)}
        {row("Diagnoses", k.diagnoses.map((x) => `${x.label} (${x.code})${x.side ? ` ${x.side}` : ""}`).join("; "))}
        {row("Orders", k.orders.join(", ") || "none")}
        {row("Prescription", k.rx.length ? k.rx.map((x) => `${x.drug} ${x.dose} ${x.route} ${x.freq} × ${x.days}`).join("; ") : "none")}
        {k.antibiotic && row("Antibiotic", `${k.antibiotic.indication} · culture: ${k.antibiotic.culture} · ${k.antibiotic.duration} · review ${k.antibiotic.review}`)}
        {k.bmt && k.bmt.length > 0 && row("Best medical therapy", k.bmt.map((b) => `${b.label}: ${b.met ? "met" : `not met — ${b.reason}`}`).join(" · "))}
        {k.alerts.length > 0 && row("Safety checks", k.alerts.map((a) => `${a.level === "block" ? "⛔" : "⚠"} ${a.text}${a.override ? ` — overridden: ${a.override}` : ""}`).join(" · "))}
        {k.discussion && row("Discussion", <>Present: {list(k.discussion.present)} · interpreter: {k.discussion.interpreter} · discussed: {list(k.discussion.discussed)}{k.discussion.decision && ` · decision: ${k.discussion.decision}`}{k.discussion.teachBack && " · teach-back confirmed"}{k.discussion.goals && <div className="xs mut">Goals: {k.discussion.goals}</div>}</>)}
        {k.consent && row("Procedure consent", `${k.consent.type} by ${k.consent.by === "Patient" ? "the patient" : k.consent.relName} · risks: ${list(k.consent.risks).toLowerCase()}${k.consent.type.startsWith("Written") ? (k.consent.signed ? " · signed" : " · NOT signed") : ""}${k.consent.witness ? ` · witness ${k.consent.witness}` : ""}`)}
        {row("Plan", k.plan)}
        {row("Outcome", `${k.disposition}${k.followUp ? ` · follow-up ${k.followUp}` : ""}`)}
        {k.instructions.length > 0 && row("Patient instructions", k.instructions.join(" · "))}
      </tbody></table>
    </Modal>
  );
}

// ------------------------------------------------------------------ demo: patients already assessed

export function demoAssessed(centre: string): Registration[] {
  const base = Date.now();
  const iso = (minAgo: number) => new Date(base - minAgo * 60000).toISOString();
  const L = (dp: string, pt: string, o: Partial<Limb> = {}): Limb => ({ dp, pt, colour: "Normal", temp: "Warm", sensation: "Intact", swelling: false, ...o });
  const tri = (o: Partial<TriageRecord> & Pick<TriageRecord, "category" | "limbs" | "wound" | "infection" | "flags">, minAgo: number): TriageRecord => ({
    at: iso(minAgo), by: "Sr. Revathi S.", idChecked: true,
    vitals: { rr: 16, spo2: 97, o2: 0, hr: 82, sbp: 138, dbp: 82, pulse: 82, temp: 36.9, avpu: "A", cbg: 168, pain: 4, weight: 68, height: 165 },
    news: 0, newsThree: false, algo: "NEWS2 · RCP 2017 · SpO₂ scale 1", suggested: o.category, actions: [], note: "", ...o,
  });
  const mk = (i: number, o: Partial<Registration> & Pick<Registration, "name" | "age" | "sex" | "queue" | "queueLabel" | "complaint" | "triage">, c: Partial<Registration["clinical"]>): Registration => ({
    id: uid("REG"), epi: `EPI-0798${100 + i}`, mrn: `${centre}-75${String(1100 + i * 37)}`, token: `${o.queue}-8${i}`, priority: "routine",
    at: iso(70 - i * 5), by: "Kavya R.", centre, returning: true, emergencyQuick: false, ageApprox: false,
    phone: "98765 1000" + i, phoneVerified: true, language: ["Tamil", "Telugu", "Hindi"][i], area: "", city: "Chennai", state: "Tamil Nadu", pin: "600020",
    idSeen: "Aadhaar (masked)", arrival: "Walk-in", visit: "dfoot", redFlags: [], scheme: ["CMCHIS", "Ayushman Bharat PM-JAY", "Self-pay"][i], schemeId: "DEMO",
    consent: { care: true, share: true, research: false, photo: "care+research" }, status: "ready for doctor",
    clinical: { diabetes: "Yes", dmYears: "12", insulin: false, ckd: false, dialysis: false, prevAmp: false, prevRevasc: false, anticoag: false, smoking: "Never", allergies: "NKDA", woundSite: "", woundWeeks: "", mobility: "Walking unaided", ...c },
    ...o,
  });
  return [
    mk(0, {
      name: "Venkatesh Rao", age: 71, sex: "Male", queue: "V", queueLabel: "Vascular OPD", complaint: "Pain at rest / at night", priority: "priority",
      triage: tri({
        category: "Urgent", infection: "mild", flags: ["Suspected CLTI (rest pain / tissue loss with poor pulses)", "Anticoagulated with open wound"],
        vitals: { rr: 18, spo2: 97, o2: 0, hr: 88, sbp: 150, dbp: 90, pulse: 88, temp: 37.0, avpu: "A", cbg: 180, pain: 6, weight: 64, height: 168 },
        limbs: { right: L("Palpable", "Palpable"), left: L("Absent", "Doppler only", { colour: "Pale", temp: "Cool", sensation: "Reduced" }), crt: "> 4 s", restPain: true, claudicationM: "50 m" },
        wound: { site: "Left great toe", length: 1.5, width: 1, depth: 0, area: 1.5, bed: "Necrotic (black)", exudate: "Light", odour: false, erythemaCm: 0.5, probeBone: false, photo: false },
        note: "Sleeps sitting in a chair with the leg hanging down.",
      }, 22),
    }, { smoking: "Current", prevRevasc: true, anticoag: true, woundSite: "Left toe(s)", woundWeeks: "3" }),
    mk(1, {
      name: "Selvi Ramasamy", age: 62, sex: "Female", queue: "D", queueLabel: "Diabetic foot clinic", complaint: "Foot ulcer",
      triage: tri({
        category: "Standard", infection: "moderate", flags: ["Moderate foot infection"],
        vitals: { rr: 18, spo2: 98, o2: 0, hr: 96, sbp: 142, dbp: 86, pulse: 96, temp: 37.6, avpu: "A", cbg: 246, pain: 3, weight: 72, height: 158 },
        limbs: { right: L("Palpable", "Palpable", { sensation: "Absent" }), left: L("Palpable", "Palpable", { sensation: "Absent" }), crt: "< 2 s", restPain: false, claudicationM: "" },
        wound: { site: "Right forefoot (1st metatarsal head)", length: 2.5, width: 2, depth: 0.8, area: 5, bed: "Slough (yellow)", exudate: "Moderate", odour: true, erythemaCm: 2.5, probeBone: true, photo: false },
        actions: ["Blood glucose rechecked"],
      }, 35),
    }, { dmYears: "15", insulin: true, allergies: "Penicillin (rash)", woundSite: "Right foot", woundWeeks: "6" }),
    mk(2, {
      name: "Abdul Kareem", age: 55, sex: "Male", queue: "W", queueLabel: "Wound clinic", complaint: "Wound not healing",
      triage: tri({
        category: "Routine", infection: "none", flags: [],
        limbs: { right: L("Palpable", "Palpable"), left: L("Palpable", "Palpable", { swelling: true }), crt: "< 2 s", restPain: false, claudicationM: "" },
        wound: { site: "Left leg, medial malleolus", length: 4, width: 3, depth: 0.2, area: 12, bed: "Granulating (red)", exudate: "Heavy", odour: false, erythemaCm: 0, probeBone: false, photo: false },
        note: "Varicose veins both legs, skin darkening around the ankle.",
      }, 40),
    }, { diabetes: "No", dmYears: "", allergies: "Sulfa drugs", woundSite: "Left leg", woundWeeks: "10" }),
  ];
}
