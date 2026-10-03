"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LineChart } from "@/components/cx/charts";
import { Guard, Top, useMe } from "@/components/cx/Shell";
import { Card, Denied, Modal, NewsBadge, Pill, toast } from "@/components/cx/ui";
import { ACU, CHANNELS, alertsFor, hoursAgo, n1, newsBand, pat, type Channel, type Patient } from "@/lib/cx/data";
import { audit, nowIso, setState, uid, useStore, type ObsEntry, type State } from "@/lib/cx/store";
import { careRelationship } from "@/lib/cx/users";

type Series = Record<string, number[]>;

/** Fixture hourly vitals with any observations entered in this browser appended. */
function seriesFor(p: Patient, extra: ObsEntry[]): Series {
  const v = p.v as unknown as Record<string, (number | string)[]>;
  const s: Series = {};
  for (const k of ["hr", "pulse", "sbp", "dbp", "map", "spo2", "rr", "temp", "cbg", "uo", "o2", "news2"]) {
    s[k] = [...(v[k] as number[])];
  }
  extra.forEach((o) => {
    s.hr.push(o.hr); s.pulse.push(o.pulse); s.sbp.push(o.sbp); s.dbp.push(o.dbp);
    s.map.push(Math.round((o.sbp + 2 * o.dbp) / 3)); s.spo2.push(o.spo2); s.rr.push(o.rr); s.temp.push(o.temp);
    s.cbg.push(o.cbg); s.uo.push(o.uo); s.o2.push(o.o2); s.news2.push(o.news);
  });
  return s;
}

export function Chart(props: { pid: string; range: number; zoom: string | null; zwin: number | null }) {
  const p = pat(props.pid);
  return (
    <Guard screen="patient">
      {p ? <Inner p={p} {...props} /> : (
        <><Top title="Patient chart" /><div className="wrap"><Card title="Not found">No detailed chart for {props.pid}. Detailed hourly charts exist for the six Chennai unit patients in this prototype. <Link href="/clinical/round">Back to the round</Link></Card></div></>
      )}
    </Guard>
  );
}

function Inner({ p, range, zoom, zwin }: { p: Patient; range: number; zoom: string | null; zwin: number | null }) {
  const me = useMe();
  const st = useStore();
  const ok = careRelationship(me, "CHN");
  const logged = useRef("");
  useEffect(() => {
    const key = me.id + p.id + ok;
    if (logged.current === key) return;
    logged.current = key;
    if (ok) audit(me.name, "read", `${p.id} ${p.name}`, "Opened patient chart");
    else audit(me.name, "deny", `${p.id} ${p.name}`, "No care relationship at Chennai");
  }, [me, p, ok]);

  if (!ok) {
    return (
      <><Top title="Patient chart" sub={`${p.id}`} />
        <div className="wrap"><Denied why={`${me.name} has no care relationship with this patient. ${p.name} is an in-patient at Chennai; your access is scoped to ${me.centres.join(", ")}${me.cls === "research" || me.cls === "custodian" ? " and research roles never see identifiable clinical records" : ""}.`} /></div></>
    );
  }
  return <Body p={p} range={range} zoom={zoom} zwin={zwin} st={st} />;
}

