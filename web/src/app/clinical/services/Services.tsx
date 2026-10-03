"use client";

// Step 4B: tests & procedures.
// Results desk — patients "at tests": enter each ordered result; critical results must be
// phoned to a named doctor (rule A05) before the results go back to the consulting doctor.
// Dressing room & HBOT — patients "for procedure": carry out the doctor's dressing plan with
// compression / NPWT safety checks and patient education, assess HBOT candidacy against the
// rule A25 gates (glucose floor A26), then send the patient to checkout.

import { useState } from "react";
import { Guard, Top, useMe } from "@/components/cx/Shell";
import { Card, Kpis, Pill, toast } from "@/components/cx/ui";
import { EDUCATION, HBOT_ABSOLUTE, HBOT_CHECKS, HBOT_INDICATIONS, HBOT_RELATIVE, RESULT_FORMS, hbotGates, resultComplete } from "@/lib/cx/services";
import { demoAssessed } from "@/app/clinical/consult/Consult";
import { audit, setState, uid, useStore, type ConsultRecord, type ProcedureRecord, type Registration, type TestResult } from "@/lib/cx/store";
import { STAFF, type Staff } from "@/lib/cx/users";

const minsSince = (at?: string) => (at ? Math.max(0, Math.round((Date.now() - Date.parse(at)) / 60000)) : 0);
const ordersOf = (r: Registration): string[] => ((r.consultDraft as { orders?: string[] } | undefined)?.orders ?? r.consult?.orders ?? []);
const testOrders = (r: Registration) => ordersOf(r).filter((o) => RESULT_FORMS[o]);
const toggle = (a: string[], v: string) => (a.includes(v) ? a.filter((x) => x !== v) : [...a, v]);

export function Services() {
  return (
    <Guard screen="services">
      <Top title="Tests & procedures" sub="Step 4B · results desk for patients at tests → back to the doctor · dressing room and HBOT assessment → checkout" />
      <Body />
    </Guard>
  );
}

