"use client";

import Link from "next/link";
import { useState } from "react";
import { Guard, Top, useMe } from "@/components/cx/Shell";
import { Card, Dot, Kpis, Pill, Prog, toast } from "@/components/cx/ui";
import { RES, SITEC, n1 } from "@/lib/cx/data";
import { audit, nowIso, setState, uid, useStore, type ExtractReq } from "@/lib/cx/store";

const EXT_ST: Record<string, [string, string]> = {
  materialised: ["g", "Materialised"], "awaiting-approval": ["a", "Awaiting approval"], running: ["b", "Running"], rejected: ["r", "Rejected"],
};

// Variables the approved protocol allows (true) and direct identifiers it does not (false).
const ALLOW: Record<string, [string, boolean][]> = {
  "HBOT-DFU-2026": [["demographics.ageBand", true], ["demographics.sex", true], ["wound.wagner", true], ["wound.site", true], ["wound.areaSeries", true], ["vascular.abi", true],
    ["vascular.tcpo2Air", true], ["vascular.tcpo2Chamber", true], ["hbot.sessionCount", true], ["hbot.glucosePrePost", true], ["labs.hba1c", true], ["labs.creatinineSeries", true],
    ["outcome.amputation", true], ["image.woundSeries", true], ["demographics.name", false], ["demographics.mrn", false], ["demographics.dob", false], ["demographics.phone", false], ["demographics.address", false]],
  "DFU-RETRO-19-25": [["demographics.ageBand", true], ["demographics.sex", true], ["admission.year", true], ["admission.site", true], ["outcome.amputationLevel", true], ["labs.hba1c", true],
    ["vascular.abi", true], ["procedure.revascularisation", true], ["demographics.name", false], ["demographics.mrn", false], ["image.woundSeries", false]],
  "CDS-IMPACT-2026": [["alert.ruleId", true], ["alert.raisedAt", true], ["alert.acknowledgedAt", true], ["alert.outcome", true], ["alert.overrideReason", true], ["site.code", true],
    ["shift.band", true], ["patient.pseudoId", true], ["demographics.name", false], ["demographics.mrn", false], ["wound.areaSeries", false]],
};

export function Research({ study }: { study: string }) {
  return (
    <Guard screen="research">
      <Top title="Research workspace" sub="Separate store · pseudonymous · fed by the extract broker, paper abstraction and AI telemetry" />
      <div className="wrap"><Body key={study} sid={RES.studies.some((s) => s.id === study) ? study : RES.studies[0].id} /></div>
    </Guard>
  );
}

