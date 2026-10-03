"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Guard, Top, useMe } from "@/components/cx/Shell";
import { Card, Dot, Kpis, Modal, Pill, Prog, toast } from "@/components/cx/ui";
import { PROF, SITEC, SITENAME, n1, profileOf, type Profile } from "@/lib/cx/data";
import { audit, nowIso, openPending, setState, uid, useStore, type Merge, type State } from "@/lib/cx/store";

type Dup = (typeof PROF.duplicates)[number];

/** Current state of a candidate pair: the latest decision recorded for it. */
function pairState(st: State, d: Dup): Merge | undefined {
  return st.merges.filter((m) => (m.a === d.a && m.b === d.b)).sort((x, y) => y.at.localeCompare(x.at))[0];
}

/** The decision currently in force: only signed decisions change the records. */
function signedState(st: State, d: Dup): Merge | undefined {
  return st.merges.filter((m) => m.a === d.a && m.b === d.b && m.signed).sort((x, y) => y.at.localeCompare(x.at))[0];
}

/** Centre MRNs held under one enterprise identity (REQ-PROF-001). */
export function aliasesFor(st: State, p: Profile): { mrn: string; centre: string; source: string }[] {
  const out = [{ mrn: p.mrn, centre: p.regCentre, source: "registration" }];
  if (p.curCentre !== p.regCentre) out.push({ mrn: `${p.curCentre}-${p.mrn.split("-")[1]}`, centre: p.curCentre, source: "referral episode" });
  PROF.duplicates.forEach((d) => {
    const m = signedState(st, d);
    if (m?.decision === "merged" && d.a === p.pid) out.push({ mrn: d.bMrn, centre: d.bCentre, source: `merged from ${d.b}` });
  });
  return out;
}

export function ProfileMaster({ centre }: { centre: string }) {
  return (
    <Guard screen="profile">
      <Top title="Patient master" sub="Profile store held apart from the encounter record · one identity across three centres" />
      <div className="wrap"><Body centre={centre} /></div>
    </Guard>
  );
}