function Body() {
  const me = useMe();
  const st = useStore();
  const [tab, setTab] = useState<"results" | "room">("results");
  const [sel, setSel] = useState<string | null>(null);
  const regs = st.registrations.filter((r) => me.centres.includes(r.centre as never));
  const atTests = regs.filter((r) => r.status === "at tests").sort((a, b) => (a.testsAt ?? "").localeCompare(b.testsAt ?? ""));
  const forProc = regs.filter((r) => r.status === "for procedure" && r.consult);
  const critical = atTests.flatMap((r) => (r.results ?? []).filter((x) => x.critical && !x.informed));
  const list = tab === "results" ? atTests : forProc;
  const r = list.find((x) => x.id === sel) ?? null;

  function seed() {
    setState((s) => ({ registrations: [...demoAtTests(me.centres[0]), ...demoForProcedure(me.centres[0]), ...s.registrations] }));
    toast("Demo patients added: two at tests, two for the dressing room.");
  }

  return (
    <>
      <Kpis cols={4} items={[
        { k: "At tests", v: atTests.length, d: `${atTests.reduce((a, x) => a + testOrders(x).length, 0)} tests ordered` },
        { k: "Critical results", v: critical.length, d: "not yet phoned to a doctor", tone: critical.length ? "bad" : "" },
        { k: "Dressing room", v: forProc.length, d: `${forProc.filter((x) => ordersOf(x).includes("HBOT assessment")).length} need an HBOT assessment` },
        { k: "Done today", v: regs.filter((x) => x.procedure).length, d: "procedures recorded" },
      ]} />

      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === "results"} className={tab === "results" ? "on" : ""} onClick={() => { setTab("results"); setSel(null); }}>Results desk · {atTests.length}</button>
        <button role="tab" aria-selected={tab === "room"} className={tab === "room" ? "on" : ""} onClick={() => { setTab("room"); setSel(null); }}>Dressing room & HBOT · {forProc.length}</button>
      </div>

      <Card title={tab === "results" ? "Patients at tests" : "Waiting for the dressing room"} hint="oldest first · click to open" className="mb14"
        right={atTests.length + forProc.length === 0 ? <button className="btn sm v" onClick={seed}>Load demo patients</button> : undefined}>
        {list.length === 0 ? <div className="sm mut">Nobody here. Patients arrive when the doctor sends them for tests or to the dressing room{atTests.length + forProc.length === 0 ? ", or load demo patients" : ""}.</div> : (
          <table className="t"><tbody>
            {list.map((x) => {
              const done = (x.results ?? []).filter((y) => resultComplete(y.order, y.values)).length;
              return (
                <tr key={x.id} className="clk" onClick={() => setSel(x.id)}>
                  <td className="num" style={{ whiteSpace: "nowrap" }}><b>{x.token}</b></td>
                  <td className="sm"><b>{x.name}</b> <span className="xs mut">{x.age}{x.sex[0]} · {x.doctor ?? x.consult?.by}</span></td>
                  <td className="xs">{tab === "results" ? testOrders(x).join(", ") : (x.consult!.treatment?.dressings ?? []).map((d) => `${d.primary}${d.secondary ? ` + ${d.secondary}` : ""}`).join(" · ")}{tab === "room" && ordersOf(x).includes("HBOT assessment") && <> <Pill c="v">HBOT assessment</Pill></>}</td>
                  <td className="xs">{tab === "results" ? `${done}/${testOrders(x).length} results` : ""}{(x.results ?? []).some((y) => y.critical && !y.informed) && <> <Pill c="r">critical</Pill></>}</td>
                  <td className="xs mut">{minsSince(tab === "results" ? x.testsAt : x.consult?.at)} min</td>
                  <td style={{ textAlign: "right" }}><button className="btn sm p" onClick={(e) => { e.stopPropagation(); setSel(x.id); }}>Open</button></td>
                </tr>
              );
            })}
          </tbody></table>
        )}
      </Card>

      {r && tab === "results" && <ResultsDesk key={r.id} r={r} me={me} onDone={() => setSel(null)} />}
      {r && tab === "room" && <Room key={r.id} r={r} me={me} onDone={() => setSel(null)} />}
    </>
  );
}

// ------------------------------------------------------------------ results desk