function Body({ sid }: { sid: string }) {
  const st = useStore();
  const me = useMe();
  const S = RES.studies.find((x) => x.id === sid)!;
  const T = RES.totals, A = RES.abstraction;
  const parts = RES.participants.filter((p) => p.study === sid);
  const exts = [...st.extracts.filter((e) => e.study === sid), ...RES.extracts.filter((e) => e.study === sid)];
  const qs = RES.queries.filter((q) => q.study === sid);
  const snaps = RES.exports.filter((x) => x.study === sid);
  const has = (k: string) => S.sources.includes(k);
  const allow = ALLOW[sid];
  const [vars, setVars] = useState<string[]>(allow.filter((v) => v[1]).map((v) => v[0]));
  const [ident, setIdent] = useState("pseudonymous");
  const [images, setImages] = useState(false);
  const [from, setFrom] = useState("2026-06-01");
  const [to, setTo] = useState("2026-09-20");
  const pct = Math.round((100 * S.enrolled) / S.target);

  function submit() {
    const req: ExtractReq = {
      id: uid("EXT"), study: sid, requested: nowIso().slice(0, 10), requestedBy: me.name, cohort: `Approved protocol cohort, admitted ${from} to ${to}, all sites`,
      variables: vars, identifiability: ident, images, status: "awaiting-approval",
    };
    setState((s) => ({
      extracts: [req, ...s.extracts],
      pending: [{ id: uid("SO"), kind: "research", doc: `Extract request ${req.id} · ${sid}`, docType: "extract", entered: me.name, enteredRole: me.role, at: nowIso(),
        need: "custodian", needFrom: "R. Subramanian", priority: "medium", why: `${vars.length} variables, all within protocol v${S.protocolVersion}. ${ident} release${images ? " with de-identified images" : ""}.`,
        subject: { type: "extract", ref: req.id }, content: JSON.stringify(req), version: 1 }, ...s.pending],
    }));
    audit(me.name, "write", `${sid}`, `Extract ${req.id} requested (${vars.length} variables, ${ident})`);
    toast("Submitted to the data custodian. Nothing is released until R. Subramanian signs.");
  }

  function snapshot() {
    audit(me.name, "export", sid, "Analysis snapshot requested (de-identified, hashed)");
    toast("Snapshot request logged. Snapshots are immutable and hashed.");
  }

  return (
    <>
      <Card title="Domain boundary" hint="the research store is a separate database with its own access path" className="mb14">
        <div className="bound">
          <div className="bound-s cl"><div className="bh">Clinical domain · identifiable</div><ul><li>Held for direct care, under a care relationship</li><li>Patient, encounter, observation, wound, image, alert</li><li>Access requires a current clinical relationship</li></ul></div>
          <div className="bound-m"><div className="bt">EXTRACT BROKER</div><div className="arw">──▶</div><div className="bd">approved protocol<br />variable allow-list<br />consent check<br />de-identify<br />custodian sign-off<br />logged</div><div className="no">◀── never writes back</div></div>
          <div className="bound-s rs"><div className="bh">Research domain · pseudonymous</div><ul><li>Held for an approved study, under ethics approval</li><li>Participant pseudo-ID, CRF, abstracted paper, AI telemetry</li><li>Linkage key sits in a separate vault</li></ul></div>
        </div>
      </Card>

      <div className="filt">
        <div className="fg"><span className="fl">Study</span>
          <div className="chips">{RES.studies.map((x) => <Link key={x.id} className={`chip${x.id === sid ? " on" : ""}`} href={`/clinical/research?study=${x.id}`}>{x.id}</Link>)}</div>
        </div>
        <div style={{ flex: 1 }} />
        <span className="xs mut">{T.studies} studies · {T.participants} participants · {T.openQueries} open queries · {T.extractsPending + st.extracts.filter((e) => e.status === "awaiting-approval").length} extracts pending</span>
      </div>

      <div className="phead">
        <div style={{ flex: 1, minWidth: 320 }}>
          <div className="nm">{S.short}</div><div className="mt">{S.title}</div>
          <div className="sb" style={{ marginTop: 9, display: "flex", gap: 7, flexWrap: "wrap" }}>
            <Pill>{S.id}</Pill><Pill c="b">{S.design}</Pill><Pill c="g">IEC {S.iec}</Pill>{S.ctri ? <Pill c="g">{S.ctri}</Pill> : <Pill>CTRI not applicable</Pill>}
            <Pill>protocol v{S.protocolVersion}</Pill><Pill c={S.status === "enrolling" ? "b" : "a"}>{S.status}</Pill>
          </div>
          <div className="sb" style={{ marginTop: 9 }}>Chief investigator <b>{S.pi}</b>{S.coPi ? ` · co-investigator ${S.coPi}` : ""} · ethics approval expires {S.iecExpiry}</div>
          <div className="sb" style={{ marginTop: 6 }}><b>Primary endpoint.</b> {S.primaryEndpoint}</div>
          <div className="sb" style={{ marginTop: 4 }}>{S.consentModel}</div>
        </div>
        <div className="rt" style={{ minWidth: 210 }}><div style={{ textAlign: "right", width: "100%" }}>
          <div className="xs mut">Enrolment</div>
          <div style={{ font: "600 25px/1.1 var(--f)", margin: "3px 0" }}>{S.enrolled}<small style={{ fontSize: 13, color: "var(--ink3)" }}> / {S.target}</small></div>
          <div className="prog" style={{ marginTop: 7 }}><i style={{ width: `${pct}%`, background: "var(--violet)" }} /></div>
          <div className="xs mut" style={{ marginTop: 5 }}>{pct}% · {S.variables} variables · {S.sites.length} sites</div>
        </div></div>
      </div>

      <Card title="Pull from the clinical record" hint="brokered extract · one way · custodian approval required" className="mb14" bodyClass={null}>
        <div className="card-b">
          <table className="t">
            <thead><tr><th>Request</th><th>Cohort</th><th>Variables</th><th>Identifiability</th><th>Images</th><th>Rows</th><th>Status</th></tr></thead>
            <tbody>
              {exts.map((e) => {
                const s = EXT_ST[e.status];
                const rows = "rows" in e ? e.rows : (e as ExtractReq).released;
                return (
                  <tr key={e.id}>
                    <td className="sm"><b>{e.id}</b><div className="xs mut">{e.requested}<br />{e.requestedBy}</div></td>
                    <td className="sm mut" style={{ maxWidth: 250 }}>{e.cohort}{"note" in e && <div className="xs" style={{ marginTop: 4 }}>{e.note}</div>}</td>
                    <td className="num sm">{e.variables.length}</td>
                    <td><Pill c={e.identifiability === "identifiable" ? "r" : e.identifiability === "pseudonymous" ? "a" : "g"}>{e.identifiability}</Pill></td>
                    <td className="sm">{e.images ? "yes" : "—"}</td>
                    <td className="num sm">{rows == null ? "—" : rows}{"withheld" in e && e.withheld != null && <div className="xs" style={{ color: "var(--amber)" }}>{e.withheld} withheld · consent</div>}</td>
                    <td><Pill c={s[0]}>{s[1]}</Pill>{e.status === "awaiting-approval" && <div style={{ marginTop: 4 }}><Link className="xs" href="/clinical/signoff">in sign-off queue</Link></div>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="card-b" style={{ borderTop: "1px solid var(--line)", background: "var(--surf2)" }}>
          <div className="card-h" style={{ padding: "0 0 11px", border: 0 }}><h3 style={{ fontSize: 12 }}>New extract request</h3><div className="sp" /><Pill c="v">goes to the data custodian, not straight to the store</Pill></div>
          <div className="frow">
            <div className="fld"><label>Admitted from</label><input value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div className="fld"><label>Admitted to</label><input value={to} onChange={(e) => setTo(e.target.value)} /></div>
            <div className="fld"><label>Identifiability</label>
              <select value={ident} onChange={(e) => setIdent(e.target.value)}>
                <option value="anonymous">Anonymous — no linkage key</option>
                <option value="pseudonymous">Pseudonymous — linkage key in the vault</option>
                <option value="identifiable" disabled>Identifiable — blocked, needs re-identification justification</option>
              </select></div>
            <div className="fld"><label>Wound images</label>
              <select value={images ? "1" : "0"} onChange={(e) => setImages(e.target.value === "1")} disabled={!has("image")}>
                <option value="0">Exclude</option><option value="1">Include — de-identified, research-consented only</option>
              </select><div className="hint">{has("image") ? S.imageConsent : "This protocol does not cover image use."}</div></div>
          </div>
          <div className="fsec"><div className="fsec-h"><h4>Variables</h4><Pill>{allow.filter((v) => v[1]).length} approved · {allow.filter((v) => !v[1]).length} outside the protocol</Pill></div>
            <div className="vars">
              {allow.map(([v, ok]) => {
                const on = ok && vars.includes(v);
                return (
                  <button key={v} className={`var ${ok ? (on ? "on" : "") : "no"}`} disabled={!ok} onClick={() => setVars(on ? vars.filter((x) => x !== v) : [...vars, v])} title={ok ? undefined : "Not in the approved protocol"}>
                    <span className="bx">{ok ? (on ? "✓" : "") : "×"}</span>{v}
                  </button>
                );
              })}
            </div>
            <div className="hint" style={{ marginTop: 9 }}>Variables outside the approved protocol cannot be selected. Widening the list means a protocol amendment, not a wider query — this is the control that stopped EXT-0033.</div>
          </div>
          <div style={{ display: "flex", gap: 9, alignItems: "center", flexWrap: "wrap" }}>
            <button className="btn v" disabled={!vars.length} onClick={submit}>Submit for custodian approval</button>
            <span className="xs mut" style={{ marginLeft: "auto" }}>consent is checked per participant at materialisation, not now</span>
          </div>
        </div>
      </Card>

      {has("paper") && (
        <Card title="Transfer from existing paper records" hint="independent double entry with third-reviewer reconciliation" className="mb14">
          <Kpis cols={5} items={[
            { k: "Charts in scope", v: A.totalCharts, d: "2019–2025, all sites" }, { k: "Located", v: A.located, d: `${A.notLocated} not traceable`, tone: "warn" },
            { k: "Abstracted", v: A.abstracted, d: `${Math.round((100 * A.abstracted) / A.totalCharts)}% of scope` },
            { k: "Double-entry verified", v: A.verified, d: `${Math.round((100 * A.verified) / A.totalCharts)}% of scope` },
            { k: "Agreement", v: A.kappa, d: `Cohen's kappa · ${A.discrepancyRate}% discrepancy`, tone: A.kappa >= 0.8 ? "good" : "warn" },
          ]} />
          <div className="grid2">
            <table className="t"><thead><tr><th>Year</th><th>Site</th><th>Charts</th><th>Done</th><th>Abstractors</th><th>Disc.</th><th>Status</th></tr></thead><tbody>
              {A.batches.map((b) => (
                <tr key={`${b.year}${b.site}`}><td className="num sm">{b.year}</td><td className="sm">{b.site}</td><td className="num sm">{b.charts}</td><td className="num sm">{b.done}</td>
                  <td className="xs mut">{b.ab1 ?? "—"}<br />{b.ab2 ?? <span style={{ color: "var(--amber)" }}>no second abstractor</span>}</td>
                  <td className="num sm">{b.disc || "—"}</td>
                  <td><Pill c={b.status === "reconciled" ? "g" : b.status === "in-progress" ? "b" : b.status === "single-entry-only" ? "a" : "n"}>{b.status}</Pill></td></tr>
              ))}
            </tbody></table>
            <div>
              {(A.fieldQuality as [string, number, string][]).map(([k, v, note]) => {
                const c = v >= 90 ? "var(--green)" : v >= 60 ? "var(--amber)" : "var(--red)";
                return (
                  <div key={k} style={{ marginBottom: 9 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}><span className="sm">{k}</span><span className="num sm" style={{ color: c, fontWeight: 600 }}>{v}%</span></div>
                    <div className="prog" style={{ height: 6, marginTop: 4 }}><i style={{ width: `${v}%`, background: c }} /></div>
                    {note && <div className="xs mut" style={{ marginTop: 3 }}>{note}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      )}

      {has("ai") && (
        <Card title="AI and rule-engine interactions" hint="captured as study data in its own right · no patient-level variables" right={<Pill>{T.aiFired} events</Pill>} className="mb14">
          <table className="t"><thead><tr><th>Rule</th><th>Raised</th><th>Median ack</th><th>Accepted</th><th>Overridden</th><th>Override rate</th><th>Commonest override reason</th></tr></thead><tbody>
            {[...RES.ai].sort((a, b) => b.overridden / b.fired - a.overridden / a.fired).map((r) => {
              const orr = (100 * r.overridden) / r.fired;
              return (
                <tr key={r.rule}><td className="sm"><b>{r.rule}</b> <span className="mut">{r.name}</span></td><td className="num sm">{r.fired}</td><td className="num sm">{n1(r.ackMin)}m</td>
                  <td className="num sm">{r.accepted}</td><td className="num sm">{r.overridden}</td><td><Pill c={orr > 20 ? "r" : orr > 10 ? "a" : "g"}>{n1(orr)}%</Pill></td><td className="sm mut">{r.topReason ?? "—"}</td></tr>
              );
            })}
          </tbody></table>
          <div className="sm" style={{ color: "var(--ink2)", lineHeight: 1.65, marginTop: 12 }}>
            Voice pipeline: {RES.voice.notes} notes, {Math.round((100 * RES.voice.fieldsAccepted) / RES.voice.fieldsOffered)}% of fields accepted unchanged, word error rate {RES.voice.wer}%. {RES.voice.note}
          </div>
        </Card>
      )}

      {has("crf") && (
        <Card title="Participants" hint="pseudonymous identifiers only · the linkage key is not held in this store" right={<Pill>{parts.length}</Pill>} className="mb14">
          <table className="t"><thead><tr><th>Pseudo-ID</th><th>Site</th><th>Enrolled</th><th>Consent</th><th>Image scope</th><th>Source</th><th>HBOT sessions</th><th>CRF complete</th></tr></thead><tbody>
            {parts.slice(0, 12).map((p) => (
              <tr key={p.pseudoId}><td className="num sm"><b>{p.pseudoId}</b></td><td className="sm"><Dot c={SITEC[p.site]} /> {p.site}</td><td className="num sm mut">{p.enrolled}</td>
                <td><Pill c={p.consent === "active" ? "g" : "r"}>{p.consent}</Pill></td><td className="xs mut">{p.imageConsent}</td>
                <td><Pill c={p.source === "extract" ? "b" : "v"}>{p.source === "extract" ? "extract" : "CRF entry"}</Pill></td><td className="num sm">{p.sessions}</td>
                <td style={{ minWidth: 110 }}><Prog pct={p.crfComplete} c={p.crfComplete >= 90 ? "var(--green)" : p.crfComplete >= 60 ? "var(--amber)" : "var(--red)"} label={p.crfComplete + "%"} /></td></tr>
            ))}
          </tbody></table>
          <div className="xs mut" style={{ marginTop: 9 }}>Showing 12 of {parts.length}. Withdrawn participants keep their row, flagged, so withdrawal is analysable; the broker withholds them from new extracts.</div>
        </Card>
      )}

      <div className="grid2 mb14">
        <Card title="Open data queries" right={<Pill c={qs.length ? "a" : "g"}>{qs.length}</Pill>} bodyClass={null}>
          {qs.length ? qs.map((q) => (
            <div key={q.id} className="att-i"><div className={`ic ${q.age > 14 ? "r" : "a"}`}>{q.age}d</div>
              <div><div className="t" style={{ fontSize: 12 }}>{q.id} · {q.participant} · <span className="num">{q.field}</span></div><div className="d">{q.text}</div><div className="xs mut" style={{ marginTop: 5 }}>raised {q.raised} · owner {q.owner}</div></div></div>
          )) : <div className="card-b sm mut">No open queries for this study.</div>}
        </Card>
        <Card title="Analysis snapshots" hint="immutable, hashed, de-identified" right={<button className="btn sm" onClick={snapshot}>New snapshot</button>}>
          {snaps.length ? (
            <table className="t"><tbody>
              {snaps.map((x) => (
                <tr key={x.id}><td className="sm"><b>{x.id}</b><div className="xs mut num">{x.hash} · {x.format}</div><div className="xs mut">{x.purpose} · {x.deident}</div></td>
                  <td className="num sm mut">{x.created}</td><td className="num sm">{x.rows} rows</td><td><Pill c={x.status === "released" ? "g" : "a"}>{x.status}</Pill></td></tr>
              ))}
            </tbody></table>
          ) : <div className="sm mut">No snapshots yet.</div>}
        </Card>
      </div>

      <Card title="Governance rules enforced at the boundary">
        <table className="t"><tbody>
          {[["Direction", "One way. The research store is never a write target for clinical systems, and never writes back."],
            ["Gate", "An extract requires a current ethics approval, a protocol version, a variable allow-list from that protocol, and a named data custodian's sign-off."],
            ["Consent", "Checked per participant at materialisation, not at request. A withdrawal between request and release removes the row."],
            ["Pseudonymisation", "The linkage key lives in a separate vault under a different custodian. Re-identification is a logged, justified, two-person action."],
            ["Images", "De-identified separately and released only where the participant's image consent scope covers the requested use."],
            ["Audit", "Every request, approval, rejection, materialisation, export and re-identification is recorded and reviewable by the IEC."]].map((r) => (
            <tr key={r[0]}><td className="sm mut" style={{ width: "19%", verticalAlign: "top" }}><b>{r[0]}</b></td><td className="sm">{r[1]}</td></tr>
          ))}
        </tbody></table>
        <div className="disc" style={{ margin: "14px 0 0" }}>Regulatory anchors to confirm with the research office before build: IEC registration and SOPs, CTRI registration for prospective work, the ICMR National Ethical Guidelines, and the lawful basis for secondary use under the DPDP Act 2023.</div>
      </Card>
    </>
  );
}
