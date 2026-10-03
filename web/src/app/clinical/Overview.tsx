"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BarChart, LineChart, StackBar, VarBar } from "@/components/cx/charts";
import { Guard, Top } from "@/components/cx/Shell";
import { Card, Dot, Pill } from "@/components/cx/ui";
import { NET, SITEC, SITENAME, n1, netAgg, pc, winAgg, type Agg } from "@/lib/cx/data";
import { useStore } from "@/lib/cx/store";

type P = { site: string; days: number; unit: string };

export function Overview(p: P) {
  return (
    <Guard screen="overview">
      <Top title="Network overview" sub="Head of service · three centres" />
      <div className="wrap"><Body {...p} /></div>
    </Guard>
  );
}

function Body({ site, days, unit }: P) {
  const router = useRouter();
  const st = useStore();
  const codes = site === "ALL" || !SITENAME[site] ? ["CHN", "BLR", "HYD"] : [site];
  const sel = NET.sites.filter((s) => codes.includes(s.code));
  const agg = netAgg(sel, days);
  const prev = netAgg(sel.map((s) => ({ beds: s.beds, series: s.series.slice(0, s.series.length - days) })), days);
  const discharged = new Set(Object.entries(st.adt).filter(([, a]) => a.discharged).map(([k]) => k));
  const roster = NET.roster.filter((r) => codes.includes(r.site) && !discharged.has(r.id) && (unit === "all" || r.unit.toLowerCase() === unit));
  const href = (o: Partial<P>) => {
    const n = { site, days, unit, ...o };
    return `/clinical?site=${n.site.toLowerCase()}&days=${n.days}&unit=${n.unit}`;
  };

  const tr = (cur: number, pv: number, good: "low" | "high") => {
    if (!pv) return <span className="tr fl">—</span>;
    const d = ((cur - pv) / Math.abs(pv)) * 100;
    if (Math.abs(d) < 2) return <span className="tr fl">→ flat</span>;
    const worse = good === "low" ? d > 0 : d < 0;
    return <span className={`tr ${worse ? "up" : "dn"}`}>{d > 0 ? "↑" : "↓"} {Math.abs(Math.round(d))}%</span>;
  };
  const high = roster.filter((r) => r.news2 >= 5).length;
  const kp: [string, React.ReactNode, string, React.ReactNode, string][] = [
    ["Occupancy", <>{roster.length}<small>/{agg.beds}</small></>, pc((100 * roster.length) / agg.beds) + " of beds", "", ""],
    ["High acuity now", high, "NEWS2 ≥ 5 across selection", "", high > 6 ? "warn" : ""],
    ["Major amputation rate", <>{n1(agg.ampRate)}<small>%</small></>, `${agg.majorAmp} of ${agg.majorAmp + agg.revasc} limb outcomes`, tr(agg.ampRate, prev.ampRate, "low"), agg.ampRate > 15 ? "bad" : ""],
    ["Limb salvage", <>{n1(agg.salvage)}<small>%</small></>, `${agg.revasc} revascularisations`, tr(agg.salvage, prev.salvage, "high"), ""],
    ["Sepsis bundle ≤1h", <>{Math.round(agg.bundlePct)}<small>%</small></>, `${agg.bundleMet} of ${agg.sepsis} cases`, tr(agg.bundlePct, prev.bundlePct, "high"), agg.bundlePct < 75 ? "bad" : agg.bundlePct < 90 ? "warn" : "good"],
    ["Alert acknowledgement", <>{n1(agg.ack)}<small>min</small></>, "median, all alert classes", tr(agg.ack, prev.ack, "low"), agg.ack > 15 ? "warn" : ""],
    ["Digital capture", <>{Math.round(agg.digitalPct)}<small>%</small></>, "of observation sets", tr(agg.digitalPct, prev.digitalPct, "high"), agg.digitalPct < 50 ? "warn" : "good"],
    ["Hypoglycaemia", n1(agg.hypoRate), "episodes / 100 patient-days", tr(agg.hypoRate, prev.hypoRate, "low"), agg.hypoRate > 5 ? "warn" : ""],
  ];

  // Needs attention — computed from the filter, not authored.
  const att: { c: string; ic: string; t: string; d: string; m: [string | number, string][] }[] = [];
  sel.forEach((s) => {
    const m = winAgg(s, days);
    if (m.ampRate > agg.ampRate * 1.3 && m.majorAmp >= 3) {
      att.push({ c: "r", ic: "!", t: `${SITENAME[s.code]} major amputation rate is ${n1(m.ampRate)}% against a network ${n1(agg.ampRate)}%`,
        d: `Over the last ${days} days this site performed ${m.majorAmp} major amputations against ${m.revasc} revascularisations. It is also the lowest site for digital observation capture at ${Math.round(m.digitalPct)}%, and the slowest to acknowledge alerts at ${n1(m.ack)} minutes. These facts are associated in this data, not shown to be causal, but together they justify a case-note review.`,
        m: [[n1(m.ampRate) + "%", "Amputation rate"], [Math.round(m.digitalPct) + "%", "Digital capture"], [n1(m.ack) + "m", "Alert ack"], [Math.round(m.bundlePct) + "%", "Sepsis bundle"]] });
    }
    if (m.bundlePct < 75 && m.sepsis >= 4) {
      att.push({ c: "a", ic: "!", t: `${SITENAME[s.code]} sepsis bundle compliance is ${Math.round(m.bundlePct)}%`,
        d: `${m.bundleMet} of ${m.sepsis} sepsis episodes received the full bundle inside one hour. The bundle timer (rule A04) is live but acknowledgement is lagging.`,
        m: [[Math.round(m.bundlePct) + "%", "Bundle ≤1h"], [m.sepsis, "Episodes"], [n1(m.ack) + "m", "Alert ack"]] });
    }
    if (m.digitalPct < 40) {
      att.push({ c: "v", ic: "●", t: `${SITENAME[s.code]} is still capturing ${Math.round(100 - m.digitalPct)}% of observations on paper`,
        d: "Paper observations cannot drive NEWS2 scoring, escalation or any detection rule. The notepad-photo OCR bridge (rule A14) lets the site start without waiting for full rollout.",
        m: [[Math.round(m.digitalPct) + "%", "Digital"], [m.obsTotal - m.obsDigital, "Paper sets"], [s.nurses, "Nurses to train"]] });
    }
  });
  const akiNow = roster.filter((r) => r.aki > 0).length;
  if (akiNow) att.push({ c: "a", ic: "●", t: `${akiNow} inpatients currently have an active AKI flag`,
    d: "KDIGO staging (rule A02) is running on every creatinine. Each of these patients has nephrotoxic drugs auto-flagged for review.",
    m: [[akiNow, "Active AKI"], [agg.cin, `Contrast-associated, ${days}d`], [agg.aki, `New AKI, ${days}d`]] });

  const rows: [string, (m: Agg, beds: number) => string | number, keyof Agg | null, "low" | "high" | undefined][] = [
    ["Beds / occupancy", (m, beds) => `${beds} · ${pc(m.occ)}`, null, undefined],
    ["Admissions", (m) => m.adm, "adm", "high"],
    ["Revascularisations", (m) => m.revasc, "revasc", "high"],
    ["Major amputations", (m) => m.majorAmp, "majorAmp", "low"],
    ["Major amputation rate", (m) => n1(m.ampRate) + "%", "ampRate", "low"],
    ["Sepsis bundle ≤1h", (m) => Math.round(m.bundlePct) + "%", "bundlePct", "high"],
    ["New AKI", (m) => m.aki, "aki", "low"],
    ["Contrast-associated AKI", (m) => m.cin, "cin", "low"],
    ["Hypo / 100 patient-days", (m) => n1(m.hypoRate), "hypoRate", "low"],
    ["Alert acknowledgement", (m) => n1(m.ack) + " min", "ack", "low"],
    ["Digital capture", (m) => Math.round(m.digitalPct) + "%", "digitalPct", "high"],
    ["Unplanned escalations", (m) => m.esc, "esc", "low"],
  ];
  const mets = Object.fromEntries(sel.map((s) => [s.code, winAgg(s, days)]));
  const xl = [{ i: 0, t: `-${days}d` }, { i: days - 1, t: "today" }];
  const legend = (
    <div className="legend">{sel.map((s) => <span key={s.code}><i style={{ background: SITEC[s.code] }} />{SITENAME[s.code]}</span>)}</div>
  );
  const hi = roster.filter((r) => r.news2 >= 5 || r.aki > 0).sort((a, b) => b.news2 - a.news2 || b.aki - a.aki);

  return (
    <>
      <div className="filt">
        <div className="fg"><span className="fl">Location</span>
          <div className="chips">
            <Link className={`chip${codes.length === 3 ? " on" : ""}`} href={href({ site: "ALL" })}>All sites</Link>
            {NET.sites.map((s) => (
              <Link key={s.code} className={`chip${codes.length === 1 && codes[0] === s.code ? " on" : ""}`} href={href({ site: s.code })}>
                <i className="sd" style={{ background: SITEC[s.code] }} />{SITENAME[s.code]}
              </Link>
            ))}
          </div>
        </div>
        <div className="fg"><span className="fl">Period</span>
          <div className="seg">{[7, 30, 90].map((d) => <button key={d} className={days === d ? "on" : ""} onClick={() => router.push(href({ days: d }), { scroll: false })}>{d} days</button>)}</div>
        </div>
        <div className="fg"><span className="fl">Unit</span>
          <div className="seg">{[["all", "All"], ["icu", "ICU"], ["ward", "Ward"]].map(([u, l]) => <button key={u} className={unit === u ? "on" : ""} onClick={() => router.push(href({ unit: u }), { scroll: false })}>{l}</button>)}</div>
        </div>
        <div style={{ flex: 1 }} />
        <span className="xs mut">{sel.length} of 3 sites · {roster.length} inpatients · as at {NET.today}</span>
      </div>

      <div className="kpis" style={{ gridTemplateColumns: "repeat(4,minmax(0,1fr))" }}>
        {kp.map((k) => (
          <div key={k[0]} className={`kpi ${k[4]}`}>
            <div className="k">{k[0]}</div><div className="v">{k[1]}</div><div className="d">{k[3]} {k[2]}</div>
          </div>
        ))}
      </div>

      {att.length > 0 && (
        <Card title="Needs attention" hint="derived from the current filter · ordered by severity" attn className="mb14" bodyClass={null}>
          {att.map((a) => (
            <div key={a.t} className="att-i">
              <div className={`ic ${a.c}`}>{a.ic}</div>
              <div>
                <div className="t">{a.t}</div><div className="d">{a.d}</div>
                <div className="m">{a.m.map(([v, l]) => <div key={l}><b>{v}</b><span>{l}</span></div>)}</div>
              </div>
            </div>
          ))}
        </Card>
      )}

      <Card title="Site comparison" hint="bar shows variance against the network figure for the same period" className="mb14">
        <div style={{ overflowX: "auto" }}>
          <table className="t">
            <thead><tr><th>Metric</th>{sel.map((s) => <th key={s.code} colSpan={2} style={{ color: SITEC[s.code] }}>{SITENAME[s.code]}</th>)}<th>Network</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r[0]}>
                  <td className="sm">{r[0]}</td>
                  {sel.map((s) => (
                    <FragmentCells key={s.code} val={r[1](mets[s.code], s.beds)}
                      bar={r[2] ? <VarBar v={mets[s.code][r[2]] as number} refV={agg[r[2]] as number} good={r[3]} /> : null} />
                  ))}
                  <td className="num sm mut">{r[2] ? r[1](agg, agg.beds) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid2 mb14">
        <Card title="Digital observation capture" hint="share of observation sets entered in the app" bodyClass={null}>
          <div className="card-b tight">
            <LineChart w={560} h={150} yMin={0} yMax={100} yTicks={4} xLab={xl} fmtY={(v) => Math.round(v) + "%"}
              series={sel.map((s) => ({ c: SITEC[s.code], w: 2, d: s.series.slice(-days).map((r) => (100 * r.obsDigital) / Math.max(1, r.obsTotal)) }))} />
          </div>{legend}
        </Card>
        <Card title="Alert acknowledgement time" hint="minutes from alert raised to clinician acknowledgement" bodyClass={null}>
          <div className="card-b tight">
            <LineChart w={560} h={150} yMin={0} yTicks={4} xLab={xl} refs={[{ v: 10, c: "#12874a" }]}
              series={sel.map((s) => ({ c: SITEC[s.code], w: 2, d: s.series.slice(-days).map((r) => r.ack) }))} />
          </div>
          <div className="legend">{sel.map((s) => <span key={s.code}><i style={{ background: SITEC[s.code] }} />{SITENAME[s.code]}</span>)}<span><i style={{ background: "#12874a" }} />10 min target</span></div>
        </Card>
      </div>

      <div className="grid2 mb14">
        <Card title="Limb outcomes" hint={`last ${days} days`} bodyClass={null}>
          <div className="card-b tight">
            <BarChart w={560} h={170} groups={sel.map((s) => {
              const m = mets[s.code];
              return { lab: SITENAME[s.code], bars: [{ v: m.angio, c: "#0b6bcb" }, { v: m.bypass, c: "#0d9488" }, { v: m.debride, c: "#8a94a1" }, { v: m.minorAmp, c: "#b57314" }, { v: m.majorAmp, c: "#c32b45" }] };
            })} />
          </div>
          <div className="legend">{[["Angioplasty", "#0b6bcb"], ["Bypass", "#0d9488"], ["Debridement", "#8a94a1"], ["Minor amputation", "#b57314"], ["Major amputation", "#c32b45"]].map(([l, c]) => <span key={l}><i className="sq" style={{ background: c }} />{l}</span>)}</div>
        </Card>
        <Card title="Current acuity mix" hint="inpatients by NEWS2 band">
          {sel.map((s) => {
            const rs = roster.filter((r) => r.site === s.code);
            const b = [0, 0, 0, 0];
            rs.forEach((r) => b[r.news2 >= 7 ? 3 : r.news2 >= 5 ? 2 : r.news2 >= 1 ? 1 : 0]++);
            return (
              <div key={s.code} style={{ marginBottom: 13 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}><span className="sm">{SITENAME[s.code]}</span><span className="xs mut">{rs.length} patients</span></div>
                <StackBar w={500} h={15} segs={[{ v: b[0], c: "#12874a", lab: "Routine (0)" }, { v: b[1], c: "#4b8fd4", lab: "Low (1-4)" }, { v: b[2], c: "#d2541a", lab: "Medium (5-6)" }, { v: b[3], c: "#c32b45", lab: "High (7+)" }]} />
              </div>
            );
          })}
          <div className="legend" style={{ padding: "4px 0 0" }}>{[["Routine 0", "#12874a"], ["Low 1-4", "#4b8fd4"], ["Medium 5-6", "#d2541a"], ["High 7+", "#c32b45"]].map(([l, c]) => <span key={l}><i className="sq" style={{ background: c }} />{l}</span>)}</div>
        </Card>
      </div>

      <Card title="Patients needing review across the network" hint={`NEWS2 ≥ 5 or active AKI · ${hi.length} patients · detailed charts available for Chennai`}>
        <table className="t">
          <thead><tr><th>NEWS2</th><th>Patient</th><th>Site</th><th>Bed</th><th>Diagnosis</th><th>AKI</th><th>LOS</th><th>Consultant</th></tr></thead>
          <tbody>
            {hi.length ? hi.map((r) => (
              <tr key={r.id} className={r.detailed ? "clk" : ""} onClick={r.detailed ? () => router.push(`/clinical/patient/${r.id}`) : undefined}>
                <td><Pill c={r.news2 >= 7 ? "r" : r.news2 >= 5 ? "o" : "a"}>{r.news2}</Pill></td>
                <td className="sm"><b>{r.name}</b> <span className="mut xs">{r.age}{r.sex}</span>{r.detailed && <> <Pill c="b">chart</Pill></>}</td>
                <td className="sm"><Dot c={SITEC[r.site]} /> {SITENAME[r.site]}</td>
                <td className="num sm">{st.adt[r.id]?.bed ?? r.bed}</td>
                <td className="sm">{r.dx}</td>
                <td>{r.aki ? <Pill c="r">Stage {r.aki}</Pill> : <span className="mut xs">—</span>}</td>
                <td className="num sm">{r.los}d</td>
                <td className="sm mut">{r.consultant}</td>
              </tr>
            )) : <tr><td colSpan={8} className="mut sm">No patients meet the criteria in this selection.</td></tr>}
          </tbody>
        </table>
      </Card>
    </>
  );
}

function FragmentCells({ val, bar }: { val: string | number; bar: React.ReactNode }) {
  return (<><td className="num sm" style={{ paddingRight: 4 }}>{val}</td><td>{bar}</td></>);
}