function Body({ centre }: { centre: string }) {
  const st = useStore();
  const router = useRouter();
  const T = PROF.totals;
  const [adj, setAdj] = useState<Dup | null>(null);
  const [view, setView] = useState<Profile | null>(null);
  const [q, setQ] = useState("");
  const mergedAway = new Set(PROF.duplicates.filter((d) => signedState(st, d)?.decision === "merged").map((d) => d.b));
  const rows = PROF.profiles.filter((p) => (centre === "all" || p.curCentre === centre) && (!q || `${p.name} ${p.mrn} ${p.pid} ${p.phone ?? ""}`.toLowerCase().includes(q.toLowerCase())));
  const openDup = PROF.duplicates.filter((d) => { const m = pairState(st, d); return !m || m.decision === "unmerged" || (m.decision === "merged" && !m.signed); }).length;

  return (
    <>
      <Card title="Why this is a separate store" className="mb14">
        <div className="bound">
          <div className="bound-s cl"><div className="bh">Profile master · slowly changing</div>
            <ul><li>Who the person is, and only that</li><li>Name, date of birth, contact, next of kin, address</li><li>Durable facts: allergies, comorbidities, diabetes duration</li><li>Every direct identifier the organisation holds lives here</li></ul></div>
          <div className="bound-m"><div className="bt">PATIENT ID</div><div className="arw">◀─▶</div><div className="bd">one enterprise identifier<br />many centre MRNs<br />duplicate adjudication</div></div>
          <div className="bound-s rs"><div className="bh">Encounter record · high velocity</div>
            <ul><li>What happened, when, and what was measured</li><li>Admissions, observations, labs, wounds, images, alerts</li><li>Carries a patient reference, never a copy of the identifiers</li></ul></div>
        </div>
      </Card>

      <Kpis cols={5} items={[
        { k: "Profiles", v: T.n - mergedAway.size, d: mergedAway.size ? `${mergedAway.size} merged in this session` : "across three centres" },
        { k: "Mean completeness", v: T.complete + "%", d: `${T.incomplete} with missing fields`, tone: T.complete < 90 ? "warn" : "" },
        { k: "Cross-centre referrals", v: T.referrals, d: "treated away from home centre" },
        { k: "Duplicate candidates", v: openDup, d: "awaiting adjudication", tone: openDup ? "bad" : "good" },
        { k: "Research consent", v: T.researchConsent, d: `${Math.round((100 * T.researchConsent) / T.n)}% of the master` },
      ]} />

      <Card title="Duplicate candidates" hint="merge is a human decision, never automatic · a signed merge can be reversed" className="mb14">
        <table className="t">
          <thead><tr><th>Score</th><th>Record A (survivor)</th><th>Record B</th><th>Why they matched</th><th>Status</th><th /></tr></thead>
          <tbody>
            {PROF.duplicates.map((d) => {
              const m = pairState(st, d);
              const status = !m ? d.status : m.decision === "merged" ? (m.signed ? "merged · signed" : "merge awaiting signature") : m.decision === "unmerged" ? (m.signed ? "unmerged · signed" : "unmerge awaiting signature") : "not a duplicate";
              const tone = status.includes("awaiting") ? "a" : status.startsWith("merged") ? "g" : status === "not a duplicate" ? "n" : "a";
              return (
                <tr key={d.a + d.b}>
                  <td><Pill c={d.score >= 0.9 ? "r" : d.score >= 0.8 ? "a" : "n"}>{n1(d.score * 100)}%</Pill></td>
                  <td className="sm"><b>{d.aName}</b><div className="xs mut num">{d.aMrn} · {SITENAME[d.aCentre]}</div></td>
                  <td className="sm"><b>{d.bName}</b><div className="xs mut num">{d.bMrn} · {SITENAME[d.bCentre]}</div></td>
                  <td className="sm mut">{d.why}</td>
                  <td><Pill c={tone}>{status}</Pill></td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {(!m || (m.decision === "unmerged" && m.signed)) && <button className="btn sm" onClick={() => setAdj(d)}>Adjudicate</button>}
                    {m?.decision === "merged" && m.signed && <button className="btn sm" onClick={() => setAdj(d)}>Reverse merge</button>}
                    {m && !m.signed && <Link className="btn sm" href="/clinical/signoff">In sign-off</Link>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="sm" style={{ color: "var(--ink2)", lineHeight: 1.65, marginTop: 11 }}>
          Merging two people is far more dangerous than leaving two records for one person, because it silently attaches one patient&apos;s allergies and results to another. The system proposes; a consultant decides; a second consultant signs; the decision is reversible.
        </div>
      </Card>

      <Card title="Centres" hint="registration against treatment location" className="mb14"
        right={<Link className={`btn sm${centre === "all" ? " v" : ""}`} href="/clinical/profile">All</Link>}>
        <table className="t">
          <thead><tr><th>Centre</th><th>Registered</th><th>Treated here</th><th>Referred in</th><th>Out to another centre</th><th>Completeness</th><th>Research consent</th><th>Publication image consent</th></tr></thead>
          <tbody>
            {(["CHN", "BLR", "HYD"] as const).map((c) => {
              const V = PROF.byCentre[c];
              return (
                <tr key={c} className="clk" onClick={() => router.push(`/clinical/profile?centre=${c}`)}>
                  <td className="sm"><Dot c={SITEC[c]} /> <b>{SITENAME[c]}</b><div className="xs mut">{V.city}, {V.state}</div></td>
                  <td className="num sm">{V.registered}</td><td className="num sm">{V.here}</td><td className="num sm">{V.inbound || "—"}</td><td className="num sm">{V.outbound || "—"}</td>
                  <td><Pill c={V.complete >= 92 ? "g" : "a"}>{V.complete}%</Pill></td><td className="num sm">{V.research}</td><td className="num sm">{V.photoPub}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <Card title={`Profile master${centre !== "all" ? ` — ${SITENAME[centre]}` : ""}`} hint="no observation, lab or wound data appears here by design"
        right={<><input className="gsearch" style={{ maxWidth: 240 }} placeholder="Search name, MRN, phone…" value={q} onChange={(e) => setQ(e.target.value)} /><Pill>{rows.length}</Pill></>}>
        <div style={{ overflowX: "auto" }}>
          <table className="t">
            <thead><tr><th>Patient</th><th>Centre MRNs</th><th>Age / sex</th><th>Home</th><th>Treated at</th><th>Diabetes</th><th>Allergies</th><th>Consent</th><th>Complete</th></tr></thead>
            <tbody>
              {rows.map((p) => {
                const away = p.regCentre !== p.curCentre;
                const gone = mergedAway.has(p.pid);
                const al = aliasesFor(st, p);
                return (
                  <tr key={p.pid} className="clk" style={gone ? { opacity: 0.45 } : undefined} onClick={() => setView(p)}>
                    <td className="sm"><b>{p.name}</b>{p.detailed && <> <Pill c="b">chart</Pill></>}{gone && <> <Pill c="n">merged</Pill></>}<div className="xs mut">{p.pid} · {p.epi}</div></td>
                    <td className="num xs">{al.map((a) => <div key={a.mrn}>{a.mrn}{a.source !== "registration" && <span className="mut"> · {a.source}</span>}</div>)}</td>
                    <td className="sm">{p.age}{p.sex}{p.blood ? ` · ${p.blood}` : ""}</td>
                    <td className="sm"><Dot c={SITEC[p.regCentre]} /> {p.regCentre}</td>
                    <td className="sm">{away ? <Pill c="b">{p.curCentre}</Pill> : <span className="xs mut">same</span>}</td>
                    <td className="sm mut">{p.dmYears}y · {p.therapy}</td>
                    <td className="xs mut">{p.allergies.length ? p.allergies.join("; ") : <span style={{ color: "var(--ink4)" }}>none recorded</span>}</td>
                    <td className="xs">{p.consent.research ? <Pill c="g">research</Pill> : <Pill>care only</Pill>}<div className="mut" style={{ marginTop: 3 }}>photo: {p.consent.photography}</div></td>
                    <td style={{ minWidth: 92 }}>
                      <Prog pct={p.complete} c={p.complete >= 90 ? "var(--green)" : p.complete >= 75 ? "var(--amber)" : "var(--red)"} label={p.complete + "%"} />
                      {p.missing.length > 0 && <div className="xs mut" style={{ marginTop: 2 }}>missing {p.missing.slice(0, 3).join(", ")}</div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {adj && <AdjudicateModal d={adj} onClose={() => setAdj(null)} />}
      {view && <ProfileModal p={view} onClose={() => setView(null)} />}
    </>
  );
}

function AdjudicateModal({ d, onClose }: { d: Dup; onClose: () => void }) {
  const me = useMe();
  const st = useStore();
  const A = profileOf(d.a)!, B = profileOf(d.b)!;
  const reversing = signedState(st, d)?.decision === "merged";
  const [reason, setReason] = useState("");
  const rows: [string, (p: Profile) => string][] = [
    ["Name", (p) => p.name], ["Date of birth", (p) => p.dob ?? "—"], ["Sex", (p) => p.sex], ["Phone", (p) => p.phone ?? "—"],
    ["Area / city", (p) => `${p.area ?? "—"}, ${p.city}`], ["MRN", (p) => p.mrn], ["Home centre", (p) => SITENAME[p.regCentre]],
    ["Next of kin", (p) => (p.kin ? `${p.kin.name} (${p.kin.rel})` : "—")], ["Diabetes", (p) => `${p.dmType}, ${p.dmYears}y`],
    ["Allergies", (p) => p.allergies.join("; ") || "none"], ["Comorbidities", (p) => p.comorbid.join(", ")],
  ];

  function record(decision: Merge["decision"]) {
    const m: Merge = { id: uid("MG"), a: d.a, b: d.b, decision, by: me.name, at: nowIso(), signed: decision === "not-duplicate" };
    setState((s) => ({
      merges: [m, ...s.merges],
      pending: decision === "not-duplicate" ? s.pending : [{
        id: uid("SO"), kind: "clinical", doc: `${decision === "merged" ? "Patient merge" : "Merge reversal"} · ${d.b} → ${d.a} (${d.aName})`, docType: "merge",
        entered: me.name, enteredRole: me.role, at: m.at, need: "merge", needFrom: "a second consultant", priority: "medium",
        why: `${decision === "merged" ? "Proposed merge" : "Proposed reversal"} of ${d.bMrn} (${SITENAME[d.bCentre]}) and ${d.aMrn} (${SITENAME[d.aCentre]}). ${reason}`,
        subject: { type: "merge", ref: m.id }, content: JSON.stringify({ survivor: d.a, merged: d.b, decision, reason }), version: 1,
      }, ...s.pending],
    }));
    audit(me.name, "write", `${d.a} / ${d.b}`, `Duplicate adjudicated: ${decision}${reason ? ` — ${reason}` : ""}`);
    toast(decision === "not-duplicate" ? "Recorded as two different people." : "Sent to Review & sign-off. A second consultant must sign before the records change.");
    onClose();
  }

  return (
    <Modal title={reversing ? "Reverse merge" : "Adjudicate duplicate candidate"} onClose={onClose} width={760}>
      <div className="sm mut" style={{ marginBottom: 10 }}>Match score {n1(d.score * 100)}% · {d.why}</div>
      <table className="t mb14">
        <thead><tr><th /><th>A · {d.aMrn}</th><th>B · {d.bMrn}</th></tr></thead>
        <tbody>
          {rows.map(([k, f]) => {
            const same = f(A) === f(B);
            return <tr key={k}><td className="xs mut">{k}</td><td className="sm">{f(A)}</td><td className="sm" style={same ? undefined : { color: "var(--amber)", fontWeight: 600 }}>{f(B)}</td></tr>;
          })}
        </tbody>
      </table>
      <div className="fld" style={{ marginBottom: 12 }}><label>Evidence / reason</label><textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. confirmed identity with patient and photo ID at clinic" /></div>
      {me.cls !== "consultant" ? <div className="deny">Only a consultant may propose a merge decision.</div> : reversing ? (
        <button className="btn p" disabled={!reason.trim()} onClick={() => record("unmerged")}>Propose reversal for signature</button>
      ) : (
        <div style={{ display: "flex", gap: 9 }}>
          <button className="btn p" disabled={!reason.trim()} onClick={() => record("merged")}>Same person — propose merge</button>
          <button className="btn" disabled={!reason.trim()} onClick={() => record("not-duplicate")}>Different people</button>
        </div>
      )}
      {openPending(st).some((p) => p.docType === "merge") && <div className="xs mut" style={{ marginTop: 10 }}>Merges waiting for a second signature are listed in Review & sign-off.</div>}
    </Modal>
  );
}

function ProfileModal({ p, onClose }: { p: Profile; onClose: () => void }) {
  const st = useStore();
  const al = aliasesFor(st, p);
  return (
    <Modal title={`${p.name} · ${p.pid}`} onClose={onClose} width={640}>
      <table className="t mb14"><tbody>
        {([["Enterprise ID", p.epi], ["Date of birth", p.dob ?? "missing"], ["Blood group", p.blood ?? "missing"], ["Phone", p.phone ?? "missing"],
          ["Address", `${p.area ?? "—"}, ${p.city}, ${p.state} ${p.pin ?? ""}`], ["Language", p.lang], ["Scheme", p.scheme ?? "missing"],
          ["Next of kin", p.kin ? `${p.kin.name} (${p.kin.rel}) ${p.kin.phone}` : "missing"], ["Registered", `${SITENAME[p.regCentre]} since ${p.regSince}`],
          ["Diabetes", `${p.dmType} · ${p.dmYears}y · ${p.therapy} · ${p.smoking}`], ["Comorbidities", p.comorbid.join(", ")],
          ["Previous amputation / revascularisation / dialysis", `${p.prevAmp ? "yes" : "no"} / ${p.prevRevasc ? "yes" : "no"} / ${p.dialysis ? "yes" : "no"}`],
          ["Consent", `care sharing ${p.consent.careShare ? "yes" : "no"} · research ${p.consent.research ? "yes" : "no"} · photography ${p.consent.photography}`]] as const).map(([k, v]) => (
          <tr key={k}><td className="xs mut" style={{ width: "34%" }}>{k}</td><td className="sm" style={String(v).includes("missing") ? { color: "var(--amber)" } : undefined}>{v}</td></tr>
        ))}
      </tbody></table>
      <div className="fsec-h"><h4>Centre MRNs</h4></div>
      <table className="t mb14"><tbody>{al.map((a) => <tr key={a.mrn}><td className="num sm">{a.mrn}</td><td className="sm">{SITENAME[a.centre]}</td><td className="xs mut">{a.source}</td></tr>)}</tbody></table>
      {p.detailed && <Link className="btn p" href={`/clinical/patient/${p.pid}`}>Open clinical chart</Link>}
    </Modal>
  );
}
