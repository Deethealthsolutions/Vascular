"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Guard, Top, useMe } from "@/components/cx/Shell";
import { Card, Dot, Kpis, Modal, NewsBadge, Pill, Prog, toast } from "@/components/cx/ui";
import { ACU, CENTRES, CLIN, NET, OPD, PROF, SITEC, SITENAME, alertsFor, n1, type Patient } from "@/lib/cx/data";
import { DAYCASE, ED, FOLLOWUPS, OUTCOMES } from "@/lib/cx/extra";
import { audit, openPending, setState, useStore, type State } from "@/lib/cx/store";

export type Care = "ip" | "op" | "ed" | "dc";

export function latestObs(st: State, pid: string) {
  return st.obs.filter((o) => o.pid === pid).sort((a, b) => b.at.localeCompare(a.at))[0];
}
export function latestNews(st: State, p: Patient) {
  return latestObs(st, p.id)?.news ?? p.v.news2[71];
}

export function Round({ care, centre }: { care: Care; centre: string }) {
  const me = useMe();
  const scope = me.centres.length < 3 && (centre === "all" || !me.centres.includes(centre as never)) ? me.centres[0] : centre;
  const where = scope === "all" ? "all three centres" : SITENAME[scope];
  const label = { ip: "In-patients", op: "Out-patients · clinics, follow-up safety net and chamber courses", ed: "Emergency attendances", dc: "Day-case procedures" }[care];
  return (
    <Guard screen="round">
      <Top title="Ward round & clinics" sub={`${label} · ${where}`} />
      <div className="wrap"><Body care={care} centre={scope} /></div>
    </Guard>
  );
}

function Body({ care, centre }: { care: Care; centre: string }) {
  const st = useStore();
  const me = useMe();
  const discharged = new Set(Object.entries(st.adt).filter(([, a]) => a.discharged).map(([k]) => k));
  const inScope = (c: string) => (centre === "all" ? me.centres.includes(c as never) : c === centre);
  const ipRows = NET.roster.filter((r) => inScope(r.site) && !discharged.has(r.id));
  const opRows = OPD.upcoming.filter((u) => u.date === OPD.nextClinicDate && inScope(u.centre));
  const href = (o: { care?: Care; centre?: string }) => `/clinical/round?care=${o.care ?? care}&centre=${(o.centre ?? centre).toLowerCase()}`;

  const tabs: [Care, string, string][] = [
    ["ip", "In-patients", `${ipRows.length} admitted now`],
    ["op", "Out-patients", `${opRows.length} booked ${OPD.nextClinicDay}`],
    ["ed", "Emergency", `${ED.filter((e) => inScope(e.centre)).length} in the department`],
    ["dc", "Day-case", `${DAYCASE.filter((d) => inScope(d.centre)).length} on today's list`],
  ];

  return (
    <>
      <div className="seg mb14" style={{ width: "100%", display: "flex" }}>
        {tabs.map(([k, t, d]) => (
          <Link key={k} href={href({ care: k })} scroll={false}
            style={{ flex: 1, textAlign: "left", padding: "9px 13px", borderRadius: 4, textDecoration: "none", color: "var(--ink)", background: care === k ? "var(--surf)" : "none", boxShadow: care === k ? "var(--sh)" : "none" }}>
            <b style={{ fontSize: 12 }}>{t}</b><div className="xs mut" style={{ marginTop: 2 }}>{d}</div>
          </Link>
        ))}
      </div>

      <CentreCards care={care} centre={centre} href={href} />

      {care === "ip" && (centre === "all" || centre === "CHN") && me.centres.includes("CHN") ? <ChennaiRound /> : null}
      {care === "ip" && centre !== "all" && centre !== "CHN" && <Remote c={centre} />}
      {care === "ip" && centre === "all" && !me.centres.includes("CHN") && me.centres.map((c) => <Remote key={c} c={c} />)}
      {care === "ip" && <OpdAdmissions />}
      {care === "ip" && <DischargedToday />}
      {care === "op" && <Clinic centre={centre} />}
      {care === "ed" && <EdList inScope={inScope} />}
      {care === "dc" && <DayCaseList inScope={inScope} />}
    </>
  );
}

