"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Guard, Top, useMe } from "@/components/cx/Shell";
import { Card, Denied, Pill, toast } from "@/components/cx/ui";
import { CLIN, NET, SIGN, n1, newsBand, newsClass, news2, pat, winAgg } from "@/lib/cx/data";
import { audit, contentHash, getState, nowIso, setState, uid, useStore } from "@/lib/cx/store";
import { careRelationship } from "@/lib/cx/users";
import { latestObs } from "../round/Round";

type F = { rr: string; spo2: string; o2: string; hr: string; sbp: string; dbp: string; pulse: string; temp: string; avpu: string; cbg: string; uo: string };

export function Nurse({ pid }: { pid: string }) {
  return (
    <Guard screen="nurse">
      <Top title="Nurse observation entry" sub="Replaces the notepad and the phone photo" />
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
  const lo = latestObs(st, p.id);
  const v = p.v;
  const init = (): F => ({
    rr: String(lo?.rr ?? v.rr[71]), spo2: String(lo?.spo2 ?? v.spo2[71]), o2: String(lo?.o2 ?? v.o2[71]), hr: String(lo?.hr ?? v.hr[71]),
    sbp: String(lo?.sbp ?? v.sbp[71]), dbp: String(lo?.dbp ?? v.dbp[71]), pulse: String(lo?.pulse ?? v.pulse[71]),
    temp: String(lo?.temp ?? n1(v.temp[71])), avpu: lo?.avpu ?? v.avpu[71], cbg: String(lo?.cbg ?? v.cbg[71]), uo: String(lo?.uo ?? v.uo[71]),
  });
  const [f, setF] = useState<F>(init);
  const [note, setNote] = useState("");
  const [attest, setAttest] = useState(false);
  const [online, setOnline] = useState(true);
  const [key, setKey] = useState(p.id);
  if (key !== p.id) { setKey(p.id); setF(init()); }

  // Bedside capture must tolerate network loss (NFR): queue locally, sync on reconnect.
  useEffect(() => {
    const sync = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine && getState().obs.some((o) => !o.synced)) {
        const n = getState().obs.filter((o) => !o.synced).length;
        setState((s) => ({ obs: s.obs.map((o) => ({ ...o, synced: true })) }));
        toast(`${n} queued observation set${n > 1 ? "s" : ""} synced.`);
      }
    };
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => { window.removeEventListener("online", sync); window.removeEventListener("offline", sync); };
  }, []);

  if (!ok) return <Denied why={`${me.name} is scoped to ${me.centres.join(", ")}; these patients are Chennai in-patients.`} />;

  const num = (k: keyof F) => Number(f[k]);
  const r = news2({ rr: num("rr"), spo2: num("spo2"), o2: num("o2"), sbp: num("sbp"), pulse: num("pulse"), temp: num("temp"), avpu: f.avpu });
  const b = newsBand(r.total);
  const col = { s0: "#12874a", s1: "#4b8fd4", s2: "#b57314", s3: "#d2541a", s4: "#c32b45" }[newsClass(r.total)];
  const invalid = (["rr", "spo2", "hr", "sbp", "dbp", "pulse", "temp", "cbg", "uo"] as const).filter((k) => f[k] === "" || isNaN(num(k)));
  const range: Partial<Record<keyof F, [number, number]>> = { rr: [3, 60], spo2: [50, 100], hr: [20, 250], sbp: [50, 260], dbp: [20, 160], pulse: [20, 250], temp: [30, 43], cbg: [20, 600], uo: [0, 1000] };
  const outOfRange = (Object.keys(range) as (keyof F)[]).filter((k) => !invalid.includes(k as never) && (num(k) < range[k]![0] || num(k) > range[k]![1]));

  async function save() {
    const at = nowIso();
    const entry = {
      id: uid("OBS"), pid: p.id, at, by: me.name, mode: "direct" as const,
      hr: num("hr"), pulse: num("pulse"), sbp: num("sbp"), dbp: num("dbp"), spo2: num("spo2"), o2: num("o2"), rr: num("rr"),
      temp: num("temp"), avpu: f.avpu, cbg: num("cbg"), uo: num("uo"), news: r.total, three: r.three, synced: navigator.onLine, note: note || undefined, algo: "NEWS2 · RCP 2017 · SpO₂ scale 1",
    };
    const hash = await contentHash(entry);
    const escalate = r.total >= 5 || r.three;
    setState((s) => ({
      obs: [...s.obs, entry],
      ledger: [{ id: uid("SO"), at, kind: "clinical", docType: "obs", doc: `Observation set · ${p.id} ${p.name}`, entered: me.name, enteredRole: me.role, centre: "CHN",
        action: "nurse-obs", signer: me.name, attest: SIGN.attest["nurse-obs"], version: 1, amended: false, hash, method: "SSO session + attestation", latencyMin: 0 }, ...s.ledger],
      pending: escalate ? [{ id: uid("SO"), kind: "clinical", doc: `Nursing observation set · ${p.id} ${p.name} · ${at.slice(11)}`, docType: "obs", entered: me.name, enteredRole: me.role, at,
        need: "counter", needFrom: p.consultant, priority: "high", why: `NEWS2 of ${r.total}${r.three ? " with a single parameter scoring 3" : ""} recorded. Escalation rule A01 fired and the acknowledgement is the countersignature.`,
        subject: { type: "obs", ref: entry.id }, content: JSON.stringify(entry), version: 1 }, ...s.pending] : s.pending,
    }));
    audit(me.name, "write", `${p.id} ${p.name}`, `Observation set saved · NEWS2 ${r.total}${entry.synced ? "" : " · queued offline"}`);
    toast(escalate ? `Saved. NEWS2 ${r.total}: ${b[1]}. Escalation sent to ${p.consultant} for countersignature.` : `Saved. NEWS2 ${r.total}. ${entry.synced ? "" : "Queued offline — will sync when the network returns."}`);
    setNote("");
    setAttest(false);
  }

  const fld = (label: string, sub: string, k: keyof F) => (
    <div className="ob" key={k}>
      <label htmlFor={`n_${k}`}>{label}<span>{sub}</span></label>
      <input id={`n_${k}`} inputMode="decimal" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })}
        className={r.p[k] === 3 ? "p3" : r.p[k] === 2 ? "p2" : r.p[k] === 1 ? "p1" : ""} aria-invalid={outOfRange.includes(k) || invalid.includes(k as never)} />
    </div>
  );

  return (
    <div className="grid2">
      <div>
        <div className="phone">
          <div className="phone-t">≡ Observation round — {p.bed}<span style={{ marginLeft: "auto" }} className={online ? "" : "pill a"}>{online ? "online" : "offline · saving locally"}</span></div>
          <div className="phone-b">
            <div className="fld" style={{ marginBottom: 12 }}>
              <label>Patient</label>
              <select value={p.id} onChange={(e) => router.replace(`/clinical/nurse?pid=${e.target.value}`, { scroll: false })}>
                {CLIN.patients.map((x) => <option key={x.id} value={x.id}>{x.bed} · {x.name}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 13 }}>
              <div style={{ font: "600 14px/1.3 var(--f)" }}>{p.name}</div>
              <div className="xs mut">{p.id} · {p.age}{p.sex} · {p.wt} kg · last set {lo ? `${lo.at.slice(11)} by ${lo.by}` : "06:00 (fixture)"}</div>
            </div>
            {fld("Respiratory rate", "breaths/min", "rr")}
            {fld("SpO₂", "%", "spo2")}
            <div className="ob"><label htmlFor="n_o2">On oxygen<span>air or supplemental</span></label>
              <select id="n_o2" value={f.o2} onChange={(e) => setF({ ...f, o2: e.target.value })}><option value="0">Air</option><option value="1">O₂</option></select></div>
            {fld("Heart rate", "bpm, monitor", "hr")}
            {fld("Systolic BP", "mmHg", "sbp")}
            {fld("Diastolic BP", "mmHg", "dbp")}
            {fld("Pulse", "beats/min, palpated", "pulse")}
            {fld("Temperature", "°C", "temp")}
            <div className="ob"><label htmlFor="n_avpu">Consciousness<span>ACVPU</span></label>
              <select id="n_avpu" value={f.avpu} onChange={(e) => setF({ ...f, avpu: e.target.value })}>{["A", "C", "V", "P", "U"].map((x) => <option key={x}>{x}</option>)}</select></div>
            {fld("Blood glucose", "mg/dL", "cbg")}
            {fld("Urine output", "mL since last round", "uo")}
            <div className="live" style={{ background: col }}>
              <div className="k">NEWS2 — calculated as you type</div>
              <div className="v">{r.total}</div>
              <div className="a">{b[1]}{r.three && <><br /><b>One parameter scores 3 — escalates on its own.</b></>}</div>
            </div>
            {(invalid.length > 0 || outOfRange.length > 0) && (
              <div className="deny" style={{ marginBottom: 11 }}>{invalid.length > 0 ? `Enter a number for: ${invalid.join(", ")}. ` : ""}{outOfRange.length > 0 ? `Outside the plausible range: ${outOfRange.join(", ")}. Re-check before saving.` : ""}</div>
            )}
            <div className="fld" style={{ marginBottom: 11 }}><label>Note</label>
              <textarea placeholder="Anything the numbers do not capture…" style={{ minHeight: 58 }} value={note} onChange={(e) => setNote(e.target.value)} /></div>
            <label className="sm" style={{ display: "flex", gap: 8, marginBottom: 11, cursor: "pointer" }}>
              <input type="checkbox" checked={attest} onChange={(e) => setAttest(e.target.checked)} /> {SIGN.attest["nurse-obs"]}
            </label>
            <button className="btn p" style={{ width: "100%" }} disabled={!attest || invalid.length > 0 || outOfRange.length > 0} onClick={save}>Save observation round</button>
          </div>
        </div>
      </div>

      <div>
        <Card title="Observations saved in this session" className="mb14" right={<Link className="btn sm" href={`/clinical/patient/${p.id}`}>Open chart</Link>}>
          {st.obs.filter((o) => o.pid === p.id).length === 0 ? <div className="sm mut">None yet for {p.name}. Saved sets appear on the chart trends straight away.</div> : (
            <table className="t"><tbody>
              {[...st.obs].filter((o) => o.pid === p.id).reverse().map((o) => (
                <tr key={o.id}><td className="num xs mut">{o.at.replace("T", " ")}</td><td className="sm">{o.by}</td>
                  <td><Pill c={o.news >= 7 ? "r" : o.news >= 5 ? "o" : o.news >= 1 ? "b" : "g"}>NEWS2 {o.news}</Pill></td>
                  <td>{o.synced ? <Pill c="g">synced</Pill> : <Pill c="a">queued</Pill>}</td></tr>
              ))}
            </tbody></table>
          )}
        </Card>
        <Card title="What changes for the sister" className="mb14">
          <table className="t"><thead><tr><th>Today</th><th>With the app</th></tr></thead><tbody>
            {[["Vitals written on a notepad at the bedside", "Entered once, on the phone, at the bedside"],
              ["Page photographed and sent to the doctor on WhatsApp", "Chart updates instantly; no photograph needed"],
              ["NEWS2 worked out in the head, if at all", "Scored as you type, before you leave the bed"],
              ["Escalation depends on who is on shift", "Escalation ladder is the same every shift and is timed"],
              ["Network drops lose the round", "Saved on the device and synced when the connection returns"],
              ["Nothing is auditable", "Every entry timestamped, attributed and attested"]].map((x) => (
              <tr key={x[0]}><td className="sm mut">{x[0]}</td><td className="sm">{x[1]}</td></tr>
            ))}
          </tbody></table>
        </Card>
        <Card title="Notepad photo bridge" right={<Pill c="v">rule A14 · pilot</Pill>}>
          <div className="sm" style={{ color: "var(--ink2)", lineHeight: 1.65 }}>
            A site cannot switch overnight, and Hyderabad is still capturing {100 - Math.round(winAgg(NET.sites[2], 30).digitalPct)}% of its observations on paper. The bridge lets nurses photograph the page exactly as they do now; values are read, mapped to channels and confirmed with one tap. Low-confidence fields cannot be accepted silently. OCR of handwriting will never be reliable enough to drive escalation on its own.
          </div>
        </Card>
        <Card title="Escalation ladder" hint="rule A01 · fixed, timed, identical every shift" className="mt14">
          <table className="t"><thead><tr><th>NEWS2</th><th>Frequency</th><th>Response</th></tr></thead><tbody>
            {([["0", "12 hourly", "Routine", "g"], ["1-4", "4-6 hourly", "Registered nurse review", "b"], ["3 in one parameter", "1 hourly", "Urgent ward-clinician review", "a"],
              ["5-6", "1 hourly", "Urgent clinician review within 1 hour", "o"], ["7 or more", "Continuous", "Emergency — critical care team", "r"]] as const).map((x) => (
              <tr key={x[0]}><td><Pill c={x[3]}>{x[0]}</Pill></td><td className="sm">{x[1]}</td><td className="sm">{x[2]}</td></tr>
            ))}
          </tbody></table>
        </Card>
      </div>
    </div>
  );
}
