"use client";

// Step 4A: checkout. Patients the doctor sent home ("to checkout") are seen at the desk:
// book the next appointment in a real clinic slot, hand over the visit summary and
// prescription (Indian prescription format), send the letter to the referring doctor,
// arrange home dressing care, and settle the bill by payer. Rules: lib/cx/checkout.ts.

import { useState, type ReactNode } from "react";
import { Guard, Top, useMe } from "@/components/cx/Shell";
import { Card, Kpis, Modal, Pill, toast } from "@/components/cx/ui";
import {
  CLINICS, DAY, FOLLOW_DAYS, PAYMENT_MODES, SLOT_TIMES, billItems, clinicDates, clinicFor, fmtDate, inr, payerRule, referralLetter, slotTaken,
} from "@/lib/cx/checkout";
import { demoAssessed } from "@/app/clinical/consult/Consult";
import { ORDERS } from "@/lib/cx/consult";
import { currentLocation, hereRegs, placeAt } from "@/lib/cx/locations";
import { audit, setState, uid, useStore, type CheckoutRecord, type ConsultRecord, type Registration } from "@/lib/cx/store";
import { STAFF, type Staff } from "@/lib/cx/users";

const SCHEMES = ["Self-pay", "Ayushman Bharat PM-JAY", "CMCHIS / state scheme", "ESI", "CGHS", "Private insurance", "Corporate panel"];
const LETTER_VIA = ["Referral portal", "Email", "Printed — given to patient", "No referring doctor (self-referred)"];
const minsSince = (at?: string) => (at ? Math.max(0, Math.round((Date.now() - Date.parse(at)) / 60000)) : 0);
const today = () => new Date();
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

export function Checkout() {
  return (
    <Guard screen="checkout">
      <Top title="Checkout" sub="Step 4 · next appointment → visit summary and prescription → letter to the referring doctor → home care → bill and payment" />
      <div className="wrap"><Body /></div>
    </Guard>
  );
}