function Body({ p, range, zoom, zwin, st }: { p: Patient; range: number; zoom: string | null; zwin: number | null; st: State }) {
  const me = useMe();
  const [hover, setHover] = useState<number | null>(null);
  const [modal, setModal] = useState<"transfer" | "discharge" | null>(null);
  const extra = st.obs.filter((o) => o.pid === p.id).sort((a, b) => a.at.localeCompare(b.at));
  const v = seriesFor(p, extra);
  const N = v.hr.length, R = Math.min(range + extra.length, N), s0 = N - R;
  const cut = (a: number[]) => a.slice(s0);
  const last = N - 1;
  const news = v.news2[last];
  const L = p.labs[3], al = alertsFor(p, news), ac = ACU[p.acuity];
  const adt = st.adt[p.id];
  const bed = adt?.bed ?? p.bed;
  const xl = [{ i: 0, t: `-${range}h` }, { i: Math.floor(R / 2), t: `-${Math.floor(range / 2)}h` }, { i: R - 1, t: "now" }];
  const base = `/clinical/patient/${p.id}?range=${range}`;
  const read = (i: number | null, f: (i: number) => string) => (i == null ? null : <b style={{ color: "var(--ink)" }}>{f(s0 + i)}</b>);
  const lo = extra[extra.length - 1];

  const tiles: [string, string | number, string, string][] = [
    ["Heart rate", v.hr[last], "bpm", v.hr[last] > 110 || v.hr[last] < 50 ? "al" : ""],
    ["Pulse", v.pulse[last], "bpm · palpated", Math.abs(v.pulse[last] - v.hr[last]) > 6 ? "wn" : ""],
    ["Blood pressure", `${v.sbp[last]}/${v.dbp[last]}`, `mmHg · MAP ${v.map[last]}`, v.sbp[last] <= 100 ? "al" : ""],
    ["SpO₂", v.spo2[last], "%" + (v.o2[last] ? " · on O₂" : " · air"), v.spo2[last] <= 93 ? "al" : v.spo2[last] <= 95 ? "wn" : ""],
    ["Respiratory rate", v.rr[last], "/min", v.rr[last] >= 25 || v.rr[last] <= 8 ? "al" : v.rr[last] >= 21 ? "wn" : ""],
    ["Temperature", n1(v.temp[last]), "°C", v.temp[last] >= 38.1 ? "al" : ""],
    ["Blood glucose", v.cbg[last], "mg/dL", v.cbg[last] < 70 ? "al" : v.cbg[last] > 250 ? "wn" : ""],
    ["Urine output", v.uo[last], `mL/h · ${p.uo6} mL/kg/h`, p.uo6 < 0.5 ? "al" : ""],
    ["Creatinine", L.creat, `mg/dL · base ${p.baselineCreat}`, p.aki ? "al" : ""],
    ["eGFR", L.egfr, "mL/min/1.73m²", L.egfr < 30 ? "al" : L.egfr < 60 ? "wn" : ""],
  ];

  return (
    <>
      <Top title="Patient chart" sub={`${p.name} · ${bed} · ${p.dx}`}
        right={<><button className="btn sm" onClick={() => setModal("transfer")}>Transfer</button><button className="btn sm" onClick={() => setModal("discharge")} disabled={!!adt?.discharged}>{adt?.discharged ? "Discharged" : "Discharge"}</button><Link className="btn sm" href={`/clinical/audit?subject=${p.id}`}>Access report</Link></>} />
      <div className="wrap">
        <div className="phead">
          <div>
            <div className="nm">{p.name} <span className="mut sm">{p.age}{p.sex}</span></div>
            <div className="mt">{p.id} · {bed}{adt?.unit ? ` (${adt.unit})` : ""} · admitted {p.adm} (day {p.los}) · {p.consultant} · {p.wt} kg</div>
            <div className="dx">{p.dx}</div><div className="sb">{p.sub}</div>
            {p.allergy.length > 0 && <div className="sb"><Pill c="r">Allergy</Pill> {p.allergy.join(" · ")}</div>}
            {adt?.discharged && <div className="sb"><Pill c="g">Discharged {adt.discharged.at.replace("T", " ")} by {adt.discharged.by}</Pill></div>}
          </div>
          <div className="rt">
            <NewsBadge n={news} size={58} />
            <Pill c={ac[0]}>{ac[1]}</Pill>
            <span className="xs mut">{newsBand(news)[1]}</span>
          </div>
        </div>

        {lo && (
          <div className="disc" style={{ background: "var(--blue-s)", borderColor: "#b9d4f3", color: "var(--ink2)" }}>
            <b style={{ color: "var(--ink)" }}>{extra.length} observation set{extra.length > 1 ? "s" : ""} entered since the last fixture hour.</b> Latest {lo.at.replace("T", " ")} by {lo.by} ({lo.mode}{lo.synced ? "" : ", waiting to sync"}). Trends below include them.
          </div>
        )}

        {al.length > 0 && (
          <Card title="Active alerts" hint={`${al.length} raised by the rule engine`} attn className="mb14" bodyClass={null}>
            {al.map((a) => (
              <div key={a.t} className="att-i">
                <div className={`ic ${a.sev === "r" ? "r" : a.sev === "g" ? "v" : "a"}`}>{a.sev === "g" ? "✓" : "!"}</div>
                <div style={{ flex: 1 }}><div className="t">{a.t} <Pill>{a.rule}</Pill></div><div className="d">{a.d}</div></div>
              </div>
            ))}
          </Card>
        )}

        <div className="vit">
          {tiles.map((t) => <div key={t[0]} className={`v-t ${t[3]}`}><div className="k">{t[0]}</div><div className="v">{t[1]}</div><div className="u">{t[2]}</div></div>)}
        </div>

        <div className="filt">
          <div className="fg"><span className="fl">Window</span>
            <div className="seg">{[24, 48, 72].map((r) => <Link key={r} scroll={false} href={`/clinical/patient/${p.id}?range=${r}${zoom ? `&zoom=${zoom}` : ""}`} className={range === r ? "on" : ""} style={segLink(range === r)}>{r} hours</Link>)}</div>
          </div>
          <div className="fg"><span className="fl">Zoom</span>
            <div className="seg">
              <Link scroll={false} href={base} style={segLink(!zoom)}>All panels</Link>
              {CHANNELS.map((c) => <Link key={c.k} scroll={false} href={`${base}&zoom=${c.k}`} style={segLink(zoom === c.k)}>{c.shortName}</Link>)}
            </div>
          </div>
          <div style={{ flex: 1 }} />
          <span className="xs mut">hourly observations · hover any chart for a synchronised readout</span>
        </div>

        {zoom ? <Zoom p={p} v={v} ch={CHANNELS.find((c) => c.k === zoom) ?? CHANNELS[0]} range={range} zwin={zwin} extraN={extra.length} /> : (
          <div className="grid2 mb14" onMouseLeave={() => setHover(null)}>
            <Panel title="Heart rate and pulse" unit="bpm" rd={read(hover, (i) => `${v.hr[i]} / ${v.pulse[i]} bpm · ${hoursAgo(Math.min(i, 71))}`)}>
              <LineChart w={560} h={132} xLab={xl} hover={hover} onHover={setHover} series={[{ c: "#c32b45", w: 1.9, d: cut(v.hr) }, { c: "#e9a0ae", w: 1.3, dash: "3 2", d: cut(v.pulse) }]} />
            </Panel>
            <Panel title="Blood pressure" unit="mmHg" rd={read(hover, (i) => `${v.sbp[i]}/${v.dbp[i]} · MAP ${v.map[i]}`)}>
              <LineChart w={560} h={132} xLab={xl} hover={hover} onHover={setHover} refs={[{ v: 90, c: "#c32b45" }]} series={[{ c: "#0b6bcb", w: 1.9, d: cut(v.sbp) }, { c: "#8fbdea", w: 1.6, d: cut(v.dbp) }, { c: "#0d9488", w: 1.2, dash: "4 2", d: cut(v.map) }]} />
            </Panel>
            <Panel title="SpO₂" unit="%" rd={read(hover, (i) => `${v.spo2[i]}%${v.o2[i] ? " on O₂" : " air"}`)}>
              <LineChart w={560} h={132} xLab={xl} hover={hover} onHover={setHover} yMin={86} yMax={100} band={{ lo: 96, hi: 100 }} refs={[{ v: 92, c: "#c32b45" }]} series={[{ c: "#0d9488", w: 1.9, fill: true, d: cut(v.spo2) }]} />
            </Panel>
            <Panel title="Blood glucose" unit="mg/dL · green band is 70-180 target" rd={read(hover, (i) => `${v.cbg[i]} mg/dL`)}>
              <LineChart w={560} h={132} xLab={xl} hover={hover} onHover={setHover} yMin={30} band={{ lo: 70, hi: 180 }} refs={[{ v: 54, c: "#c32b45" }]} series={[{ c: "#6d4aff", w: 1.9, d: cut(v.cbg), mark: (x) => x < 70 }]} />
            </Panel>
            <Panel title="Temperature" unit="°C" rd={read(hover, (i) => `${n1(v.temp[i])} °C`)}>
              <LineChart w={560} h={132} xLab={xl} hover={hover} onHover={setHover} refs={[{ v: 38, c: "#d2541a" }]} fmtY={(x) => n1(x)} series={[{ c: "#d2541a", w: 1.9, d: cut(v.temp) }]} />
            </Panel>
            <Panel title="Respiratory rate" unit="/min" rd={read(hover, (i) => `${v.rr[i]}/min`)}>
              <LineChart w={560} h={132} xLab={xl} hover={hover} onHover={setHover} series={[{ c: "#b57314", w: 1.9, d: cut(v.rr) }]} />
            </Panel>
            <Panel title="Urine output" unit="mL/h · red line is 0.5 mL/kg/h" rd={read(hover, (i) => `${v.uo[i]} mL/h`)}>
              <LineChart w={560} h={132} xLab={xl} hover={hover} onHover={setHover} yMin={0} refs={[{ v: p.wt * 0.5, c: "#c32b45" }]} series={[{ c: "#0b6bcb", w: 1.7, fill: true, d: cut(v.uo) }]} />
            </Panel>
            <Panel title="NEWS2" unit="total score" rd={read(hover, (i) => `NEWS2 ${v.news2[i]}`)}>
              <LineChart w={560} h={132} xLab={xl} hover={hover} onHover={setHover} yMin={0} refs={[{ v: 5, c: "#d2541a" }, { v: 7, c: "#c32b45" }]} series={[{ c: "#10151c", w: 1.7, step: true, fill: true, d: cut(v.news2) }]} />
            </Panel>
          </div>
        )}

        <div className="grid2 mb14">
          <Card title="Laboratory trend" hint="four draws over 72 hours">
            <table className="t">
              <thead><tr><th>Test</th><th>-72h</th><th>-48h</th><th>-24h</th><th>Now</th><th>Trend</th></tr></thead>
              <tbody>
                {([["Creatinine", "creat", "mg/dL", "low"], ["eGFR", "egfr", "mL/min", "high"], ["Potassium", "k", "mmol/L", "low"], ["Sodium", "na", "mmol/L", ""],
                  ["Haemoglobin", "hb", "g/dL", "high"], ["White cells", "wbc", "×10⁹/L", "low"], ["CRP", "crp", "mg/L", "low"], ["Lactate", "lactate", "mmol/L", "low"]] as const).map((r) => {
                  const vals = p.labs.map((l) => l[r[1]] as number);
                  const bad = r[3] === "low" ? vals[3] > vals[0] * 1.25 : r[3] === "high" ? vals[3] < vals[0] * 0.8 : false;
                  return (
                    <tr key={r[0]}>
                      <td className="sm">{r[0]} <span className="mut xs">{r[2]}</span></td>
                      {vals.map((x, i) => <td key={i} className="num sm" style={i === 3 && bad ? { color: "#c32b45", fontWeight: 600 } : undefined}>{x}</td>)}
                      <td style={{ width: 80 }}><LineChart w={70} h={22} pl={2} yTicks={0} noAxis series={[{ c: bad ? "#c32b45" : "#8a94a1", w: 1.5, dots: true, d: vals }]} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
          <Card title="Glycaemic control" hint={`72-hour window · HbA1c ${p.hba1c}%`}>
            <div className="kpis" style={{ gridTemplateColumns: "repeat(3,1fr)", marginBottom: 12 }}>
              {([["Time in range", p.tir + "%", "70-180 mg/dL", p.tir < 50 ? "bad" : p.tir < 70 ? "warn" : "good"], ["Lowest", p.cbgMin, "mg/dL", p.cbgMin < 54 ? "bad" : p.cbgMin < 70 ? "warn" : ""], ["Highest", p.cbgMax, "mg/dL", p.cbgMax > 300 ? "warn" : ""]] as const).map((k) => (
                <div key={k[0]} className={`kpi ${k[3]}`} style={{ padding: "10px 12px" }}><div className="k">{k[0]}</div><div className="v" style={{ fontSize: 20 }}>{k[1]}</div><div className="d">{k[2]}</div></div>
              ))}
            </div>
            <div className="xs mut mb14">{p.hypoCount ? <><b style={{ color: "#c32b45" }}>{p.hypoCount} hours below 70 mg/dL{p.sevHypoCount ? `, ${p.sevHypoCount} below 54 mg/dL (severe)` : ""}.</b> Rule A03 fired on each episode.</> : "No hypoglycaemic episodes in the window."}</div>
            <div className="card-h" style={{ padding: "0 0 9px", border: 0 }}><h3 style={{ fontSize: 12 }}>Active medication</h3></div>
            <table className="t"><tbody>
              {p.meds.map((m) => (
                <tr key={m.drug}><td className="sm"><b>{m.drug}</b> <span className="mut">{m.dose}</span><div className="xs mut">{m.route}</div></td>
                  <td style={{ textAlign: "right" }}>{m.status === "active" ? <Pill c="g">Active</Pill> : <Pill c="r">{m.status}</Pill>}</td></tr>
              ))}
            </tbody></table>
          </Card>
        </div>

        <Card title="Nursing observations and notes" hint={`${p.notes.filter((n) => n.src === "notepad").length} of ${p.notes.length} still arriving as a photographed notepad page`}
          right={<Link className="btn sm" href={`/clinical/nurse?pid=${p.id}`}>Open nurse entry</Link>} bodyClass={null}>
          <div className="tl">
            {[...extra].reverse().map((o) => (
              <div key={o.id} className="tl-i"><div className="tl-t">{o.at.slice(11)}</div><div className="tl-b">
                <div className="hd"><span className="by">{o.by}</span><Pill c="g">structured entry</Pill>{!o.synced && <Pill c="a">pending sync</Pill>}<Pill c={o.news >= 5 ? "o" : "n"} title={o.algo}>NEWS2 {o.news}</Pill><span className="xs mut">{o.mode} · {o.algo}</span></div>
                <div className="tx">RR {o.rr} · SpO₂ {o.spo2}%{o.o2 ? " on O₂" : ""} · BP {o.sbp}/{o.dbp} · pulse {o.pulse} · T {o.temp} · {o.avpu} · CBG {o.cbg} · urine {o.uo} mL{o.note ? ` — ${o.note}` : ""}</div>
              </div></div>
            ))}
            {p.notes.map((nt) => (
              <div key={nt.h + nt.by} className="tl-i"><div className="tl-t">{hoursAgo(nt.h)}</div><div className="tl-b">
                <div className="hd"><span className="by">{nt.by}</span>{nt.src === "notepad" ? <Pill c="a">notepad photo</Pill> : <Pill c="g">structured entry</Pill>}</div>
                <div className="tx">{nt.text}</div>
              </div></div>
            ))}
          </div>
        </Card>
      </div>

      {modal === "transfer" && <TransferModal p={p} onClose={() => setModal(null)} />}
      {modal === "discharge" && <DischargeModal p={p} me={me.name} role={me.role} onClose={() => setModal(null)} />}
    </>
  );
}

const segLink = (on: boolean) => ({ padding: "6px 12px", borderRadius: 4, font: "500 12px/1 var(--f)", color: on ? "var(--ink)" : "var(--ink2)", background: on ? "var(--surf)" : "none", boxShadow: on ? "var(--sh)" : "none", textDecoration: "none" });

function Panel({ title, unit, rd, children }: { title: string; unit: string; rd: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="card"><div className="card-h"><h3>{title}</h3><div className="sp" /><span className="hint">{rd ?? unit}</span></div>
      <div className="card-b tight">{children}</div></div>
  );
}

function zstat(d: number[], ch: Channel, wt: number) {
  const n = d.length, s = [...d].sort((a, b) => a - b);
  let sx = 0, sy = 0, sxy = 0, sxx = 0;
  d.forEach((y, i) => { sx += i; sy += y; sxy += i * y; sxx += i * i; });
  return {
    n, min: s[0], max: s[n - 1], mean: sy / n, med: s[Math.floor(n / 2)], last: d[n - 1], first: d[0],
    inr: ch.lo == null ? null : d.filter((x) => x >= ch.lo! && x <= ch.hi!).length,
    crit: ch.crit == null ? null : d.filter((x) => (ch.inv ? x <= ch.crit! : x >= ch.crit!)).length,
    slope: (n * sxy - sx * sy) / Math.max(1e-9, n * sxx - sx * sx),
    uoKg: ch.k === "uo" ? sy / n / wt : null,
  };
}

function Zoom({ p, v, ch, range, zwin, extraN }: { p: Patient; v: Series; ch: Channel; range: number; zwin: number | null; extraN: number }) {
  const isLab = ch.k === "creat";
  const full = isLab ? p.labs.map((l) => l.creat) : v[ch.k as string];
  const hrs = isLab ? [0, 24, 48, 71] : null;
  const win = isLab ? full.length : Math.min(zwin ?? range + extraN, full.length);
  const d = full.slice(full.length - win);
  const S = zstat(d, ch, p.wt);
  const f = (x: number) => (ch.fmt ? n1(x) : Math.round(x));
  const perDay = isLab ? S.slope * (24 / 24) : S.slope * 24;
  const base = `/clinical/patient/${p.id}?range=${range}&zoom=${ch.k}`;
  const xl = isLab ? [{ i: 0, t: "-72h" }, { i: 1, t: "-48h" }, { i: 2, t: "-24h" }, { i: 3, t: "now" }]
    : [{ i: 0, t: `-${win}h` }, { i: Math.floor(win / 2), t: `-${Math.floor(win / 2)}h` }, { i: win - 1, t: "now" }];
  const refs = [...(ch.crit != null ? [{ v: ch.crit, c: "#c32b45" }] : []), ...(ch.k === "uo" ? [{ v: p.wt * 0.5, c: "#c32b45" }] : []), ...(ch.k === "news2" ? [{ v: 5, c: "#d2541a" }] : []), ...(isLab ? [{ v: p.baselineCreat * 1.5, c: "#d2541a" }, { v: p.baselineCreat * 2, c: "#c32b45" }] : [])];

  return (
    <>
      <Card title={`${ch.name} — zoomed`} hint={`${ch.unit} · ${isLab ? "laboratory draws" : "hourly"} · ${S.n} values in view`} className="mb14"
        right={<>
          {!isLab && <div className="seg">{([[null, "Full window"], [24, "Last 24h"], [12, "Last 12h"], [6, "Last 6h"]] as const).map(([w, l]) => (
            <Link key={String(w)} scroll={false} href={w ? `${base}&zwin=${w}` : base} style={segLink(zwin === w)}>{l}</Link>
          ))}</div>}
          <Link className="btn sm" href={`/clinical/patient/${p.id}?range=${range}`}>Close zoom</Link>
        </>}>
        <LineChart w={1180} h={300} yTicks={5} fmtY={(x) => f(x)} refs={refs} xs={hrs ?? undefined} xLab={xl}
          band={ch.lo != null && ch.hi != null ? { lo: ch.lo, hi: ch.hi } : null}
          series={[{ c: ch.c, w: 2.2, fill: ch.k === "uo" || ch.k === "news2", step: ch.k === "news2", dots: isLab, d, mark: ch.crit == null ? undefined : (x) => (ch.inv ? x <= ch.crit! : x >= ch.crit!) }]} />
        <div className="zstat" style={{ marginTop: 12 }}>
          {([
            ["Now", `${f(S.last)} ${ch.unit}`, ""],
            ["Change over window", `${S.last - S.first >= 0 ? "+" : ""}${f(S.last - S.first)}`, ""],
            [isLab ? "Trend per draw" : "Trend", `${perDay >= 0 ? "+" : ""}${n1(perDay)}${isLab ? "" : " / day"}`, Math.abs(perDay) > (ch.fmt ? 0.5 : 4) ? "var(--amber)" : ""],
            ["Median", f(S.med), ""],
            ["Range", `${f(S.min)}–${f(S.max)}`, ""],
            S.inr != null ? ["In range", Math.round((100 * S.inr) / S.n) + "%", S.inr / S.n < 0.7 ? "var(--amber)" : "var(--green)"] : ["Mean", f(S.mean), ""],
            isLab ? ["Rise vs baseline", `${n1(S.last / p.baselineCreat)}×`, S.last / p.baselineCreat >= 2 ? "var(--red)" : S.last / p.baselineCreat >= 1.5 ? "var(--amber)" : "var(--green)"]
              : S.crit != null ? ["Hours past the critical threshold", S.crit, S.crit ? "var(--red)" : "var(--green)"]
                : ["Mean per kg", S.uoKg ? `${n1(S.uoKg)} mL/kg/h` : "—", S.uoKg && S.uoKg < 0.5 ? "var(--red)" : ""],
          ] as [string, string | number, string][]).map((k) => (
            <div key={k[0]}><div className="k">{k[0]}</div><div className="v" style={k[2] ? { color: k[2] } : undefined}>{k[1]}</div></div>
          ))}
        </div>
        <div className="sm" style={{ color: "var(--ink2)", lineHeight: 1.65, marginTop: 12 }}>{ch.norm}</div>
      </Card>
      <Card title="Other channels, same window" hint="click any to zoom it" className="mb14">
        <div className="zgrid">
          {CHANNELS.filter((c) => c.k !== ch.k && c.k !== "creat").map((c) => {
            const dd = v[c.k as string].slice(-Math.min(isLab ? range : win, v[c.k as string].length));
            const ss = zstat(dd, c, p.wt);
            const bad = c.crit != null && (ss.crit ?? 0) > 0;
            return (
              <Link key={c.k} className="zc" href={`/clinical/patient/${p.id}?range=${range}&zoom=${c.k}`} style={{ textDecoration: "none", color: "inherit" }}>
                <div className="h"><span className="n">{c.name}</span><span className="v" style={{ color: bad ? "var(--red)" : c.c }}>{c.fmt ? n1(ss.last) : Math.round(ss.last)}</span></div>
                <div className="xs mut" style={{ marginBottom: 5 }}>{c.unit} · {ss.slope >= 0 ? "+" : ""}{n1(ss.slope * 24)}/day{bad && <> · <span style={{ color: "var(--red)" }}>{ss.crit}h critical</span></>}</div>
                <LineChart w={250} h={44} noAxis yTicks={0} series={[{ c: c.c, w: 1.5, d: dd }]} />
              </Link>
            );
          })}
          {ch.k !== "creat" && (
            <Link className="zc" href={`/clinical/patient/${p.id}?range=${range}&zoom=creat`} style={{ textDecoration: "none", color: "inherit" }}>
              <div className="h"><span className="n">Serum creatinine</span><span className="v" style={{ color: p.aki ? "var(--red)" : "#7c3aed" }}>{p.labs[3].creat}</span></div>
              <div className="xs mut" style={{ marginBottom: 5 }}>mg/dL · 4 draws · baseline {p.baselineCreat}</div>
              <LineChart w={250} h={44} noAxis yTicks={0} series={[{ c: "#7c3aed", w: 1.5, dots: true, d: p.labs.map((l) => l.creat) }]} />
            </Link>
          )}
        </div>
      </Card>
    </>
  );
}

function TransferModal({ p, onClose }: { p: Patient; onClose: () => void }) {
  const me = useMe();
  const st = useStore();
  const [unit, setUnit] = useState(st.adt[p.id]?.unit ?? (p.bed.startsWith("ICU") ? "ICU" : "Ward"));
  const [bed, setBed] = useState(st.adt[p.id]?.bed ?? p.bed);
  function save() {
    setState((s) => {
      const prev = s.adt[p.id] ?? { history: [] };
      return { adt: { ...s.adt, [p.id]: { ...prev, unit, bed, history: [...prev.history, { at: nowIso(), by: me.name, text: `Transferred to ${unit} ${bed}` }] } } };
    });
    audit(me.name, "write", `${p.id} ${p.name}`, `Bed transfer to ${unit} ${bed}`);
    toast(`${p.name} transferred to ${bed}.`);
    onClose();
  }
  return (
    <Modal title={`Transfer — ${p.name}`} onClose={onClose}>
      <div className="frow">
        <div className="fld"><label>Unit</label><select value={unit} onChange={(e) => setUnit(e.target.value)}><option>ICU</option><option>Ward</option><option>HDU</option></select></div>
        <div className="fld"><label>Bed</label><input value={bed} onChange={(e) => setBed(e.target.value)} /></div>
      </div>
      {(st.adt[p.id]?.history ?? []).length > 0 && (
        <div className="chain mb14">{st.adt[p.id]!.history.map((h, i) => <div key={i} className="ev done">{h.at.replace("T", " ")} · {h.text} · {h.by}</div>)}</div>
      )}
      <button className="btn p" onClick={save} disabled={!bed.trim()}>Confirm transfer</button>
    </Modal>
  );
}

function DischargeModal({ p, me, role, onClose }: { p: Patient; me: string; role: string; onClose: () => void }) {
  const summary = `Discharge summary — ${p.name} (${p.id}). Diagnoses: ${p.dx}. Course: ${p.sub}. Current meds: ${p.meds.filter((m) => m.status === "active").map((m) => `${m.drug} ${m.dose} ${m.route}`).join("; ")}. Held: ${p.meds.filter((m) => m.status !== "active").map((m) => `${m.drug} (${m.status})`).join("; ") || "none"}. Follow-up: diabetic foot clinic 1 week; repeat creatinine in 48h.`;
  function confirm() {
    const at = nowIso();
    setState((s) => {
      const prev = s.adt[p.id] ?? { history: [] };
      return {
        adt: { ...s.adt, [p.id]: { ...prev, discharged: { at, by: me }, history: [...prev.history, { at, by: me, text: "Discharged" }] } },
        pending: [{ id: uid("SO"), kind: "clinical", doc: `Discharge summary · ${p.id} ${p.name}`, docType: "discharge", entered: me, enteredRole: role, at,
          need: "discharge", needFrom: p.consultant, priority: "medium", why: "Drafted from structured data at discharge. Cannot be released to the referring clinician until authorised.",
          subject: { type: "discharge", ref: p.id }, content: summary, version: 1 }, ...s.pending],
      };
    });
    audit(me, "write", `${p.id} ${p.name}`, "Discharged; summary drafted to sign-off");
    toast("Discharged. The summary is waiting for authorisation in Review & sign-off.");
    onClose();
  }
  return (
    <Modal title={`Discharge — ${p.name}`} onClose={onClose} width={640}>
      <div className="sm" style={{ color: "var(--ink2)", marginBottom: 10 }}>The summary below is drafted from the structured record. It stays unreleased until {p.consultant} authorises it.</div>
      <div className="tx-box">{summary}</div>
      <button className="btn p" onClick={confirm}>Discharge and send summary for authorisation</button>
    </Modal>
  );
}