/** Patients admitted today from the outpatient clinic (Step 4C) — not in the ward fixture yet. */
function OpdAdmissions() {
  const st = useStore();
  const me = useMe();
  const rows = st.registrations.filter((r) => r.status === "admitted" && r.admission && me.centres.includes(r.centre as never));
  if (!rows.length) return null;
  return (
    <Card title="Admitted today from the outpatient clinic" hint="new in-patients · full ward charting starts on the ward" right={<Pill c="o">{rows.length}</Pill>} className="mb14">
      <table className="t"><thead><tr><th>Bed</th><th>Patient</th><th>Reason</th><th>Plan</th><th>Consultant</th><th>Payer</th></tr></thead><tbody>
        {rows.map((r) => (
          <tr key={r.id}>
            <td className="num"><b>{r.admission!.bed}</b>{r.admission!.isolation && <div><Pill c="a">isolation</Pill></div>}</td>
            <td className="sm"><b>{r.name}</b> <span className="xs mut">{r.age}{r.sex[0]} · {r.admission!.ipNo}</span></td>
            <td className="xs">{r.consult?.diagnoses.map((d) => d.label).join(" · ")}</td>
            <td className="xs">{r.admission!.procedures.join(", ")}</td>
            <td className="xs">{r.admission!.consultant}</td>
            <td className="xs">{r.admission!.payer.preauth.status}</td>
          </tr>
        ))}
      </tbody></table>
    </Card>
  );
}

function CentreCards({ care, centre, href }: { care: Care; centre: string; href: (o: { care?: Care; centre?: string }) => string }) {
  const me = useMe();
  const st = useStore();
  const list = CENTRES.filter((c) => me.centres.includes(c));
  return (
    <Card title="Hospital centres" hint={care === "op" ? "out-patient activity by location" : "census by location · click to scope the list"}
      right={me.centres.length === 3 ? <Link className={`btn sm${centre === "all" ? " v" : ""}`} href={href({ centre: "all" })}>All centres</Link> : <Pill c="a">Scoped to {me.centres.map((c) => SITENAME[c]).join(", ")}</Pill>}
      className="mb14">
      <div className="zgrid" style={{ gridTemplateColumns: `repeat(${list.length},minmax(0,1fr))` }}>
        {list.map((c) => {
          const rows = NET.roster.filter((r) => r.site === c && !st.adt[r.id]?.discharged);
          const hi = rows.filter((r) => r.news2 >= 5 || r.aki >= 2).length;
          const icu = rows.filter((r) => r.unit === "ICU").length;
          const P = PROF.byCentre[c], O = OPD.byCentre[c];
          const dna = Object.entries(st.attendance).filter(([id, a]) => a.status === "dna" && OPD.upcoming.find((u) => u.id === id)?.centre === c).length;
          const lines: [string, string | number, string][] = care === "op"
            ? [["Seen in 90 days", O.attended, ""], ["Did not attend", O.dnaPct + "%", O.dnaPct > 12 ? "var(--red)" : O.dnaPct > 10 ? "var(--amber)" : ""],
              ["DNA recorded today", dna, dna ? "var(--amber)" : ""], ["HBOT courses", O.hbotActive, ""], ["Overdue follow-ups", O.overdue, O.overdue > 4 ? "var(--amber)" : ""], ["Admitted from clinic", O.admittedFromClinic, ""]]
            : [["Needs review", hi, hi ? (hi > 3 ? "var(--red)" : "var(--amber)") : ""], ["ICU / ward", `${icu} / ${rows.length - icu}`, ""],
              ["Referred in", P.inbound, P.inbound ? "var(--blue)" : ""], ["Out to another centre", P.outbound, ""],
              ["Emergency now", ED.filter((e) => e.centre === c).length, ""], ["Day-cases today", DAYCASE.filter((d) => d.centre === c).length, ""]];
          return (
            <Link key={c} href={href({ centre: c })} className={`zc${centre === c ? " on" : ""}`} style={{ textDecoration: "none", color: "inherit" }}>
              <div className="h"><span className="n"><Dot c={SITEC[c]} /> {SITENAME[c]}</span><span className="v">{care === "op" ? O.todayBooked : rows.length}</span></div>
              <div className="xs mut" style={{ marginTop: 3 }}>{P.city}, {P.state}{care === "op" ? " · booked next session" : ""}</div>
              <table className="t" style={{ marginTop: 8 }}><tbody>
                {lines.map(([k, v, col]) => (
                  <tr key={k}><td className="xs mut" style={{ padding: "2px 0", border: 0 }}>{k}</td>
                    <td className="num xs" style={{ padding: "2px 0", border: 0, textAlign: "right", color: col || undefined, fontWeight: col ? 600 : undefined }}>{v}</td></tr>
                ))}
              </tbody></table>
            </Link>
          );
        })}
      </div>
      {care === "ip" && (
        <div className="sm" style={{ color: "var(--ink2)", lineHeight: 1.65, marginTop: 12 }}>
          <b>{PROF.totals.referrals} patients are being treated away from the centre they are registered at.</b> Their history sits under the home centre&apos;s record, which is exactly the case where a single patient master earns its keep.
        </div>
      )}
    </Card>
  );
}