function ResultsDesk({ r, me, onDone }: { r: Registration; me: Staff; onDone: () => void }) {
  const orders = ordersOf(r);
  const tests = orders.filter((o) => RESULT_FORMS[o]);
  const other = orders.filter((o) => !RESULT_FORMS[o]);
  const saved = Object.fromEntries((r.results ?? []).map((x) => [x.order, x]));
  const [vals, setVals] = useState<Record<string, Record<string, string>>>(() => Object.fromEntries(tests.map((o) => [o, saved[o]?.values ?? {}])));
  const [informed, setInformed] = useState<Record<string, string>>(() => Object.fromEntries((r.results ?? []).filter((x) => x.informed).map((x) => [x.order, x.informed!])));
  const setV = (o: string, k: string, v: string) => setVals((x) => ({ ...x, [o]: { ...x[o], [k]: v } }));
  const complete = (o: string) => resultComplete(o, vals[o] ?? {});
  const crit = (o: string) => RESULT_FORMS[o].critical?.(vals[o] ?? {}) ?? null;
  const pending = tests.filter((o) => !complete(o));
  const unphoned = tests.filter((o) => crit(o) && (informed[o] ?? "").trim().length < 3);

  function persist(o: string) {
    const v = vals[o] ?? {};
    const res: TestResult = { order: o, dept: RESULT_FORMS[o].dept, at: new Date().toISOString(), by: me.name, values: v, critical: crit(o), informed: informed[o] || undefined };
    setState((s) => ({ registrations: s.registrations.map((x) => (x.id === r.id ? { ...x, results: [...(x.results ?? []).filter((y) => y.order !== o), res] } : x)) }));
    audit(me.name, "write", `${r.epi} ${r.name}`, `Result entered: ${o}${res.critical ? ` · CRITICAL: ${res.critical}` : ""}`);
    if (res.critical && !res.informed) toast(`Critical result: ${res.critical}. Phone ${r.doctor ?? "the consulting doctor"} now and record who you told.`);
  }

  function sendBack() {
    const at = new Date().toISOString();
    const results: TestResult[] = tests.map((o) => ({ order: o, dept: RESULT_FORMS[o].dept, at, by: me.name, values: vals[o] ?? {}, critical: crit(o), informed: informed[o] || undefined }));
    const pick = (o: string, k: string) => vals[o]?.[k] ?? "";
    setState((s) => ({
      registrations: s.registrations.map((x) => {
        if (x.id !== r.id) return x;
        // Feed numbers the consultation uses (HbA1c, eGFR, WBC) into the open draft if it has none.
        const d = { ...(x.consultDraft ?? {}) } as Record<string, unknown>;
        if (!d.hba1c && pick("HbA1c", "hba1c")) d.hba1c = pick("HbA1c", "hba1c");
        if (!d.egfr && pick("Creatinine / eGFR", "egfr")) d.egfr = pick("Creatinine / eGFR", "egfr");
        if (!d.wbc && pick("CBC", "wbc")) d.wbc = pick("CBC", "wbc");
        return { ...x, results, consultDraft: d, status: "ready for doctor", backFromTests: true, history: [...(x.history ?? []), { at, by: me.name, text: `Results back to the doctor: ${tests.join(", ")}${results.some((y) => y.critical) ? " (critical result phoned)" : ""}` }] };
      }),
    }));
    audit(me.name, "write", `${r.epi} ${r.name}`, `Results sent back to the doctor (${tests.length})`);
    toast(`${r.name}'s results are with the doctor. The patient is back in the doctor's queue.`);
    onDone();
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 320px", gap: 14, alignItems: "start" }}>
      <div>
        <div className="phead" style={{ marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <div className="nm">{r.name} <span className="mut sm">{r.age} y · {r.sex}</span></div>
            <div className="mt">{r.token} · {r.mrn} · sent by {r.doctor} {minsSince(r.testsAt)} min ago{other.length ? ` · also ordered: ${other.join(", ")}` : ""}</div>
          </div>
        </div>
        {(["Vascular lab", "Imaging", "Laboratory"] as const).map((dept) => {
          const os = tests.filter((o) => RESULT_FORMS[o].dept === dept);
          if (!os.length) return null;
          return (
            <Card key={dept} title={dept} className="mb14">
              {os.map((o) => {
                const c = crit(o);
                return (
                  <div key={o} style={{ borderBottom: "1px solid var(--line)", padding: "8px 0 12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <b className="sm">{o}</b>{complete(o) ? <Pill c="g">complete</Pill> : <Pill c="a">awaiting</Pill>}{c && <Pill c="r">critical</Pill>}
                      <button className="btn sm" style={{ marginLeft: "auto" }} disabled={!complete(o)} onClick={() => persist(o)}>Save result</button>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(190px,1fr))", gap: "4px 14px" }}>
                      {RESULT_FORMS[o].fields.map((f) => (
                        <div key={f.k} className="fld" style={f.type === "text" ? { gridColumn: "1 / -1" } : {}}>
                          <label>{f.label}{f.unit && <span className="xs mut"> ({f.unit})</span>}</label>
                          {f.type === "sel" ? (
                            <select value={vals[o]?.[f.k] ?? ""} onChange={(e) => setV(o, f.k, e.target.value)} aria-label={`${o} ${f.label}`}><option value="">Select…</option>{f.opts!.map((x) => <option key={x}>{x}</option>)}</select>
                          ) : (
                            <input value={vals[o]?.[f.k] ?? ""} inputMode={f.type === "num" ? "decimal" : undefined} onChange={(e) => setV(o, f.k, f.type === "num" ? e.target.value.replace(/[^\d.]/g, "").slice(0, 6) : e.target.value)} aria-label={`${o} ${f.label}`} />
                          )}
                        </div>
                      ))}
                    </div>
                    {c && (
                      <div className="disc" style={{ background: "var(--red-s)", borderColor: "#f1b5bf", color: "var(--red)", marginTop: 8, marginBottom: 0 }}>
                        <b>Critical: {c}.</b> Phone the doctor now (rule A05) and record who took the call.
                        <input className="cmp" style={{ marginTop: 6 }} placeholder="Told to (name and time)" value={informed[o] ?? ""} onChange={(e) => setInformed((x) => ({ ...x, [o]: e.target.value }))} aria-label={`${o} informed`} />
                      </div>
                    )}
                  </div>
                );
              })}
            </Card>
          );
        })}
      </div>
      <div className="sticky-side">
        <Card title="Back to the doctor" bodyClass="card-b">
          <div className="sm" style={{ lineHeight: 1.8 }}>{tests.map((o) => <div key={o}>{complete(o) ? "✓" : "○"} {o}{crit(o) && <b style={{ color: "var(--red)" }}> · critical</b>}</div>)}</div>
          <button className="btn p" style={{ width: "100%", padding: 11, marginTop: 12 }} disabled={pending.length > 0 || unphoned.length > 0} onClick={sendBack}>Send results to {r.doctor ?? "the doctor"}</button>
          {(pending.length > 0 || unphoned.length > 0) && <div className="xs mut" style={{ marginTop: 6 }}>Still needed: {[...pending.map((o) => `${o} result`), ...unphoned.map((o) => `who was told about the critical ${o}`)].join(", ")}.</div>}
          <div className="xs mut" style={{ marginTop: 8 }}>Cultures can go back as “pending”; the doctor sees them flagged. HbA1c, eGFR and WBC are copied into the open consultation.</div>
        </Card>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ dressing room & HBOT

function Room({ r, me, onDone }: { r: Registration; me: Staff; onDone: () => void }) {
  const k = r.consult!;
  const dressings = k.treatment?.dressings ?? [];
  const orders = ordersOf(r);
  const needHbot = orders.includes("HBOT assessment");
  const needDebride = orders.includes("Sharp debridement (dressing room)");
  const compression = dressings.some((d) => /compression/i.test(d.secondary));
  const npwt = dressings.some((d) => d.primary === "NPWT");
  const tcRes = (r.results ?? []).find((x) => x.order === "TcPO₂")?.values.tcpo2 ?? "";
  const [w, setW] = useState(dressings.map((d) => ({ wound: d.wound, plan: `${d.primary}${d.secondary ? ` + ${d.secondary}` : ""}, ${d.freq.toLowerCase()}`, applied: false, actual: "", painBefore: "", painAfter: "" })));
  const [checks, setChecks] = useState<string[]>([]);
  const [debridedBy, setDebridedBy] = useState("");
  const [edu, setEdu] = useState<string[]>([]);
  const [h, setH] = useState({ indication: "", absolute: [] as string[], relative: [] as string[], checks: [] as string[], tcpo2: tcRes, weeks: r.clinical.woundWeeks || "", perfusion: (k.abi.r ?? 0) >= 0.8 && (k.abi.l ?? 0) >= 0.8, sessions: "30", start: "", deferReason: "" });
  const wag = Math.max(0, ...(k.wounds ?? []).map((x) => x.wagner), k.wagner ?? 0) || null;
  const g = hbotGates({ indication: h.indication, wagner: wag, weeks: Math.round((Number(h.weeks) || 0)), perfusionOk: h.perfusion, tcpo2: Number(h.tcpo2) || 0, absolute: h.absolute });
  const abiMin = Math.min(k.abi.r ?? 9, k.abi.l ?? 9);
  const CHECKS = [compression && "Toes warm and pink after compression bandaging", npwt && "NPWT seal checked — no leak at −125 mmHg", needDebride && "Procedure consent confirmed"].filter(Boolean) as string[];

  const missing = [
    w.some((x) => !x.applied && x.actual.trim().length < 3) && "each dressing applied as planned (or what was done instead)",
    w.some((x) => x.painAfter === "") && "pain score after each dressing",
    CHECKS.some((c) => !checks.includes(c)) && "safety checks",
    compression && abiMin < 0.8 && "ABI ≥ 0.8 for compression — ask the doctor",
    needDebride && !debridedBy && "who performed the debridement",
    edu.length === 0 && "patient education",
    needHbot && !h.indication && "HBOT indication",
    needHbot && g.eligible && (!h.start || HBOT_CHECKS.some((c) => !h.checks.includes(c))) && "HBOT pre-course checks and start date",
    needHbot && !g.eligible && h.deferReason.trim().length < 4 && "why HBOT is deferred or declined",
  ].filter(Boolean) as string[];

  function complete() {
    const at = new Date().toISOString();
    const rec: ProcedureRecord = {
      at, by: me.name, wounds: w, checks, debridedBy: debridedBy || undefined, education: edu,
      hbot: needHbot ? {
        indication: h.indication, absolute: h.absolute, relative: h.relative, checks: h.checks, gates: g.gates, eligible: g.eligible,
        decision: g.eligible ? `Course planned: ${h.sessions} sessions from ${h.start}` : `Not started: ${h.deferReason}`,
        plan: g.eligible ? { sessions: Number(h.sessions), ata: "2.4 ATA", minutes: 90, start: h.start } : undefined,
      } : null,
    };
    setState((s) => ({ registrations: s.registrations.map((x) => (x.id === r.id ? { ...x, procedure: rec, status: "to checkout", history: [...(x.history ?? []), { at, by: me.name, text: `Dressing room done${rec.hbot ? ` · HBOT: ${rec.hbot.decision}` : ""} → checkout` }] } : x)) }));
    audit(me.name, "write", `${r.epi} ${r.name}`, `Procedure recorded · ${w.length} dressing(s)${rec.hbot ? ` · HBOT ${rec.hbot.eligible ? "eligible" : "not eligible"}` : ""}`);
    toast(`${r.name}: dressing room complete${rec.hbot ? `, HBOT ${rec.hbot.eligible ? "course planned" : "deferred"}` : ""}. Sent to checkout.`);
    onDone();
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 320px", gap: 14, alignItems: "start" }}>
      <div>
        <div className="phead" style={{ marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <div className="nm">{r.name} <span className="mut sm">{r.age} y · {r.sex}</span> {k.allergies && !/^(nkda|none)/i.test(k.allergies) && <Pill c="r">Allergy: {k.allergies}</Pill>}</div>
            <div className="mt">{r.token} · {r.mrn} · plan by {k.by} · ABI R {k.abi.r ?? "—"} L {k.abi.l ?? "—"}</div>
            <div className="sb" style={{ marginTop: 6 }}>{k.diagnoses.map((d) => d.label).join(" · ")}</div>
          </div>
        </div>

        <Card title="Dressings" hint="the doctor's plan · record what was done" className="mb14">
          {w.map((x, i) => (
            <div key={x.wound} style={{ borderBottom: "1px solid var(--line)", padding: "6px 0 10px" }}>
              <div className="sm"><b>Wound {x.wound}</b> · {x.plan}</div>
              <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", marginTop: 6 }}>
                <label className="check"><input type="checkbox" checked={x.applied} onChange={(e) => setW(w.map((y, j) => (j === i ? { ...y, applied: e.target.checked } : y)))} /> Applied as planned</label>
                {!x.applied && <input className="cmp" style={{ maxWidth: 300 }} placeholder="What was applied instead, and why" value={x.actual} onChange={(e) => setW(w.map((y, j) => (j === i ? { ...y, actual: e.target.value } : y)))} aria-label={`Wound ${x.wound} actual`} />}
                <span className="xs mut">Pain 0–10 before</span><input className="cmp" style={{ width: 54 }} inputMode="numeric" value={x.painBefore} onChange={(e) => setW(w.map((y, j) => (j === i ? { ...y, painBefore: e.target.value.replace(/\D/g, "").slice(0, 2) } : y)))} aria-label={`Wound ${x.wound} pain before`} />
                <span className="xs mut">after *</span><input className="cmp" style={{ width: 54 }} inputMode="numeric" value={x.painAfter} onChange={(e) => setW(w.map((y, j) => (j === i ? { ...y, painAfter: e.target.value.replace(/\D/g, "").slice(0, 2) } : y)))} aria-label={`Wound ${x.wound} pain after`} />
              </div>
            </div>
          ))}
          {compression && abiMin < 0.8 && <div className="disc" style={{ background: "var(--red-s)", color: "var(--red)", borderColor: "#f1b5bf" }}>ABI {abiMin.toFixed(2)}: do not apply full compression. Ask the doctor.</div>}
          {CHECKS.length > 0 && <div style={{ marginTop: 8 }}>{CHECKS.map((c) => <label key={c} className="check"><input type="checkbox" checked={checks.includes(c)} onChange={() => setChecks(toggle(checks, c))} /> {c} *</label>)}</div>}
          {needDebride && <div className="fld" style={{ maxWidth: 320, marginTop: 8 }}><label>Debridement performed by</label><select value={debridedBy} onChange={(e) => setDebridedBy(e.target.value)}><option value="">Select…</option>{STAFF.filter((s) => s.cls === "consultant" || s.cls === "trainee").map((s) => <option key={s.id}>{s.name}</option>)}</select></div>}
          <div className="xs mut" style={{ margin: "10px 0 4px" }}>Patient and family taught *</div>
          <div className="chipset">{EDUCATION.map((e) => <button key={e} className={edu.includes(e) ? "on" : ""} onClick={() => setEdu(toggle(edu, e))}>{e}</button>)}</div>
        </Card>

        {needHbot && (
          <Card title="HBOT assessment" hint="rule A25 candidacy gates · A26 glucose floor" className="mb14">
            <div className="fld"><label>Indication</label><select value={h.indication} onChange={(e) => setH({ ...h, indication: e.target.value })} aria-label="HBOT indication"><option value="">Select…</option>{HBOT_INDICATIONS.map((x) => <option key={x}>{x}</option>)}</select></div>
            <div className="grid2" style={{ gap: "0 16px", marginTop: 8 }}>
              <div className="fld"><label>Weeks of standard care so far</label><input inputMode="numeric" value={h.weeks} onChange={(e) => setH({ ...h, weeks: e.target.value.replace(/\D/g, "").slice(0, 3) })} aria-label="Weeks of standard care" /></div>
              <div className="fld"><label>Periwound TcPO₂ on air (mmHg){tcRes && " — from today's result"}</label><input inputMode="numeric" value={h.tcpo2} onChange={(e) => setH({ ...h, tcpo2: e.target.value.replace(/\D/g, "").slice(0, 3) })} aria-label="TcPO2" /></div>
            </div>
            <label className="check" style={{ marginTop: 6 }}><input type="checkbox" checked={h.perfusion} onChange={(e) => setH({ ...h, perfusion: e.target.checked })} /> Perfusion adequate (ABI ≥ 0.8) or already revascularised</label>
            <div className="xs mut" style={{ margin: "8px 0 4px" }}>Absolute contraindications</div>
            <div className="chipset">{HBOT_ABSOLUTE.map((x) => <button key={x} className={h.absolute.includes(x) ? "on red" : ""} onClick={() => setH({ ...h, absolute: toggle(h.absolute, x) })}>{x}</button>)}</div>
            <div className="xs mut" style={{ margin: "8px 0 4px" }}>Relative — manage before starting</div>
            <div className="chipset">{HBOT_RELATIVE.map((x) => <button key={x} className={h.relative.includes(x) ? "on" : ""} onClick={() => setH({ ...h, relative: toggle(h.relative, x) })}>{x}</button>)}</div>
            <table className="t cmp-t" style={{ marginTop: 10 }}><tbody>
              {g.gates.map((x) => <tr key={x.k}><td className="sm">{x.k}</td><td className="xs mut">{x.why}</td><td style={{ width: 90 }}>{x.ok ? <Pill c="g">met</Pill> : <Pill c="a">not met</Pill>}</td></tr>)}
            </tbody></table>
            {g.eligible ? (
              <>
                <div className="disc" style={{ background: "var(--green-s)", borderColor: "#9bd3b4", color: "var(--green)" }}>All gates met — eligible. Plan the course.</div>
                <div className="xs mut" style={{ marginBottom: 4 }}>Before the first session</div>
                {HBOT_CHECKS.map((c) => <label key={c} className="check"><input type="checkbox" checked={h.checks.includes(c)} onChange={() => setH({ ...h, checks: toggle(h.checks, c) })} /> {c}</label>)}
                <div className="grid2" style={{ gap: "0 16px", marginTop: 6 }}>
                  <div className="fld"><label>Sessions (2.4 ATA, 90 min, 5 a week)</label><select value={h.sessions} onChange={(e) => setH({ ...h, sessions: e.target.value })}>{["20", "30", "40"].map((x) => <option key={x}>{x}</option>)}</select></div>
                  <div className="fld"><label>Start date</label><input type="date" value={h.start} onChange={(e) => setH({ ...h, start: e.target.value })} aria-label="HBOT start" /></div>
                </div>
              </>
            ) : h.indication && (
              <div className="fld" style={{ marginTop: 8 }}><label className="req-l">Not eligible now — deferred or declined because</label><input value={h.deferReason} onChange={(e) => setH({ ...h, deferReason: e.target.value })} placeholder="e.g. book TcPO₂ first; revascularise first" aria-label="HBOT defer reason" /></div>
            )}
          </Card>
        )}
      </div>
      <div className="sticky-side">
        <Card title="Dressing room" bodyClass="card-b">
          <div className="sm" style={{ lineHeight: 1.8 }}>
            {w.map((x) => <div key={x.wound}>{x.applied ? "✓" : "○"} Wound {x.wound}{x.painAfter !== "" && <span className="xs mut"> · pain {x.painBefore || "?"}→{x.painAfter}</span>}</div>)}
            {needHbot && <div>HBOT: {g.eligible ? <Pill c="g">eligible</Pill> : h.indication ? <Pill c="a">not eligible yet</Pill> : <span className="xs mut">not assessed</span>}</div>}
          </div>
          <button className="btn p" style={{ width: "100%", padding: 11, marginTop: 12 }} disabled={missing.length > 0} onClick={complete}>Done — send to checkout</button>
          {missing.length > 0 && <div className="xs mut" style={{ marginTop: 6 }}>Still needed: {missing.join(", ")}.</div>}
        </Card>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ demo patients

export function demoAtTests(centre: string): Registration[] {
  const [a, b] = demoAssessed(centre);
  const ago = (m: number) => new Date(Date.now() - m * 60000).toISOString();
  return [
    { ...b, id: uid("REG"), name: "Rajendran K.", age: 66, token: "D-50", status: "at tests", doctor: "Dr. Meera Krishnan", seenAt: ago(70), testsAt: ago(50),
      consultDraft: { hpi: "Infected plantar ulcer, fever two days.", orders: ["CBC", "CRP / ESR", "Creatinine / eGFR", "Blood culture ×2", "X-ray foot (3 views)", "Sharp debridement (dressing room)"] } },
    { ...a, id: uid("REG"), name: "Anitha George", age: 49, sex: "Female", token: "V-51", status: "at tests", doctor: "Dr. Arun Nair", seenAt: ago(55), testsAt: ago(40),
      consultDraft: { hpi: "Calf claudication at 100 m, smoker.", orders: ["Arterial duplex — lower limb", "HbA1c", "Lipid profile"] } },
  ];
}

export function demoForProcedure(centre: string): Registration[] {
  const [, b, c] = demoAssessed(centre);
  const ago = (m: number) => new Date(Date.now() - m * 60000).toISOString();
  const base = (o: Partial<ConsultRecord>): ConsultRecord => ({
    at: ago(12), by: "Dr. Arun Nair", byRole: "Consultant vascular surgeon", hpi: "", duration: "", symptoms: [], pmh: [], meds: "", allergies: "NKDA", hba1c: "",
    pulses: { fem: { r: "Palpable", l: "Palpable" }, pop: { r: "Palpable", l: "Palpable" }, dp: { r: "Palpable", l: "Palpable" }, pt: { r: "Palpable", l: "Palpable" } },
    abi: { r: 0.95, l: 0.92, tbiR: null, tbiL: null }, diagnoses: [], orders: [], rx: [], alerts: [], plan: "", instructions: [], disposition: "Dressing room / procedure today", followUp: "1 week",
    hash: "demo" + Math.random().toString(16).slice(2, 10), countersign: "not needed", ...o,
  });
  return [
    { ...c, id: uid("REG"), name: "Lakshmi Devi", age: 71, sex: "Female", token: "W-52", status: "for procedure", clinical: { ...c.clinical, diabetes: "No" },
      consult: base({ diagnoses: [{ id: "vlu", code: "I83.0", label: "Venous leg ulcer", side: "left" }], treatment: { debridements: [], dressings: [{ wound: 1, primary: "Foam", secondary: "4-layer compression", freq: "Twice a week", by: "Clinic dressing room" }], offload: "" }, plan: "Four-layer compression in the dressing room today." }) },
    { ...b, id: uid("REG"), name: "Sundaram P.", age: 63, sex: "Male", token: "D-53", status: "for procedure", clinical: { ...b.clinical, allergies: "NKDA", woundWeeks: "8" },
      results: [{ order: "TcPO₂", dept: "Vascular lab", at: ago(30), by: "Vascular lab", values: { tcpo2: "28" }, critical: "TcPO₂ below 30 mmHg — poor healing potential", informed: "Dr. Arun Nair 10:05" }],
      consult: base({
        abi: { r: 0.88, l: 0.9, tbiR: null, tbiL: null }, wagner: 3,
        diagnoses: [{ id: "dfu-n", code: "E11.4 · L97", label: "Diabetic foot ulcer — neuropathic", side: "right" }],
        wounds: [{ n: 1, side: "right", site: "plantar heel", location: "Heel", length: 3, width: 2.5, depth: 1, area: 7.5, tissue: { granulation: 50, slough: 50, necrotic: 0, epithelial: 0 }, undermining: 0.5, tunnelling: 0, exposed: ["Tendon"], probeBone: false, periwound: ["Callus rim"], exudate: "Moderate", gangrene: "None", infection: { local: [], deep: [], erythemaCm: 0, grade: 1, label: "uninfected" }, wagner: 3, ut: "2A", photoIds: [] }],
        treatment: { debridements: [], dressings: [{ wound: 1, primary: "NPWT", secondary: "None", freq: "NPWT change 3× a week", by: "Clinic dressing room" }], offload: "Removable knee-high walker" },
        orders: ["HBOT assessment", "Sharp debridement (dressing room)"], plan: "Debride, start NPWT, assess for HBOT (8 weeks without progress).",
      }) },
  ];
}