function Body() {
  const me = useMe();
  const st = useStore();
  const [sel, setSel] = useState<string | null>(null);
  const [view, setView] = useState<string | null>(null);
  const here = currentLocation(st, me);
  const regs = hereRegs(st, me);
  const queue = regs.filter((r) => r.status === "to checkout" && r.consult).sort((a, b) => a.consult!.at.localeCompare(b.consult!.at));
  const done = regs.filter((r) => r.status === "checked out" && r.checkout).sort((a, b) => b.checkout!.at.localeCompare(a.checkout!.at));
  const r = queue.find((x) => x.id === sel) ?? null;
  const collected = done.reduce((a, x) => a + (x.checkout!.bill.mode.startsWith("Credit") || x.checkout!.bill.mode.startsWith("Waived") ? 0 : x.checkout!.bill.payable), 0);

  function seed() {
    setState((s) => ({ registrations: [...placeAt(demoConsulted(here.centre), here.id), ...s.registrations] }));
    toast("Three patients seen by the doctor added to the checkout queue.");
  }

  return (
    <>
      <Kpis cols={4} items={[
        { k: "Waiting for checkout", v: queue.length, d: "sent home by the doctor", tone: queue.some((x) => minsSince(x.consult!.at) > 20) ? "warn" : "" },
        { k: "Longest wait", v: queue.length ? `${Math.max(...queue.map((x) => minsSince(x.consult!.at)))} min` : "—", d: "since the consultation was signed" },
        { k: "Checked out today", v: done.length, d: `${done.filter((x) => x.checkout!.appointment).length} with a follow-up booked` },
        { k: "Collected today", v: inr(collected), d: "UPI, cash and card" },
      ]} />

      <Card title="Waiting for checkout" hint="oldest first · click a row to start" className="mb14"
        right={<>{queue.length === 0 && <button className="btn sm v" onClick={seed}>Load demo patients</button>}</>}>
        {queue.length === 0 ? <div className="sm mut">Nobody is waiting. Patients appear here when the doctor chooses “Home · checkout & follow-up”{regs.length === 0 ? ", or load demo patients" : ""}.</div> : (
          <table className="t">
            <thead><tr><th>Token</th><th>Patient</th><th>Seen by</th><th>Follow-up asked</th><th>Payer</th><th>Waiting</th><th /></tr></thead>
            <tbody>
              {queue.map((x) => (
                <tr key={x.id} className={`clk${x.id === sel ? " on" : ""}`} onClick={() => setSel(x.id)}>
                  <td className="num" style={{ whiteSpace: "nowrap" }}><b>{x.token}</b></td>
                  <td className="sm"><b>{x.name}</b> <span className="xs mut">{x.age}{x.sex[0]} · {x.language}</span><div className="xs mut">{x.consult!.diagnoses[0]?.label ?? x.queueLabel}</div></td>
                  <td className="xs">{x.consult!.by}{x.consult!.countersign === "awaiting consultant" && <div style={{ color: "var(--amber)" }}>awaiting countersignature</div>}</td>
                  <td className="sm">{x.consult!.followUp || "—"}</td>
                  <td className="xs">{x.scheme}</td>
                  <td className="xs" style={{ color: minsSince(x.consult!.at) > 20 ? "var(--amber)" : undefined }}>{minsSince(x.consult!.at)} min</td>
                  <td style={{ textAlign: "right" }}><button className="btn sm p" onClick={(e) => { e.stopPropagation(); setSel(x.id); }}>{x.id === sel ? "Open" : "Start"}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {r ? <Form key={r.id} r={r} me={me} booked={st.appointments} onDone={() => setSel(null)} />
        : queue.length > 0 && <Card className="mb14"><div className="sm mut">Choose a patient above to start checkout.</div></Card>}

      <Card title="Checked out today" hint="click a row for the receipt and documents" right={<Pill c="g">{done.length}</Pill>}>
        {done.length === 0 ? <div className="sm mut">None yet.</div> : (
          <table className="t"><tbody>
            {done.map((x) => (
              <tr key={x.id} className="clk" onClick={() => setView(x.id)}>
                <td className="num sm" style={{ whiteSpace: "nowrap" }}><b>{x.token}</b></td>
                <td className="sm"><b>{x.name}</b><div className="xs mut">{x.checkout!.appointment ? `Next: ${fmtDate(x.checkout!.appointment.date)} ${x.checkout!.appointment.time} · ${x.checkout!.appointment.clinic}` : `No follow-up: ${x.checkout!.noFollowUpReason}`}</div></td>
                <td className="xs">{x.checkout!.bill.receipt}<div className="mut">{inr(x.checkout!.bill.payable)} · {x.checkout!.bill.mode}</div></td>
              </tr>
            ))}
          </tbody></table>
        )}
      </Card>

      {view && regs.find((x) => x.id === view)?.checkout && <DoneModal r={regs.find((x) => x.id === view)!} onClose={() => setView(null)} />}
    </>
  );
}

// ------------------------------------------------------------------ checkout form

type F = {
  clinic: string; date: string; time: string; noFollow: boolean; noFollowReason: string;
  docs: string[]; letterTo: string; letterVia: string; letter: string;
  homeCare: string[]; payer: string; mode: string;
};

function Form({ r, me, booked, onDone }: { r: Registration; me: Staff; booked: { date: string; clinic: string; time: string }[]; onDone: () => void }) {
  const k = r.consult!;
  const c0 = clinicFor(r);
  const target = addDays(today(), FOLLOW_DAYS[k.followUp] ?? 7);
  const [f, setF] = useState<F>(() => {
    const dates = clinicDates(c0.id, target, 1);
    return {
      clinic: c0.id, date: dates[0], time: "", noFollow: false, noFollowReason: "",
      docs: [], letterTo: r.referredBy ?? "", letterVia: r.referredBy ? "Referral portal" : "", letter: referralLetter(r, k, null, r.referredBy ?? ""),
      homeCare: [], payer: r.scheme, mode: "",
    };
  });
  const [doc, setDoc] = useState(false);
  const set = <K extends keyof F>(key: K, v: F[K]) => setF((x) => ({ ...x, [key]: v }));
  const clinic = CLINICS.find((c) => c.id === f.clinic)!;
  const dates = clinicDates(f.clinic, target, 6);
  const appt = !f.noFollow && f.date && f.time ? { date: f.date, time: f.time, clinic: clinic.name, doctor: clinic.doctor } : null;

  // bill
  const rule = payerRule(f.payer);
  const items = billItems(k, r.returning).map((i) => ({ ...i, covered: rule.covers(i.item) }));
  const total = items.reduce((a, i) => a + i.amount, 0);
  const payable = items.filter((i) => !i.covered).reduce((a, i) => a + i.amount, 0);
  const modes = payable > 0 ? PAYMENT_MODES.slice(0, 3) : [/CGHS|ESI|corporate/i.test(f.payer) ? PAYMENT_MODES[3] : PAYMENT_MODES[4]];
  const mode = modes.includes(f.mode) ? f.mode : payable > 0 ? "" : modes[0];

  // home care
  const dressings = k.treatment?.dressings ?? [];
  const byFamily = dressings.some((d) => /Family|Patient/.test(d.by));
  const byHomeNurse = dressings.some((d) => /Home-care/.test(d.by));
  const HOME = [
    byFamily && "Dressing supplies issued until the next visit",
    byFamily && "Family shown how to change the dressing",
    byHomeNurse && "Home-care nurse visit booked",
    k.treatment?.offload && k.treatment.offload !== "Not needed" && `${k.treatment.offload} fitted and checked`,
  ].filter(Boolean) as string[];

  const selfReferred = f.letterVia === LETTER_VIA[3];
  const missing = [
    !f.noFollow && !appt && "appointment slot",
    f.noFollow && f.noFollowReason.trim().length < 4 && "reason for no follow-up",
    f.docs.length === 0 && "visit summary handed over or sent",
    !f.letterVia && "letter to the referring doctor",
    f.letterVia && !selfReferred && f.letterTo.trim().length < 3 && "referring doctor's name",
    HOME.some((h) => !f.homeCare.includes(h)) && "home-care items",
    !mode && "payment mode",
  ].filter(Boolean) as string[];

  function complete() {
    const at = new Date().toISOString();
    const receipt = `RCPT-${r.centre}-${at.slice(2, 10).replace(/-/g, "")}-${uid("").slice(-4).toUpperCase()}`;
    const rec: CheckoutRecord = {
      at, by: me.name, appointment: appt, noFollowUpReason: f.noFollow ? f.noFollowReason : undefined,
      documents: f.docs, homeCare: f.homeCare,
      letter: selfReferred ? null : { to: f.letterTo, via: f.letterVia, text: f.letter },
      bill: { payer: f.payer, items, total, payable, mode, receipt, note: rule.note },
    };
    setState((s) => ({
      registrations: s.registrations.map((x) => (x.id === r.id ? { ...x, checkout: rec, status: "checked out", history: [...(x.history ?? []), { at, by: me.name, text: `Checked out${appt ? ` · next ${appt.date} ${appt.time} ${appt.clinic}` : ""} · ${receipt}` }] } : x)),
      appointments: appt ? [...s.appointments, { id: uid("APT"), regId: r.id, name: r.name, mrn: r.mrn, ...appt, at, by: me.name }] : s.appointments,
    }));
    audit(me.name, "write", `${r.epi} ${r.name}`, `Checkout complete · ${receipt} · ${inr(payable)} ${mode}${appt ? ` · follow-up ${appt.date} ${appt.time}` : ""}${rec.letter ? ` · letter via ${rec.letter.via}` : ""}`);
    toast(`${r.name} checked out.${appt ? ` Next visit ${fmtDate(appt.date)} at ${appt.time}. Reminder queued by SMS in ${r.language}.` : ""}`);
    onDone();
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 330px", gap: 14, alignItems: "start" }}>
      <div>
        <div className="phead" style={{ marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <div className="nm">{r.name} <span className="mut sm">{r.age} y · {r.sex}</span></div>
            <div className="mt">{r.token} · {r.mrn} · {r.queueLabel} · seen by {k.by} · {k.disposition}{k.followUp && ` · follow-up asked: ${k.followUp}`}</div>
            <div className="sb" style={{ marginTop: 6 }}>{k.diagnoses.map((d) => d.label).join(" · ")}</div>
          </div>
        </div>

        <Sec n={1} title="Next appointment" done={!!appt || (f.noFollow && f.noFollowReason.trim().length >= 4)} hint={k.followUp ? `doctor asked for ${k.followUp} → from ${fmtDate(target.toISOString().slice(0, 10))}` : undefined}>
          <div className="chipset" style={{ marginBottom: 10 }}>
            {CLINICS.map((c) => <button key={c.id} className={f.clinic === c.id ? "on" : ""} onClick={() => setF((x) => ({ ...x, clinic: c.id, date: clinicDates(c.id, target, 1)[0], time: "" }))}>{c.name}</button>)}
          </div>
          <div className="xs mut" style={{ marginBottom: 6 }}>{clinic.name} runs {clinic.days.map((d) => DAY[d]).join(", ")} · {clinic.doctor}</div>
          <div className="chipset" style={{ marginBottom: 10 }}>
            {dates.map((d) => <button key={d} className={f.date === d ? "on" : ""} onClick={() => setF((x) => ({ ...x, date: d, time: "" }))}>{fmtDate(d)}</button>)}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(8,minmax(0,1fr))", gap: 6 }}>
            {SLOT_TIMES.map((t) => {
              const taken = slotTaken(f.date, clinic.name, t, booked);
              return <button key={t} className={`btn sm${f.time === t ? " p" : ""}`} disabled={taken} onClick={() => set("time", t)} aria-label={`Slot ${t}${taken ? " (taken)" : ""}`} style={taken ? { textDecoration: "line-through" } : {}}>{t}</button>;
            })}
          </div>
          <label className="check" style={{ marginTop: 10 }}><input type="checkbox" checked={f.noFollow} onChange={(e) => set("noFollow", e.target.checked)} /> No follow-up needed (discharged from clinic)</label>
          {f.noFollow && <div className="fld" style={{ marginTop: 6 }}><label className="req-l">Reason</label><input value={f.noFollowReason} onChange={(e) => set("noFollowReason", e.target.value)} placeholder="e.g. healed, care returned to the family doctor" /></div>}
        </Sec>

        <Sec n={2} title="Visit summary and prescription" done={f.docs.length > 0} hint="Indian prescription format · generic names · doctor's registration number">
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button className="btn" onClick={() => setDoc(true)}>Preview visit summary & prescription</button>
            <span className="xs mut">{k.rx.length} medicine{k.rx.length === 1 ? "" : "s"} · {(k.medRec ?? []).filter((m) => m.action && m.action !== "Continue").length} change(s) to current medicines · {k.orders.length} investigation(s)</span>
          </div>
          {["Printed and handed to the patient", `Sent by SMS / WhatsApp (${r.language})`, "Uploaded to the patient's ABHA record"].map((d) => (
            <label key={d} className="check"><input type="checkbox" checked={f.docs.includes(d)} disabled={d.includes("ABHA") && !r.abha} onChange={() => set("docs", f.docs.includes(d) ? f.docs.filter((y) => y !== d) : [...f.docs, d])} /> {d}{d.includes("ABHA") && !r.abha && <span className="xs mut"> — no ABHA number on file</span>}</label>
          ))}
        </Sec>

        <Sec n={3} title="Letter to the referring doctor" done={!!f.letterVia && (selfReferred || f.letterTo.trim().length >= 3)}>
          <div className="grid2" style={{ gap: "0 16px" }}>
            <div className="fld"><label>Referring doctor</label><input value={f.letterTo} onChange={(e) => setF((x) => ({ ...x, letterTo: e.target.value, letter: referralLetter(r, k, appt, e.target.value) }))} placeholder="Name and clinic" /></div>
            <div className="fld"><label>Send by</label><select value={f.letterVia} onChange={(e) => set("letterVia", e.target.value)}><option value="">Select…</option>{LETTER_VIA.map((v) => <option key={v}>{v}</option>)}</select></div>
          </div>
          {!selfReferred && (
            <div className="fld" style={{ marginTop: 8 }}><label>Letter (written from the consultation — edit if needed)</label>
              <textarea value={f.letter} onChange={(e) => set("letter", e.target.value)} style={{ minHeight: 190, fontFamily: "var(--fm)", fontSize: 12 }} /></div>
          )}
          {!selfReferred && appt && !f.letter.includes("Next review") && <button className="btn sm" style={{ marginTop: 6 }} onClick={() => set("letter", referralLetter(r, k, appt, f.letterTo))}>Add the booked appointment to the letter</button>}
        </Sec>

        {HOME.length > 0 && (
          <Sec n={4} title="Home care" done={HOME.every((h) => f.homeCare.includes(h))} hint="from the doctor's dressing plan">
            <div className="xs mut" style={{ marginBottom: 6 }}>{dressings.map((d) => `Wound ${d.wound}: ${d.primary}${d.secondary ? ` + ${d.secondary}` : ""}, ${d.freq.toLowerCase()}, by ${d.by.toLowerCase()}`).join(" · ")}</div>
            {HOME.map((h) => <label key={h} className="check"><input type="checkbox" checked={f.homeCare.includes(h)} onChange={() => set("homeCare", f.homeCare.includes(h) ? f.homeCare.filter((y) => y !== h) : [...f.homeCare, h])} /> {h}</label>)}
          </Sec>
        )}

        <Sec n={HOME.length ? 5 : 4} title="Bill and payment" done={!!mode}>
          <div className="grid2" style={{ gap: "0 16px", marginBottom: 8 }}>
            <div className="fld"><label>Payer</label><select value={f.payer} onChange={(e) => setF((x) => ({ ...x, payer: e.target.value, mode: "" }))}>{SCHEMES.map((s) => <option key={s}>{s}</option>)}</select></div>
            <div className="fld"><label>Payment</label><select value={mode} onChange={(e) => set("mode", e.target.value)} disabled={payable === 0}>{payable > 0 && <option value="">Select…</option>}{modes.map((m) => <option key={m}>{m}</option>)}</select></div>
          </div>
          <div className="disc" style={{ marginTop: 0 }}>{rule.note}</div>
          <table className="t cmp-t">
            <tbody>
              {items.map((i) => <tr key={i.item}><td className="sm">{i.item}</td><td className="num sm" style={{ textAlign: "right" }}>{inr(i.amount)}</td><td style={{ width: 120 }}>{i.covered ? <Pill c="g">covered</Pill> : <Pill c="a">patient pays</Pill>}</td></tr>)}
              <tr><td className="sm"><b>Total</b></td><td className="num" style={{ textAlign: "right" }}><b>{inr(total)}</b></td><td /></tr>
              <tr><td className="sm"><b>Payable today</b></td><td className="num" style={{ textAlign: "right", color: payable ? "var(--ink)" : "var(--green)" }}><b>{inr(payable)}</b></td><td /></tr>
            </tbody>
          </table>
          <div className="xs mut" style={{ marginTop: 6 }}>Investigations ({k.orders.length}) are billed by the lab or imaging desk when they are done. Demo tariff.</div>
        </Sec>
      </div>

      <div className="sticky-side">
        <Card title="Checkout" bodyClass="card-b">
          <div className="sm" style={{ lineHeight: 1.8 }}>
            <div>Next visit: {appt ? <b>{fmtDate(appt.date)} · {appt.time}</b> : f.noFollow ? <span className="mut">none — discharged</span> : <span className="mut">not booked</span>}</div>
            {appt && <div className="xs mut">{appt.clinic} · {appt.doctor}</div>}
            <div>Payable: <b>{inr(payable)}</b> <span className="xs mut">of {inr(total)} · {f.payer}</span></div>
          </div>
          <button className="btn p" style={{ width: "100%", padding: 11, marginTop: 12 }} disabled={missing.length > 0} onClick={complete}>Complete checkout</button>
          {missing.length > 0 && <div className="xs mut" style={{ marginTop: 6 }}>Still needed: {missing.join(", ")}.</div>}
          <div className="xs mut" style={{ marginTop: 10 }}>The receipt number is issued on completion. The appointment goes into the clinic book and an SMS reminder is queued in {r.language}.</div>
        </Card>
      </div>

      {doc && (
        <Modal title="Visit summary & prescription" onClose={() => setDoc(false)} width={820}>
          <VisitDoc r={r} k={k} appt={appt} />
          <div className="noprint" style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button className="btn p" onClick={printDoc}>Print</button>
            <button className="btn" onClick={() => { if (!f.docs.includes("Printed and handed to the patient")) set("docs", [...f.docs, "Printed and handed to the patient"]); setDoc(false); }}>Mark as handed over</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Sec({ n, title, done, children, hint }: { n: number; title: string; done: boolean; children: ReactNode; hint?: string }) {
  return (
    <div className="card mb14">
      <div className="card-h"><h3><span style={{ color: done ? "var(--green)" : "var(--ink4)", marginRight: 6 }}>{done ? "✓" : n}</span>{title}</h3>{hint && <span className="hint">{hint}</span>}</div>
      <div className="card-b">{children}</div>
    </div>
  );
}

function printDoc() {
  document.body.classList.add("print-doc");
  window.print();
  setTimeout(() => document.body.classList.remove("print-doc"), 500);
}

// ------------------------------------------------------------------ printable visit summary & prescription

export function VisitDoc({ r, k, appt }: { r: Registration; k: ConsultRecord; appt: { date: string; time: string; clinic: string } | null }) {
  const doctor = STAFF.find((s) => s.name === k.by);
  const changes = (k.medRec ?? []).filter((m) => m.action && m.action !== "Continue");
  const referralItems = ORDERS.find((g) => g.g === "Treatment & referral")!.items;
  const tests = k.orders.filter((o) => !referralItems.includes(o)), referrals = k.orders.filter((o) => referralItems.includes(o));
  const sec = (t: string, body: ReactNode) => <div style={{ marginTop: 12 }}><div style={{ font: "700 11px/1 var(--f)", letterSpacing: ".08em", textTransform: "uppercase", color: "#445", borderBottom: "1px solid #ccd", paddingBottom: 4, marginBottom: 6 }}>{t}</div>{body}</div>;
  return (
    <div className="print-area" style={{ background: "#fff", color: "#111", padding: "18px 22px", border: "1px solid var(--line)", borderRadius: 6, fontSize: 13, lineHeight: 1.5 }}>
      <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "2px solid #0b6bcb", paddingBottom: 8 }}>
        <div><div style={{ font: "700 17px/1.2 var(--f)" }}>Demo Network — Vascular & Diabetic Foot Centre</div><div style={{ fontSize: 11, color: "#556" }}>Chennai · OPD: 044-0000 0000 (demo) · Emergency: 108</div></div>
        <div style={{ textAlign: "right", fontSize: 12 }}><b>{k.by}</b><div>{doctor?.quals}</div><div>Reg. No. {doctor?.reg ?? "—"}</div></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6, marginTop: 10, fontSize: 12 }}>
        <div><span style={{ color: "#667" }}>Patient</span><br /><b>{r.name}</b></div>
        <div><span style={{ color: "#667" }}>Age / sex</span><br />{r.age} / {r.sex}</div>
        <div><span style={{ color: "#667" }}>MRN</span><br />{r.mrn}{r.abha && <><br />ABHA {r.abha}</>}</div>
        <div><span style={{ color: "#667" }}>Date</span><br />{new Date(k.at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</div>
      </div>
      {k.allergies && !/^(nkda|none)/i.test(k.allergies) && <div style={{ marginTop: 8, padding: "4px 8px", border: "1px solid #c32b45", color: "#c32b45", fontWeight: 700, fontSize: 12 }}>ALLERGY: {k.allergies.toUpperCase()}</div>}
      {sec("Diagnosis", k.diagnoses.map((d) => `${d.label}${d.side ? ` (${d.side})` : ""}`).join("; "))}
      {sec("Findings", <>ABI right {k.abi.r ?? "—"}, left {k.abi.l ?? "—"}.{(k.wounds ?? []).map((w) => ` Wound ${w.n} (${w.side} ${w.site || w.location}): ${w.length} × ${w.width} cm.`)}</>)}
      {k.treatment && (k.treatment.debridements.length > 0 || k.treatment.dressings.length > 0) && sec("Treatment today and wound care at home", <>
        {k.treatment.debridements.length > 0 && <div>Debridement of wound {k.treatment.debridements.map((d) => d.wound).join(", ")} done today.</div>}
        {k.treatment.dressings.map((d) => <div key={d.wound}>Wound {d.wound}: {d.primary}{d.secondary ? ` + ${d.secondary}` : ""} — change {d.freq.toLowerCase()}, by {d.by.charAt(0).toLowerCase() + d.by.slice(1)}.</div>)}
        {k.treatment.offload && k.treatment.offload !== "Not needed" && <div>Offloading: {k.treatment.offload} — wear at all times when walking.</div>}
      </>)}
      {sec("Rx", k.rx.length === 0 ? <span>No new medicines.</span> : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead><tr style={{ textAlign: "left", color: "#556" }}><th>#</th><th>Medicine (generic)</th><th>Dose</th><th>Route</th><th>How often</th><th>For</th></tr></thead>
          <tbody>{k.rx.map((x, i) => <tr key={i} style={{ borderTop: "1px solid #e3e6ea" }}><td>{i + 1}</td><td><b>{x.drug.toUpperCase()}</b></td><td>{x.dose}</td><td>{x.route}</td><td>{x.freq}</td><td>{/^\d+$/.test(x.days) ? `${x.days} days` : x.days}</td></tr>)}</tbody>
        </table>
      ))}
      {changes.length > 0 && sec("Changes to your current medicines", changes.map((m) => <div key={m.drug}><b>{m.action.toUpperCase()}</b> {m.drug}{m.reason ? ` — ${m.reason}` : ""}</div>))}
      {tests.length > 0 && sec("Tests to be done", tests.join(", "))}
      {referrals.length > 0 && sec("Referrals and treatment booked", referrals.join(", "))}
      {r.procedure?.hbot && sec("Hyperbaric oxygen (HBOT)", r.procedure.hbot.plan ? `${r.procedure.hbot.plan.sessions} sessions at ${r.procedure.hbot.plan.ata}, ${r.procedure.hbot.plan.minutes} min, 5 a week, starting ${fmtDate(r.procedure.hbot.plan.start)}. Eat normally and take your diabetes medicines before each session; your sugar is checked before you go in.` : r.procedure.hbot.decision)}
      {k.instructions.length > 0 && sec("Instructions", <ul style={{ margin: 0, paddingLeft: 18 }}>{k.instructions.map((i) => <li key={i}>{i}</li>)}</ul>)}
      {sec("Come back at once if", "the foot or leg becomes cold, pale or blue · redness or swelling spreads · fever or chills · new black skin · pain suddenly worse. Call 108 in an emergency.")}
      {sec("Next visit", appt ? `${fmtDate(appt.date)} at ${appt.time} · ${appt.clinic}` : "To be booked at the desk")}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 26, fontSize: 11, color: "#667" }}>
        <span>Prototype document with demo data — not a valid prescription.</span>
        <span style={{ borderTop: "1px solid #999", paddingTop: 4, minWidth: 200, textAlign: "center" }}>{k.by} · {doctor?.reg}</span>
      </div>
    </div>
  );
}

function DoneModal({ r, onClose }: { r: Registration; onClose: () => void }) {
  const c = r.checkout!;
  const [tab, setTab] = useState<"receipt" | "summary" | "letter">("receipt");
  return (
    <Modal title={<>Checked out · <span className="num">{r.token}</span> · {r.name}</>} onClose={onClose} width={820}>
      <div className="tabs noprint">{(["receipt", "summary", "letter"] as const).map((t) => <button key={t} className={tab === t ? "on" : ""} onClick={() => setTab(t)} disabled={t === "letter" && !c.letter}>{t === "receipt" ? "Receipt" : t === "summary" ? "Visit summary & prescription" : "Letter"}</button>)}</div>
      {tab === "receipt" && (
        <div className="print-area" style={{ fontSize: 13 }}>
          <div className="xs mut">Receipt <b className="num">{c.bill.receipt}</b> · {new Date(c.at).toLocaleString("en-IN")} · {c.by}</div>
          <table className="t cmp-t" style={{ marginTop: 8 }}><tbody>
            {c.bill.items.map((i) => <tr key={i.item}><td className="sm">{i.item}</td><td className="num sm" style={{ textAlign: "right" }}>{inr(i.amount)}</td><td className="xs">{i.covered ? `covered by ${c.bill.payer}` : "paid by patient"}</td></tr>)}
            <tr><td><b>Paid today</b></td><td className="num" style={{ textAlign: "right" }}><b>{inr(c.bill.payable)}</b></td><td className="xs">{c.bill.mode}</td></tr>
          </tbody></table>
          <div className="xs mut" style={{ marginTop: 8 }}>{c.bill.note}</div>
          <div className="sm" style={{ marginTop: 10 }}>{c.appointment ? <>Next visit <b>{fmtDate(c.appointment.date)} at {c.appointment.time}</b> · {c.appointment.clinic} · {c.appointment.doctor}</> : `No follow-up: ${c.noFollowUpReason}`}</div>
          <div className="xs mut">Documents: {c.documents.join(" · ")}{c.homeCare.length ? ` · Home care: ${c.homeCare.join(", ")}` : ""}</div>
        </div>
      )}
      {tab === "summary" && <VisitDoc r={r} k={r.consult!} appt={c.appointment} />}
      {tab === "letter" && c.letter && <div className="print-area"><div className="xs mut" style={{ marginBottom: 6 }}>Sent to {c.letter.to} · {c.letter.via}</div><pre style={{ whiteSpace: "pre-wrap", font: "400 13px/1.55 var(--f)", margin: 0 }}>{c.letter.text}</pre></div>}
      <button className="btn sm noprint" style={{ marginTop: 10 }} onClick={printDoc}>Print</button>
    </Modal>
  );
}

// ------------------------------------------------------------------ demo: patients the doctor has sent home

export function demoConsulted(centre: string): Registration[] {
  const [a, b, c] = demoAssessed(centre);
  const at = (minAgo: number) => new Date(Date.now() - minAgo * 60000).toISOString();
  const base = (o: Partial<ConsultRecord>): ConsultRecord => ({
    at: at(8), by: "Dr. Meera Krishnan", byRole: "Consultant vascular surgeon", hpi: "", duration: "", symptoms: [], pmh: [], meds: "", allergies: "NKDA", hba1c: "",
    pulses: { fem: { r: "Palpable", l: "Palpable" }, pop: { r: "Palpable", l: "Palpable" }, dp: { r: "Palpable", l: "Palpable" }, pt: { r: "Palpable", l: "Palpable" } },
    abi: { r: 1.04, l: 1.02, tbiR: null, tbiL: null }, diagnoses: [], orders: [], rx: [], alerts: [], plan: "", instructions: [], disposition: "Home · checkout & follow-up",
    followUp: "1 week", hash: "demo" + Math.random().toString(16).slice(2, 10), countersign: "not needed", ...o,
  });
  const wound = (n: number, side: "right" | "left", site: string, location: string, l: number, w: number, grade: number, label: string, wag: number, ut: string) => ({
    n, side, site, location, length: l, width: w, depth: 0.3, area: +(l * w).toFixed(2), tissue: { granulation: 60, slough: 40, necrotic: 0, epithelial: 0 },
    undermining: 0, tunnelling: 0, exposed: [], probeBone: false, periwound: ["Callus rim"], exudate: "Moderate", gangrene: "None",
    infection: { local: [], deep: [], erythemaCm: 0, grade, label }, wagner: wag, ut, photoIds: [],
  });
  return [
    { ...b, id: uid("REG"), name: "Parvathi Iyer", age: 58, sex: "Female", token: "D-70", queue: "D", queueLabel: "Diabetic foot clinic", complaint: "Foot ulcer", scheme: "CMCHIS / state scheme",
      arrival: "Referral", referredBy: "Dr. K. Ramesh, Mylapore Family Clinic", language: "Tamil", status: "to checkout", clinical: { ...b.clinical, allergies: "NKDA" },
      consult: base({
        at: at(12), hpi: "Neuropathic ulcer under right 1st metatarsal head, 5 weeks.", allergies: "NKDA", hba1c: "8.9",
        diagnoses: [{ id: "dfu-n", code: "E11.4 · L97", label: "Diabetic foot ulcer — neuropathic", side: "right" }, { id: "dfi", code: "E11.6 · L08.9", label: "Diabetic foot infection", side: "right" }],
        wounds: [wound(1, "right", "plantar 1st metatarsal head", "Toes / forefoot", 2, 1.5, 2, "mild", 2, "1B")],
        treatment: { debridements: [{ wound: 1, method: "Sharp (scalpel / curette)", anaesthesia: "None needed (neuropathic)", removed: ["Callus", "Slough"], depthTo: "Subcutaneous", haemostasis: "Pressure", tolerated: "Well" }],
          dressings: [{ wound: 1, primary: "Silver dressing", secondary: "Gauze + crepe bandage", freq: "Alternate days", by: "Family (trained today)" }], offload: "Removable knee-high walker" },
        medRec: [{ drug: "Metformin", dose: "500 mg BD", action: "Continue", reason: "" }, { drug: "Glimepiride", dose: "2 mg OD", action: "Change dose", reason: "HbA1c 8.9 — increase to 3 mg, review with diabetologist" }],
        rx: [{ drug: "Amoxicillin-clavulanate", dose: "625 mg", route: "PO", freq: "TDS", days: "7" }, { drug: "Paracetamol", dose: "650 mg", route: "PO", freq: "QDS PRN", days: "5" }],
        orders: ["X-ray foot (3 views)", "HbA1c", "Diabetology"], plan: "Offload in knee-high walker, silver dressing alternate days by daughter, antibiotics 7 days, review in one week with X-ray.",
        instructions: ["Keep weight off the foot — use the offloading device at all times", "Check both feet daily; come back if redness, swelling, fever or new pain"],
      }) },
    { ...c, id: uid("REG"), name: "Joseph Mathew", age: 64, sex: "Male", token: "W-71", queue: "W", queueLabel: "Wound clinic", complaint: "Wound not healing", scheme: "Self-pay",
      arrival: "Walk-in", referredBy: undefined, language: "Malayalam", status: "to checkout", returning: false, clinical: { ...c.clinical, diabetes: "No" },
      consult: base({
        at: at(6), by: "Dr. Arun Nair", byRole: "Consultant vascular surgeon", hpi: "Left medial malleolus ulcer, 10 weeks, varicose veins.", allergies: "Sulfa drugs",
        diagnoses: [{ id: "vlu", code: "I83.0", label: "Venous leg ulcer", side: "left" }], abi: { r: 1.08, l: 1.05, tbiR: null, tbiL: null },
        wounds: [wound(1, "left", "medial malleolus", "Ankle / leg", 4, 3, 1, "uninfected", 1, "1A")],
        treatment: { debridements: [], dressings: [{ wound: 1, primary: "Foam", secondary: "4-layer compression", freq: "Twice a week", by: "Clinic dressing room" }], offload: "" },
        orders: ["Venous duplex (reflux study)"], rx: [{ drug: "Pentoxifylline", dose: "400 mg", route: "PO", freq: "TDS", days: "30" }],
        followUp: "1 week", plan: "Four-layer compression twice weekly in the dressing room, venous duplex, discuss ablation after duplex.",
        instructions: ["Raise the leg above heart level when resting"],
      }) },
    { ...a, id: uid("REG"), name: "Karthik Subbiah", age: 52, sex: "Male", token: "V-72", queue: "V", queueLabel: "Vascular OPD", complaint: "Leg pain when walking", scheme: "CGHS",
      arrival: "Referral", referredBy: "CGHS Wellness Centre, Anna Nagar", language: "Tamil", status: "to checkout", abha: "91-4412-8870-2231",
      consult: base({
        at: at(3), hpi: "Right calf claudication at 200 m for 6 months, no rest pain, no wounds.", abi: { r: 0.72, l: 0.95, tbiR: null, tbiL: null },
        diagnoses: [{ id: "pad", code: "I70.2", label: "Peripheral arterial disease with claudication", side: "right" }],
        pulses: { fem: { r: "Palpable", l: "Palpable" }, pop: { r: "Weak", l: "Palpable" }, dp: { r: "Absent", l: "Palpable" }, pt: { r: "Doppler only", l: "Palpable" } },
        rx: [{ drug: "Aspirin", dose: "75 mg", route: "PO", freq: "OD", days: "ongoing" }, { drug: "Atorvastatin", dose: "40 mg", route: "PO", freq: "HS", days: "ongoing" }, { drug: "Nicotine patch", dose: "14 mg/24 h", route: "TD", freq: "OD", days: "56" }],
        orders: ["Arterial duplex — lower limb", "Lipid profile"], followUp: "4 weeks", plan: "Best medical therapy, supervised walking 30 min daily, stop smoking, duplex before review.",
        instructions: ["Stop smoking — cessation service offered"],
      }) },
  ];
}