function ChennaiRound() {
  const st = useStore();
  const router = useRouter();
  const ord: Record<string, number> = { critical: 0, deteriorating: 1, watch: 2, stable: 3, improving: 4 };
  const ps = CLIN.patients.filter((p) => !st.adt[p.id]?.discharged)
    .sort((a, b) => ord[a.acuity] - ord[b.acuity] || latestNews(st, b) - latestNews(st, a));
  const allAlerts = ps.flatMap((p) => alertsFor(p, latestNews(st, p)));
  return (
    <>
      <Kpis items={[
        { k: "On the unit", v: ps.length, d: "Chennai · Vascular & Diabetic Foot" },
        { k: "Need review now", v: ps.filter((p) => latestNews(st, p) >= 5 || p.aki >= 2).length, d: "NEWS2 ≥ 5 or AKI stage ≥ 2", tone: "bad" },
        { k: "Awaiting sign-off", v: openPending(st).filter((s) => s.kind === "clinical").length, d: "countersignature or authorisation", tone: "warn" },
        { k: "Open automation alerts", v: allAlerts.length, d: "across all patients", tone: "warn" },
      ]} />
      <Card title="Ward round — ordered by acuity" hint="rule A21 · the patient who needs you first appears first, not the lowest bed number" bodyClass={null}>
        {ps.map((p) => {
          const n = latestNews(st, p), al = alertsFor(p, n), ac = ACU[p.acuity];
          const unread = p.notes.filter((x) => x.h >= 48).length;
          const lo = latestObs(st, p.id);
          return (
            <div key={p.id} className="pt-row" onClick={() => router.push(`/clinical/patient/${p.id}`)}>
              <NewsBadge n={n} />
              <div>
                <div className="pt-n">{p.name} <span className="mut xs">{p.age}{p.sex} · {st.adt[p.id]?.bed ?? p.bed} · day {p.los}</span>
                  <Pill c={ac[0]}>{ac[1]}</Pill>
                  {al.slice(0, 3).map((a) => <Pill key={a.short} c={a.sev}>{a.short}</Pill>)}
                  {al.length > 3 && <Pill>+{al.length - 3}</Pill>}
                </div>
                <div className="pt-d">{p.dx}{lo && <> · <b style={{ color: "var(--ink2)" }}>new obs {lo.at.slice(11)} by {lo.by}</b></>}</div>
              </div>
              <div className="pt-r">
                {unread > 0 && <Pill c="b">{unread} new note{unread > 1 ? "s" : ""}</Pill>}
                <span className="xs mut">eGFR {p.labs[3].egfr} · TIR {p.tir}%</span>
              </div>
            </div>
          );
        })}
      </Card>
    </>
  );
}

