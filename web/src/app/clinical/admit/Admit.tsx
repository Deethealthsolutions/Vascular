"use client";

// Step 4C: admission. Patients the doctor chose to admit ("awaiting admission") are taken
// through admission details, financial clearance by payer (scheme pre-authorisation, credit
// letter, cashless request or self-pay deposit), bed allocation on the live bed board
// (isolation → side rooms), consent and documents, and an SBAR handover to the ward.

import { useState, type ReactNode } from "react";
import { Guard, Top, useMe } from "@/components/cx/Shell";
import { Card, Kpis, Modal, Pill, toast } from "@/components/cx/ui";
import { SignaturePad } from "@/components/staff/SignaturePad";
import { DIETS, PACKAGES, PROCEDURES, UNITS, URGENCY, inr, occupancy, payerKind, suggestFromConsult } from "@/lib/cx/admit";
import { demoAssessed } from "@/app/clinical/consult/Consult";
import { audit, setState, uid, useStore, type AdmissionRecord, type ConsultRecord, type Registration } from "@/lib/cx/store";
import { STAFF, type Staff } from "@/lib/cx/users";

const SCHEMES = ["Self-pay", "Ayushman Bharat PM-JAY", "CMCHIS / state scheme", "ESI", "CGHS", "Private insurance", "Corporate panel"];
const DOCS = ["IP wristband printed and checked", "Attendant pass issued (one attendant)", "Belongings list signed", "Ward informed by phone"];
const minsSince = (at?: string) => (at ? Math.max(0, Math.round((Date.now() - Date.parse(at)) / 60000)) : 0);

export function Admit() {
  return (
    <Guard screen="admit">
      <Top title="Admission" sub="Step 4C · admission details → financial clearance → bed → consent and documents → handover to the ward" />
      <Body />
    </Guard>
  );
}