function Remote({ c }: { c: string }) {
  const st = useStore();
  const rows = NET.roster.filter((r) => r.site === c && !st.adt[r.id]?.discharged).sort((a, b) => b.news2 - a.news2);
  const P = PROF.byCentre[c as "CHN"];
  const prof = Object.fromEntries(PROF.profiles.map((p) => [p.pid, p]));
  return (
    <Card title={`${SITENAME[c]} — in-patients by acuity`} hint="roster detail · hourly observation charts are Chennai-only in this prototype" right={<Pill>{rows.length}</Pill>} className="mb14">
      <table className="t">
        <thead><tr><th>NEWS2</th><th>Patient</th><th>Bed</th><th>Unit</th><th>Diagnosis</th><th>LOS</th><th>Registered at</th><th>Consultant</th></tr></thead>
        <tbody>
          {rows.map((r) => {
            const pr = prof[r.id];
            const away = pr && pr.regCentre !== c;
            return (
              <tr key={r.id}>
                <td><NewsBadge n={r.news2} size={30} /></td>
                <td className="sm"><b>{r.name}</b>{r.aki > 0 && <> <Pill c={r.aki >= 2 ? "r" : "a"}>AKI {r.aki}</Pill></>}<div className="xs mut">{r.age}{r.sex} · {r.id}</div></td>
                <td className="num sm">{r.bed}</td><td className="sm mut">{r.unit}</td>
                <td className="sm mut" style={{ maxWidth: 250 }}>{r.dx}</td><td className="num sm">{r.los}d</td>
                <td className="sm">{away ? <Pill c="b">{SITENAME[pr.regCentre]}</Pill> : <span className="xs mut">here</span>}</td>
                <td className="xs mut">{r.consultant}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="sm" style={{ color: "var(--ink2)", lineHeight: 1.65, marginTop: 12 }}>
        {P.inbound} of these patients are registered at another centre. Profile completeness here is {P.complete}%, against a network mean of {PROF.totals.complete}%.
      </div>
    </Card>
  );
}

function DischargedToday() {
  const st = useStore();
  const rows = Object.entries(st.adt).filter(([, a]) => a.discharged);
  if (!rows.length) return null;
  return (
    <Card title="Discharged in this session" hint="discharge summary goes to sign-off before release" className="mt14">
      <table className="t"><tbody>
        {rows.map(([pid, a]) => {
          const r = NET.roster.find((x) => x.id === pid);
          return (
            <tr key={pid}><td className="sm"><b>{r?.name}</b> <span className="xs mut">{pid}</span></td>
              <td className="xs mut">{a.discharged!.at.replace("T", " ")} · {a.discharged!.by}</td>
              <td style={{ textAlign: "right" }}><Link className="btn sm" href="/clinical/signoff">Summary in sign-off queue</Link></td></tr>
          );
        })}
      </tbody></table>
    </Card>
  );
}

function Clinic({ centre }: { centre: string }) {
  const st = useStore();
  const me = useMe();
  const [outcomeFor, setOutcomeFor] = useState<string | null>(null);
  const inScope = (c: string) => (centre === "all" ? me.centres.includes(c as never) : c === centre);
  const T = OPD.totals;
  const cls = OPD.clinics.filter((c) => inScope(c.centre));
  const next = OPD.upcoming.filter((u) => u.date === OPD.nextClinicDate && inScope(u.centre)).sort((a, b) => a.time.localeCompare(b.time));
  const hb = OPD.hbot.filter((x) => x.status === "in-course" && inScope(x.centre));
  const dnaToday = next.filter((u) => st.attendance[u.id]?.status === "dna");
  const od = [
    ...dnaToday.map((u) => ({ id: "FU-" + u.id, name: u.name, centre: u.centre, dueDate: OPD.nextClinicDate, daysOver: 0, reason: `Did not attend ${u.time} ${u.reason.toLowerCase()} — recall created`, lastContact: u.lastSeen ?? "—", risk: u.risk === "urgent" ? "high" : "medium" })),
    ...OPD.overdue.filter((o) => inScope(o.centre)),
  ];

  function mark(id: string, status: "arrived" | "seen" | "dna", extra?: { outcome: string; followUp: string }) {
    const u = OPD.upcoming.find((x) => x.id === id)!;
    setState((s) => ({ attendance: { ...s.attendance, [id]: { status, ...extra, by: me.name, at: new Date().toISOString() } } }));
    audit(me.name, "write", `${u.id} ${u.name}`, status === "seen" ? `Seen · ${extra?.outcome} · follow-up ${extra?.followUp}` : `Marked ${status}`);
    if (status === "dna") toast(`${u.name} marked did-not-attend. A recall task was added to the follow-up safety net.`);
  }

  return (
    <>
      <Kpis cols={5} items={[
        { k: "Booked next session", v: next.length, d: OPD.nextClinicDay },
        { k: "Checked in / seen", v: `${next.filter((u) => st.attendance[u.id]?.status === "arrived").length} / ${next.filter((u) => st.attendance[u.id]?.status === "seen").length}`, d: "recorded in this session" },
        { k: "Did not attend", v: T.dnaPct + "%", d: `${T.dna} of ${T.booked90} over 90 days`, tone: T.dnaPct > 10 ? "warn" : "" },
        { k: "Overdue follow-ups", v: od.length, d: `${T.overdueHigh} high risk`, tone: "bad" },
        { k: "HBOT courses running", v: hb.length, d: `${T.hbotFutility} at futility review` },
      ]} />

      <Card title={`Next clinic session — ${OPD.nextClinicDay}`} hint="mark arrival, record the outcome, or flag non-attendance" right={<Pill>{next.length}</Pill>} className="mb14">
        <div style={{ overflowX: "auto" }}>
          <table className="t">
            <thead><tr><th>Time</th><th>Patient</th><th>Clinic</th><th>Reason</th><th>Type</th><th>Priority</th><th>DNA risk</th><th>Attendance</th></tr></thead>
            <tbody>
              {next.map((u) => {
                const cl = OPD.clinics.find((c) => c.id === u.clinic);
                const dr = Math.round(u.dnaRisk * 100);
                const a = st.attendance[u.id];
                return (
                  <tr key={u.id}>
                    <td className="num sm"><b>{u.time}</b></td>
                    <td className="sm">{u.name}{u.pid && <> <Link href={`/clinical/patient/${u.pid}`} className="pill b" style={{ textDecoration: "none" }}>has in-patient record</Link></>}
                      <div className="xs mut">{u.lastSeen ? `last seen ${u.lastSeen}` : "no previous attendance"}</div></td>
                    <td className="sm mut">{cl?.name}<div className="xs"><Dot c={SITEC[u.centre]} /> {u.centre}</div></td>
                    <td className="sm mut">{u.reason}</td>
                    <td><Pill c={u.new ? "v" : "n"}>{u.new ? "New" : "Follow-up"}</Pill></td>
                    <td><Pill c={u.risk === "urgent" ? "r" : u.risk === "priority" ? "a" : "n"}>{u.risk}</Pill></td>
                    <td style={{ minWidth: 90 }}><Prog pct={dr} c={dr >= 40 ? "var(--red)" : dr >= 20 ? "var(--amber)" : "var(--green)"} label={dr + "%"} /></td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {!a && <><button className="btn sm" onClick={() => mark(u.id, "arrived")}>Arrived</button> <button className="btn sm" onClick={() => mark(u.id, "dna")}>DNA</button></>}
                      {a?.status === "arrived" && <><Pill c="b">arrived</Pill> <button className="btn sm p" onClick={() => setOutcomeFor(u.id)}>Record outcome</button></>}
                      {a?.status === "seen" && <Pill c="g" title={`${a.outcome} · follow-up ${a.followUp}`}>seen · {a.outcome}</Pill>}
                      {a?.status === "dna" && <Pill c="r">did not attend</Pill>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid2 mb14">
        <Card title="Follow-up safety net" hint="the out-patient failure mode is disappearance, not deterioration" right={<Pill c="r">{od.length}</Pill>} bodyClass={null}>
          {od.slice(0, 8).map((o) => (
            <div key={o.id} className="att-i">
              <div className={`ic ${o.risk === "high" ? "r" : o.risk === "medium" ? "a" : "v"}`}>{o.daysOver ? `${o.daysOver}d` : "new"}</div>
              <div>
                <div className="t" style={{ fontSize: 12 }}>{o.name} <span className="mut">· {o.centre}</span></div>
                <div className="d">{o.reason}</div>
                <div className="xs mut" style={{ marginTop: 4 }}>due {o.dueDate} · last contact {o.lastContact}</div>
              </div>
            </div>
          ))}
        </Card>
        <Card title="Clinic performance — 90 days">
          <table className="t">
            <thead><tr><th>Clinic</th><th>Centre</th><th>Day</th><th>Booked</th><th>DNA</th><th>New</th><th>Admitted</th></tr></thead>
            <tbody>
              {cls.map((c) => (
                <tr key={c.id}>
                  <td className="sm"><b>{c.name}</b><div className="xs mut">{c.lead}</div></td>
                  <td className="sm"><Dot c={SITEC[c.centre]} /> {c.centre}</td><td className="sm mut">{c.day}</td>
                  <td className="num sm">{c.booked90}</td>
                  <td><Pill c={c.dnaPct > 12 ? "r" : c.dnaPct > 10 ? "a" : "g"}>{n1(c.dnaPct)}%</Pill></td>
                  <td className="num sm">{c.newPct}%</td><td className="num sm">{c.admitted}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      <Card title="Out-patient HBOT courses" hint="the chamber is an out-patient capacity problem" right={<Pill>{hb.length} running</Pill>}>
        <table className="t">
          <thead><tr><th>Course</th><th>Patient</th><th>Centre</th><th>Indication</th><th>Slot</th><th>Progress</th><th>Attendance</th><th>Area reduction</th><th /></tr></thead>
          <tbody>
            {[...hb].sort((a, b) => b.session - a.session).slice(0, 12).map((x) => {
              const ad = Math.round(x.adherence * 100);
              return (
                <tr key={x.id}>
                  <td className="num sm"><b>{x.id}</b></td><td className="sm">{x.name}</td>
                  <td className="sm"><Dot c={SITEC[x.centre]} /> {x.centre}</td><td className="sm mut">{x.indication}</td>
                  <td className="num sm">{x.slot}</td>
                  <td style={{ minWidth: 104 }}><Prog pct={(100 * x.session) / x.total} label={`${x.session}/${x.total}`} /></td>
                  <td><Pill c={ad >= 90 ? "g" : ad >= 75 ? "a" : "r"}>{ad}%</Pill></td>
                  <td className="num sm" style={{ color: x.areaReduction >= 50 ? "var(--green)" : x.areaReduction >= 20 ? "var(--amber)" : "var(--red)", fontWeight: 600 }}>{x.areaReduction}%</td>
                  <td>{x.flag && <Pill c="a">futility review</Pill>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {outcomeFor && <OutcomeModal id={outcomeFor} onClose={() => setOutcomeFor(null)} onSave={(o, f) => { mark(outcomeFor, "seen", { outcome: o, followUp: f }); setOutcomeFor(null); }} />}
    </>
  );
}

function OutcomeModal({ id, onClose, onSave }: { id: string; onClose: () => void; onSave: (o: string, f: string) => void }) {
  const u = OPD.upcoming.find((x) => x.id === id)!;
  const [o, setO] = useState<string>(OUTCOMES[0]);
  const [f, setF] = useState<string>(FOLLOWUPS[1]);
  return (
    <Modal title={`Clinic outcome — ${u.name}`} onClose={onClose}>
      <div className="frow">
        <div className="fld"><label>Outcome</label><select value={o} onChange={(e) => setO(e.target.value)}>{OUTCOMES.map((x) => <option key={x}>{x}</option>)}</select></div>
        <div className="fld"><label>Follow-up</label><select value={f} onChange={(e) => setF(e.target.value)}>{FOLLOWUPS.map((x) => <option key={x}>{x}</option>)}</select></div>
      </div>
      {o === "Admitted" && <div className="disc" style={{ marginBottom: 12 }}>Admission creates an in-patient stay linked to this clinic encounter (OP → IP path).</div>}
      <button className="btn p" onClick={() => onSave(o, f)}>Save outcome</button>
    </Modal>
  );
}

function EdList({ inScope }: { inScope: (c: string) => boolean }) {
  const rows = ED.filter((e) => inScope(e.centre)).sort((a, b) => a.triage - b.triage);
  return (
    <Card title="Emergency department — vascular and diabetic foot presentations" hint="emergency encounters are a separate class from admissions (REQ-CARE-001)">
      <table className="t">
        <thead><tr><th>Triage</th><th>Patient</th><th>Centre</th><th>Arrived</th><th>Presenting complaint</th><th>Status</th></tr></thead>
        <tbody>
          {rows.map((e) => (
            <tr key={e.id}>
              <td><Pill c={e.triage === 1 ? "r" : e.triage === 2 ? "o" : "a"}>Level {e.triage}</Pill></td>
              <td className="sm"><b>{e.name}</b> <span className="xs mut">{e.age}{e.sex} · {e.id}</span></td>
              <td className="sm"><Dot c={SITEC[e.centre]} /> {SITENAME[e.centre]}</td>
              <td className="num sm">{e.arrived}</td><td className="sm">{e.complaint}</td>
              <td><Pill c={e.status === "admitted" ? "g" : e.status === "referred to vascular" ? "b" : "a"}>{e.status}</Pill></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function DayCaseList({ inScope }: { inScope: (c: string) => boolean }) {
  const rows = DAYCASE.filter((d) => inScope(d.centre));
  return (
    <Card title="Day-case list" hint="same-day procedures · admitted and discharged within one day">
      <table className="t">
        <thead><tr><th>Time</th><th>Patient</th><th>Centre</th><th>Procedure</th><th>Safety flags</th><th>Status</th></tr></thead>
        <tbody>
          {rows.map((d) => (
            <tr key={d.id}>
              <td className="num sm"><b>{d.time}</b></td>
              <td className="sm"><b>{d.name}</b> <span className="xs mut">{d.age}{d.sex} · {d.id}</span></td>
              <td className="sm"><Dot c={SITEC[d.centre]} /> {SITENAME[d.centre]}</td>
              <td className="sm">{d.procedure}</td>
              <td>{d.flags.length ? d.flags.map((f) => <div key={f}><Pill c="a">{f}</Pill></div>) : <span className="xs mut">none</span>}</td>
              <td><Pill c={d.status === "ready for discharge" ? "g" : d.status === "in theatre" ? "b" : "n"}>{d.status}</Pill></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