function Body() {
  const me = useMe();
  const st = useStore();
  const [sel, setSel] = useState<string | null>(null);
  const [view, setView] = useState<string | null>(null);
  const regs = st.registrations.filter((r) => me.centres.includes(r.centre as never));
  const queue = regs.filter((r) => r.status === "awaiting admission" && r.consult).sort((a, b) => a.consult!.at.localeCompare(b.consult!.at));
  const done = regs.filter((r) => r.status === "admitted" && r.admission);
  const occ = occupancy(st);
  const free = (u: (typeof UNITS)[number]) => u.beds.filter((b) => !occ[b]).length;
  const r = queue.find((x) => x.id === sel) ?? null;

  function seed() {
    setState((s) => ({ registrations: [...demoForAdmission(me.centres[0]), ...s.registrations] }));
    toast("Three patients the doctor decided to admit added to the queue.");
  }

  return (
    <>
      <Kpis cols={4} items={[
        { k: "Waiting for a bed", v: queue.length, d: "decision to admit made", tone: queue.some((x) => minsSince(x.consult!.at) > 120) ? "bad" : "" },
        { k: "Vascular ward", v: `${free(UNITS[0])} free`, d: `of ${UNITS[0].beds.length} beds · side rooms ${UNITS[0].side.filter((b) => !occ[b]).length} free` },
        { k: "Vascular ICU", v: `${free(UNITS[1])} free`, d: `of ${UNITS[1].beds.length} beds`, tone: free(UNITS[1]) === 0 ? "bad" : "" },
        { k: "Admitted today", v: done.length, d: "from the outpatient clinic" },
      ]} />

      <Card title="Waiting for admission" hint="decision-to-admit time · click a row to start" className="mb14"
        right={<>{queue.length === 0 && <button className="btn sm v" onClick={seed}>Load demo patients</button>}</>}>
        {queue.length === 0 ? <div className="sm mut">Nobody is waiting. Patients appear here when the doctor chooses “Admit to ward”{regs.length === 0 ? ", or load demo patients" : ""}.</div> : (
          <table className="t">
            <thead><tr><th>Token</th><th>Patient</th><th>Reason</th><th>Decided by</th><th>Payer</th><th>Waiting</th><th /></tr></thead>
            <tbody>
              {queue.map((x) => {
                const s = suggestFromConsult(x);
                return (
                  <tr key={x.id} className="clk" onClick={() => setSel(x.id)}>
                    <td className="num" style={{ whiteSpace: "nowrap" }}><b>{x.token}</b></td>
                    <td className="sm"><b>{x.name}</b> <span className="xs mut">{x.age}{x.sex[0]}</span><div className="xs">{s.urgency.startsWith("Emergency") ? <Pill c="r">emergency</Pill> : s.urgency.startsWith("Urgent") ? <Pill c="o">today</Pill> : <Pill>planned</Pill>}{s.isolation && <> <Pill c="a">isolation</Pill></>} {s.unit === "ICU" && <Pill c="r">ICU</Pill>}</div></td>
                    <td className="xs">{x.consult!.diagnoses.map((d) => d.label).slice(0, 2).join(" · ")}</td>
                    <td className="xs">{x.consult!.by}</td>
                    <td className="xs">{x.scheme}</td>
                    <td className="xs" style={{ color: minsSince(x.consult!.at) > 60 ? "var(--amber)" : undefined }}>{minsSince(x.consult!.at)} min</td>
                    <td style={{ textAlign: "right" }}><button className="btn sm p" onClick={(e) => { e.stopPropagation(); setSel(x.id); }}>{x.id === sel ? "Open" : "Start"}</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      {r ? <Form key={r.id} r={r} me={me} occ={occ} onDone={() => setSel(null)} />
        : queue.length > 0 && <Card className="mb14"><div className="sm mut">Choose a patient above to start the admission.</div></Card>}

      <Card title="Admitted today" hint="click a row for the admission record · also listed on the Ward round" right={<Pill c="o">{done.length}</Pill>}>
        {done.length === 0 ? <div className="sm mut">None yet.</div> : (
          <table className="t"><tbody>
            {done.map((x) => (
              <tr key={x.id} className="clk" onClick={() => setView(x.id)}>
                <td className="num sm" style={{ whiteSpace: "nowrap" }}><b>{x.admission!.bed}</b></td>
                <td className="sm"><b>{x.name}</b> <span className="xs mut">{x.admission!.ipNo}</span><div className="xs mut">{x.admission!.procedures.join(", ")}</div></td>
                <td className="xs">{x.admission!.consultant}<div className="mut">{x.admission!.payer.preauth.status}</div></td>
              </tr>
            ))}
          </tbody></table>
        )}
      </Card>

      {view && regs.find((x) => x.id === view)?.admission && <RecordModal r={regs.find((x) => x.id === view)!} onClose={() => setView(null)} />}
    </>
  );
}

// ------------------------------------------------------------------ admission form

type F = {
  unit: string; urgency: string; plannedDate: string; procedures: string[]; consultant: string; expectedDays: string;
  isolation: boolean; diet: string; risks: string[]; indication: string;
  scheme: string; packages: string[]; preauth: string; preauthRef: string; creditRef: string; counselled: boolean; deposit: string; mode: string;
  bed: string; consentSigned: boolean; docs: string[]; handover: string;
};

function Sec({ n, title, done, hint, children }: { n: number; title: string; done: boolean; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="card mb14">
      <div className="card-h"><h3><span style={{ color: done ? "var(--green)" : "var(--ink4)", marginRight: 6 }}>{done ? "✓" : n}</span>{title}</h3>{hint && <span className="hint">{hint}</span>}</div>
      <div className="card-b">{children}</div>
    </div>
  );
}

function sbar(r: Registration, k: ConsultRecord, f: Pick<F, "procedures" | "isolation" | "diet" | "risks">): string {
  const t = r.triage;
  const held = (k.medRec ?? []).filter((m) => m.action === "Hold" || m.action === "Stop").map((m) => `${m.drug} (${m.action.toLowerCase()}${m.reason ? `: ${m.reason}` : ""})`);
  return [
    `S — ${r.name}, ${r.age} ${r.sex}, admitted from ${r.queueLabel} under ${k.by}: ${k.diagnoses.map((d) => `${d.label}${d.side ? ` (${d.side})` : ""}`).join("; ")}.`,
    `B — ${k.pmh.join(", ") || "no significant past history recorded"}. Allergies: ${k.allergies || "none known"}.${held.length ? ` Medicines held/stopped: ${held.join("; ")}.` : ""}`,
    `A — NEWS2 ${t?.news ?? "—"} at assessment. ABI R ${k.abi.r ?? "—"} L ${k.abi.l ?? "—"}. ${(k.wounds ?? []).map((w) => `Wound ${w.n} ${w.side} ${w.site || w.location}: ${w.area} cm², IWGDF ${w.infection.grade}, Wagner ${w.wagner}`).join("; ")}${(k.limbs ?? []).filter((l) => l.stage).map((l) => `; ${l.side} WIfI stage ${l.stage}`).join("")}.`,
    `R — ${f.procedures.join(", ") || "as per plan"}. ${f.isolation ? "Contact precautions, side room. " : ""}Diet: ${f.diet}. ${f.risks.join(". ")}. New medicines: ${k.rx.map((x) => `${x.drug} ${x.dose} ${x.freq}`).join(", ") || "none"}.`,
  ].join("\n");
}

function Form({ r, me, occ, onDone }: { r: Registration; me: Staff; occ: Record<string, { name: string; from: string }>; onDone: () => void }) {
  const k = r.consult!;
  const [f, setF] = useState<F>(() => {
    const s = suggestFromConsult(r);
    const base = { procedures: s.procedures, isolation: s.isolation, diet: s.diet, risks: s.risks };
    const kind = payerKind(r.scheme);
    return {
      unit: s.unit, urgency: s.urgency, plannedDate: "", ...base, consultant: STAFF.find((x) => x.name === k.by && x.cls === "consultant")?.name ?? "Dr. Meera Krishnan",
      expectedDays: s.unit === "ICU" ? "7" : "5", indication: s.indication,
      scheme: r.scheme, packages: kind === "scheme" || kind === "self" || kind === "insurance" ? s.packages : [], preauth: "Not started", preauthRef: "", creditRef: "", counselled: false, deposit: "", mode: "",
      bed: "", consentSigned: false, docs: [], handover: sbar(r, k, base),
    };
  });
  const set = <K extends keyof F>(key: K, v: F[K]) => setF((x) => ({ ...x, [key]: v }));
  const unit = UNITS.find((u) => u.id === f.unit) ?? UNITS[0];
  const kind = payerKind(f.scheme);
  const emergency = f.urgency.startsWith("Emergency");
  const days = Math.max(1, Number(f.expectedDays) || 1);
  const estimate = f.packages.reduce((a, c) => { const p = PACKAGES.find((x) => x.code === c)!; return a + (/per day/.test(p.name) ? p.rate * days : p.rate); }, 0) + (kind === "self" ? days * (f.unit === "ICU" ? 9000 : 3500) : 0);
  const cleared = emergency || (kind === "scheme" && f.preauth === "Approved") || (kind === "insurance" && f.preauth === "Approved")
    || (kind === "credit" && f.creditRef.trim().length >= 3) || (kind === "self" && f.counselled && Number(f.deposit) > 0 && !!f.mode);
  const bedOk = !!f.bed && unit.beds.includes(f.bed as never) && !occ[f.bed] && (!f.isolation || (unit.side as readonly string[]).includes(f.bed));
  const missing = [
    f.procedures.length === 0 && "planned treatment",
    f.urgency.startsWith("Planned") && !f.plannedDate && "planned admission date",
    kind !== "credit" && f.packages.length === 0 && "package / estimate basis",
    !cleared && (kind === "scheme" ? "pre-authorisation approval (or mark as emergency)" : kind === "insurance" ? "cashless approval or deposit" : kind === "credit" ? "credit letter / referral number" : "financial counselling, deposit and payment mode"),
    !bedOk && (f.isolation ? "a free side-room bed" : "a free bed"),
    !f.consentSigned && "general consent for admission signed",
    !f.docs.includes(DOCS[0]) && "IP wristband",
    f.handover.trim().length < 20 && "handover note",
  ].filter(Boolean) as string[];

  function admit() {
    const at = new Date().toISOString();
    const ipNo = `IP-${r.centre}-${at.slice(2, 4)}-${uid("").slice(-5).toUpperCase()}`;
    const rec: AdmissionRecord = {
      at, by: me.name, ipNo, unit: unit.name, bed: f.bed, urgency: f.urgency, plannedDate: f.plannedDate || undefined,
      indication: f.indication, procedures: f.procedures, consultant: f.consultant, expectedDays: days, isolation: f.isolation, diet: f.diet, risks: f.risks,
      payer: {
        scheme: f.scheme, kind, packages: f.packages, estimate,
        preauth: { status: kind === "credit" ? "Credit letter received" : kind === "self" ? "Self-pay — deposit taken" : emergency && f.preauth !== "Approved" ? "Emergency — pre-authorisation due within 24 h" : f.preauth, ref: f.preauthRef || f.creditRef },
        deposit: Number(f.deposit) || 0, mode: f.mode, note: "",
      },
      documents: ["General consent for admission signed", ...f.docs], handover: f.handover,
    };
    setState((s) => ({
      registrations: s.registrations.map((x) => (x.id === r.id ? { ...x, admission: rec, status: "admitted", history: [...(x.history ?? []), { at, by: me.name, text: `Admitted to ${rec.bed} (${unit.name}) · ${ipNo}` }] } : x)),
    }));
    audit(me.name, "write", `${r.epi} ${r.name}`, `Admitted · ${ipNo} · ${rec.bed} · ${f.urgency} · ${rec.payer.preauth.status}`);
    toast(`${r.name} admitted to ${rec.bed}, ${unit.name}. ${ipNo}. Ward informed; handover sent.`);
    onDone();
  }

  const k2 = (xs: string[], v: string) => (xs.includes(v) ? xs.filter((y) => y !== v) : [...xs, v]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 330px", gap: 14, alignItems: "start" }}>
      <div>
        <div className="phead" style={{ marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <div className="nm">{r.name} <span className="mut sm">{r.age} y · {r.sex}</span> {k.allergies && !/^(nkda|none)/i.test(k.allergies) && <Pill c="r">Allergy: {k.allergies}</Pill>}</div>
            <div className="mt">{r.token} · {r.mrn} · decided by {k.by} {minsSince(k.at)} min ago · {r.scheme}</div>
            <div className="sb" style={{ marginTop: 6 }}>{k.diagnoses.map((d) => d.label).join(" · ")}</div>
          </div>
        </div>

        <Sec n={1} title="Admission details" done={f.procedures.length > 0 && (!f.urgency.startsWith("Planned") || !!f.plannedDate)} hint="suggested from the consultation">
          <div className="xs mut" style={{ marginBottom: 4 }}>Urgency</div>
          <div className="chipset" style={{ marginBottom: 8 }}>{URGENCY.map((u) => <button key={u} className={f.urgency === u ? (u.startsWith("Emergency") ? "on red" : "on") : ""} onClick={() => set("urgency", u)}>{u}</button>)}</div>
          {f.urgency.startsWith("Planned") && <div className="fld" style={{ maxWidth: 260, marginBottom: 8 }}><label className="req-l">Admission date</label><input type="date" value={f.plannedDate} onChange={(e) => set("plannedDate", e.target.value)} /></div>}
          <div className="xs mut" style={{ marginBottom: 4 }}>Unit</div>
          <div className="chipset" style={{ marginBottom: 8 }}>{UNITS.map((u) => <button key={u.id} className={f.unit === u.id ? "on" : ""} onClick={() => setF((x) => ({ ...x, unit: u.id, bed: "" }))}>{u.name}</button>)}</div>
          <div className="xs mut" style={{ marginBottom: 4 }}>Planned treatment</div>
          <div className="chipset" style={{ marginBottom: 8 }}>{PROCEDURES.map((p) => <button key={p} className={f.procedures.includes(p) ? "on" : ""} onClick={() => set("procedures", k2(f.procedures, p))}>{p}</button>)}</div>
          <div className="grid2" style={{ gap: "0 16px" }}>
            <div className="fld"><label>Consultant in charge</label><select value={f.consultant} onChange={(e) => set("consultant", e.target.value)}>{STAFF.filter((s) => s.cls === "consultant").map((s) => <option key={s.id}>{s.name}</option>)}</select></div>
            <div className="fld"><label>Expected stay (days)</label><input inputMode="numeric" value={f.expectedDays} onChange={(e) => set("expectedDays", e.target.value.replace(/\D/g, "").slice(0, 2))} /></div>
            <div className="fld"><label>Diet</label><select value={f.diet} onChange={(e) => set("diet", e.target.value)}>{DIETS.map((d) => <option key={d}>{d}</option>)}</select></div>
            <label className="check" style={{ alignSelf: "end", paddingBottom: 8 }}><input type="checkbox" checked={f.isolation} onChange={(e) => setF((x) => ({ ...x, isolation: e.target.checked, bed: "" }))} /> Isolation — contact precautions, side room{suggestFromConsult(r).isolation && <span className="xs" style={{ color: "var(--amber)" }}>&nbsp;(suggested: deep / moderate-severe infection)</span>}</label>
          </div>
          <div className="xs mut" style={{ margin: "8px 0 4px" }}>Risks flagged for the ward</div>
          {suggestFromConsult(r).risks.map((x) => <label key={x} className="check"><input type="checkbox" checked={f.risks.includes(x)} onChange={() => set("risks", k2(f.risks, x))} /> {x}</label>)}
        </Sec>

        <Sec n={2} title="Financial clearance" done={cleared} hint={f.scheme}>
          <div className="grid2" style={{ gap: "0 16px", marginBottom: 8 }}>
            <div className="fld"><label>Payer</label><select value={f.scheme} onChange={(e) => setF((x) => ({ ...x, scheme: e.target.value, preauth: "Not started", preauthRef: "" }))}>{SCHEMES.map((s) => <option key={s}>{s}</option>)}</select></div>
            <div className="sm" style={{ alignSelf: "end", paddingBottom: 10 }}>Estimate <b className="num">{inr(estimate)}</b> <span className="xs mut">for {days} day{days > 1 ? "s" : ""}{kind === "self" ? " incl. bed charges" : ""}</span></div>
          </div>
          {kind !== "credit" && (
            <>
              <div className="xs mut" style={{ marginBottom: 4 }}>{kind === "scheme" ? "Scheme packages (demo codes)" : "Estimate based on"}</div>
              <div className="chipset" style={{ marginBottom: 8 }}>{PACKAGES.map((p) => <button key={p.code} className={f.packages.includes(p.code) ? "on" : ""} onClick={() => set("packages", k2(f.packages, p.code))} title={p.code}>{p.name} · {inr(p.rate)}</button>)}</div>
            </>
          )}
          {(kind === "scheme" || kind === "insurance") && (
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <Pill c={f.preauth === "Approved" ? "g" : f.preauth === "Submitted" ? "b" : "a"}>{kind === "scheme" ? "Pre-authorisation" : "Cashless request"}: {f.preauth}</Pill>
              {f.preauth === "Not started" && <button className="btn sm" disabled={!f.packages.length} onClick={() => { set("preauth", "Submitted"); audit(me.name, "write", `${r.epi} ${r.name}`, `${kind === "scheme" ? "Pre-authorisation" : "Cashless request"} submitted: ${f.packages.join(", ")}`); }}>Submit {kind === "scheme" ? "to the scheme portal" : "to the TPA"}</button>}
              {f.preauth === "Submitted" && (<>
                <input className="cmp" style={{ maxWidth: 200 }} placeholder="Approval number" value={f.preauthRef} onChange={(e) => set("preauthRef", e.target.value)} aria-label="Approval number" />
                <button className="btn sm p" disabled={f.preauthRef.trim().length < 3} onClick={() => set("preauth", "Approved")}>Record approval</button>
              </>)}
            </div>
          )}
          {kind === "credit" && <div className="fld" style={{ maxWidth: 360 }}><label>{/ESI/.test(f.scheme) ? "ESI referral number" : /CGHS/.test(f.scheme) ? "CGHS permission / referral number" : "Company authorisation number"}</label><input value={f.creditRef} onChange={(e) => set("creditRef", e.target.value)} /></div>}
          {kind === "self" && (
            <div className="grid2" style={{ gap: "0 16px" }}>
              <label className="check"><input type="checkbox" checked={f.counselled} onChange={(e) => set("counselled", e.target.checked)} /> Estimate explained to the patient and family (financial counselling)</label>
              <div className="grid2" style={{ gap: "0 10px" }}>
                <div className="fld"><label>Deposit (₹)</label><input inputMode="numeric" value={f.deposit} onChange={(e) => set("deposit", e.target.value.replace(/\D/g, "").slice(0, 7))} placeholder={String(Math.round(estimate * 0.3))} /></div>
                <div className="fld"><label>Paid by</label><select value={f.mode} onChange={(e) => set("mode", e.target.value)}><option value="">Select…</option>{["UPI", "Card", "Cash", "Bank transfer"].map((m) => <option key={m}>{m}</option>)}</select></div>
              </div>
            </div>
          )}
          {emergency && <div className="xs" style={{ marginTop: 6, color: "var(--amber)" }}>Emergency admission: admit now — financial clearance is completed within 24 h and does not delay the bed.</div>}
        </Sec>

        <Sec n={3} title={`Bed — ${unit.name}`} done={bedOk} hint={f.isolation ? "isolation: side rooms only" : `${unit.beds.filter((b) => !occ[b]).length} free`}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(8,minmax(0,1fr))", gap: 6 }}>
            {unit.beds.map((b) => {
              const who = occ[b];
              const side = (unit.side as readonly string[]).includes(b);
              const blocked = !!who || (f.isolation && !side);
              return (
                <button key={b} className={`btn sm${f.bed === b ? " p" : ""}`} disabled={blocked} onClick={() => set("bed", b)} aria-label={`Bed ${b}${who ? " occupied" : ""}`}
                  style={{ padding: "8px 4px", flexDirection: "column", display: "flex", alignItems: "center", gap: 2, background: who ? "var(--surf2)" : undefined, borderStyle: side ? "dashed" : undefined }}>
                  <b className="num" style={{ fontSize: 11 }}>{b}</b>
                  <span className="xs" style={{ color: f.bed === b ? "#fff" : who ? "var(--ink3)" : "var(--green)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>{who ? who.name.split(" ").slice(-1)[0] : side ? "side room" : "free"}</span>
                </button>
              );
            })}
          </div>
          <div className="xs mut" style={{ marginTop: 6 }}>Dashed = side room. Occupancy combines the ward list and today&apos;s admissions.</div>
        </Sec>

        <Sec n={4} title="Consent and documents" done={f.consentSigned && f.docs.includes(DOCS[0])}>
          <div className="sm" style={{ marginBottom: 6 }}>General consent for admission, investigations and treatment, explained in {r.language}.</div>
          <div style={{ maxWidth: 520 }}><SignaturePad onChange={(s) => set("consentSigned", s)} /></div>
          <div style={{ marginTop: 8 }}>{DOCS.map((d) => <label key={d} className="check"><input type="checkbox" checked={f.docs.includes(d)} onChange={() => set("docs", k2(f.docs, d))} /> {d}{d === DOCS[0] && <b style={{ color: "var(--red)" }}> *</b>}</label>)}</div>
        </Sec>

        <Sec n={5} title="Handover to the ward (SBAR)" done={f.handover.trim().length >= 20} hint="written from the consultation · edit before sending">
          <div className="fld"><textarea value={f.handover} onChange={(e) => set("handover", e.target.value)} style={{ minHeight: 150, fontSize: 12.5 }} aria-label="Handover note" /></div>
          <button className="btn sm" style={{ marginTop: 6 }} onClick={() => set("handover", sbar(r, k, f))}>Rewrite from the current details</button>
        </Sec>
      </div>

      <div className="sticky-side">
        <Card title="Admission" bodyClass="card-b">
          <div className="sm" style={{ lineHeight: 1.8 }}>
            <div>{f.urgency.startsWith("Emergency") ? <Pill c="r">emergency</Pill> : f.urgency.startsWith("Urgent") ? <Pill c="o">today</Pill> : <Pill>planned{f.plannedDate && ` ${f.plannedDate}`}</Pill>} {f.isolation && <Pill c="a">isolation</Pill>}</div>
            <div>{unit.name} · bed <b>{f.bed || "—"}</b></div>
            <div>Under {f.consultant}</div>
            <div>Clearance: {cleared ? <Pill c="g">{emergency && kind !== "self" && f.preauth !== "Approved" && kind !== "credit" ? "emergency — due in 24 h" : "cleared"}</Pill> : <Pill c="a">pending</Pill>}</div>
            <div className="xs mut">Estimate {inr(estimate)} · {f.scheme}</div>
          </div>
          <button className="btn p" style={{ width: "100%", padding: 11, marginTop: 12 }} disabled={missing.length > 0} onClick={admit}>Admit to {f.bed || "bed"}</button>
          {missing.length > 0 && <div className="xs mut" style={{ marginTop: 6 }}>Still needed: {missing.join(", ")}.</div>}
          <div className="xs mut" style={{ marginTop: 10 }}>An IP number is issued on admission. The patient appears on the Ward round list and the bed board.</div>
        </Card>
      </div>
    </div>
  );
}

function RecordModal({ r, onClose }: { r: Registration; onClose: () => void }) {
  const a = r.admission!;
  const row = (l: string, v: ReactNode) => <tr key={l}><td className="xs mut" style={{ width: 150, verticalAlign: "top" }}>{l}</td><td className="sm">{v}</td></tr>;
  return (
    <Modal title={<>Admission · {a.ipNo} · {r.name}</>} onClose={onClose} width={760}>
      <table className="t cmp-t"><tbody>
        {row("Bed", `${a.bed} · ${a.unit}${a.isolation ? " · isolation" : ""}`)}
        {row("Urgency", `${a.urgency}${a.plannedDate ? ` · ${a.plannedDate}` : ""}`)}
        {row("Consultant", a.consultant)}
        {row("Planned treatment", a.procedures.join(", "))}
        {row("Payer", `${a.payer.scheme} · ${a.payer.preauth.status}${a.payer.preauth.ref ? ` (${a.payer.preauth.ref})` : ""} · estimate ${inr(a.payer.estimate)}${a.payer.deposit ? ` · deposit ${inr(a.payer.deposit)} ${a.payer.mode}` : ""}`)}
        {row("Diet / risks", `${a.diet} · ${a.risks.join("; ")}`)}
        {row("Documents", a.documents.join(" · "))}
        {row("Handover", <pre style={{ whiteSpace: "pre-wrap", margin: 0, font: "400 12.5px/1.55 var(--f)" }}>{a.handover}</pre>)}
        {row("Admitted", `${new Date(a.at).toLocaleString("en-IN")} by ${a.by}`)}
      </tbody></table>
    </Modal>
  );
}

// ------------------------------------------------------------------ demo: patients the doctor decided to admit

export function demoForAdmission(centre: string): Registration[] {
  const [a, b, c] = demoAssessed(centre);
  const at = (m: number) => new Date(Date.now() - m * 60000).toISOString();
  const consult = (o: Partial<ConsultRecord>): ConsultRecord => ({
    at: at(20), by: "Dr. Meera Krishnan", byRole: "Consultant vascular surgeon", hpi: "", duration: "", symptoms: [], pmh: ["Diabetes", "Hypertension"], meds: "", allergies: "NKDA", hba1c: "",
    pulses: { fem: { r: "Palpable", l: "Palpable" }, pop: { r: "Palpable", l: "Weak" }, dp: { r: "Palpable", l: "Absent" }, pt: { r: "Palpable", l: "Absent" } },
    abi: { r: 1.0, l: 0.38, tbiR: null, tbiL: null }, diagnoses: [], orders: [], rx: [], alerts: [], plan: "", instructions: [], disposition: "Admit to ward", followUp: "",
    hash: "demo" + Math.random().toString(16).slice(2, 10), countersign: "not needed", ...o,
  });
  const wound = (n: number, side: "right" | "left", site: string, location: string, area: number, grade: number, label: string, wagner: number, deep: string[] = []) => ({
    n, side, site, location, length: area, width: 1, depth: 0.5, area, tissue: { granulation: 20, slough: 40, necrotic: 40, epithelial: 0 }, undermining: 0, tunnelling: 0,
    exposed: deep.length ? ["Bone"] : [], probeBone: deep.length > 0, periwound: ["Erythema"], exudate: "Moderate", gangrene: grade === 1 ? "Digits only" : "None",
    infection: { local: [], deep, erythemaCm: grade >= 3 ? 4 : 0, grade, label }, wagner, ut: grade >= 2 ? "3D" : "1C", photoIds: [],
  });
  return [
    { ...a, id: uid("REG"), name: "Murugan Pillai", age: 69, token: "V-60", scheme: "Ayushman Bharat PM-JAY", schemeId: "PMJAY-DEMO-4411", status: "awaiting admission",
      consult: consult({
        at: at(35), diagnoses: [{ id: "clti", code: "I70.2", label: "Chronic limb-threatening ischaemia", side: "left" }, { id: "gangrene", code: "I70.2 · R02", label: "Gangrene of toe(s)", side: "left" }],
        wounds: [wound(1, "left", "great toe", "Toes / forefoot", 1.5, 1, "uninfected", 4)], limbs: [{ side: "left", w: 2, i: 3, fi: 0, stage: 4, risk: "high" }],
        orders: ["CT angiography — lower limb", "Creatinine / eGFR", "Vascular MDT — revascularisation"], medRec: [{ drug: "Warfarin", dose: "3 mg", action: "Hold", reason: "INR check, bridge before angiography" }],
        rx: [{ drug: "Atorvastatin", dose: "40 mg", route: "PO", freq: "HS", days: "ongoing" }], plan: "Admit for CT angiography and angioplasty; keep toe dry.",
      }) },
    { ...b, id: uid("REG"), name: "Fathima Beevi", age: 60, token: "D-61", scheme: "CMCHIS / state scheme", status: "awaiting admission", clinical: { ...b.clinical, allergies: "NKDA" },
      triage: { ...b.triage!, news: 6, vitals: { ...b.triage!.vitals, temp: 38.9, hr: 112, rr: 22 }, infection: "severe", flags: ["Sepsis screen positive", "Severe foot infection"] },
      consult: consult({
        at: at(15), abi: { r: 0.98, l: 1.02, tbiR: null, tbiL: null }, pulses: { fem: { r: "Palpable", l: "Palpable" }, pop: { r: "Palpable", l: "Palpable" }, dp: { r: "Palpable", l: "Palpable" }, pt: { r: "Palpable", l: "Palpable" } },
        diagnoses: [{ id: "dfi", code: "E11.6 · L08.9", label: "Diabetic foot infection", side: "right" }, { id: "osteo", code: "M86.9", label: "Osteomyelitis of foot (suspected)", side: "right" }],
        wounds: [wound(1, "right", "plantar forefoot", "Toes / forefoot", 6, 4, "severe (O)", 3, ["Abscess", "Osteomyelitis"])], limbs: [{ side: "right", w: 2, i: 0, fi: 3, stage: 4, risk: "high" }],
        orders: ["Blood culture ×2", "CBC", "CRP / ESR", "MRI foot"], rx: [], plan: "Sepsis: admit now, IV antibiotics after cultures, surgical drainage and debridement tonight.",
      }) },
    { ...c, id: uid("REG"), name: "Suresh Menon", age: 55, token: "D-62", queueLabel: "Diabetic foot clinic", scheme: "Self-pay", status: "awaiting admission", clinical: { ...c.clinical, diabetes: "Yes", dmYears: "9" },
      consult: consult({
        at: at(10), by: "Dr. Arun Nair", abi: { r: 1.05, l: 1.1, tbiR: null, tbiL: null }, pulses: { fem: { r: "Palpable", l: "Palpable" }, pop: { r: "Palpable", l: "Palpable" }, dp: { r: "Palpable", l: "Palpable" }, pt: { r: "Palpable", l: "Palpable" } },
        diagnoses: [{ id: "osteo", code: "M86.9", label: "Osteomyelitis of foot (suspected)", side: "left" }],
        wounds: [wound(1, "left", "2nd toe", "Toes / forefoot", 1, 3, "moderate (O)", 3, ["Osteomyelitis"])], limbs: [{ side: "left", w: 2, i: 0, fi: 2, stage: 3, risk: "moderate" }],
        orders: ["X-ray foot (3 views)"], plan: "Planned admission for 2nd toe amputation.",
      }) },
  ];
}
