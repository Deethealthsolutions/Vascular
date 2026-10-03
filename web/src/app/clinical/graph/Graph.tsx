"use client";

import { useMemo, useRef, useState, type PointerEvent, type WheelEvent } from "react";
import { Guard, Top } from "@/components/cx/Shell";
import { Card, Disc, Kpis, Pill } from "@/components/cx/ui";
import { GRAPH, n1 } from "@/lib/cx/data";

type Node = (typeof GRAPH.nodes)[number] & { note?: string; n?: number; effect?: string; strength?: string; status?: string; venue?: string; unit?: string; rel?: string; prosp?: number; paper?: number; sections?: { name: string; findings: string[] }[] };
type Link = { o: string; rel: string; dir: "in" | "out" };

const REL_LABEL: Record<string, string> = {
  supports: "Supports", contradicts: "Contradicts", limits: "Limits", neutral: "Neutral on", "derived-from": "Derived from", "uses-variable": "Uses variable",
  measures: "Measures", feeds: "Feeds", tests: "Tests", defines: "Defines cohort", "subset-of": "Subset of", reports: "Reports", cites: "Cites",
  "authored-by": "Authored by", "recruits-at": "Recruits at", "uses-source": "Uses source", instruments: "Instruments", "evaluated-by": "Evaluated by", implements: "Implements",
};

function useIndex() {
  return useMemo(() => {
    const by: Record<string, Node> = {}, nb: Record<string, Link[]> = {}, col: Record<string, string> = {};
    GRAPH.nodes.forEach((n) => { by[n.id] = n as Node; nb[n.id] = []; });
    GRAPH.edges.forEach((e) => { nb[e.s].push({ o: e.t, rel: e.rel, dir: "out" }); nb[e.t].push({ o: e.s, rel: e.rel, dir: "in" }); });
    GRAPH.types.forEach((t) => (col[t.t] = t.colour));
    return { by, nb, col };
  }, []);
}

const grad = (n: Node) => 3.4 + Math.min(7.2, Math.sqrt(n.deg) * 2.1) + (n.t === "study" || n.t === "paper" ? 1.6 : 0);

export function Graph() {
  return (
    <Guard screen="graph">
      <Top title="Knowledge graph" sub="Linked findings, variables, cohorts and manuscripts · what each claim rests on" />
      <div className="wrap"><Body /></div>
    </Guard>
  );
}

function Body() {
  const X = useIndex();
  const G = GRAPH, I = G.insight, T = G.totals;
  const [sel, setSel] = useState<string | null>(null);
  const [depth, setDepth] = useState(0);
  const [off, setOff] = useState<Record<string, boolean>>({});
  const [q, setQ] = useState("");
  const [vb, setVb] = useState({ x: 0, y: 0, w: G.w, h: G.h });
  const drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);
  const svg = useRef<SVGSVGElement>(null);

  const hood = useMemo(() => {
    if (!sel || !depth) return null;
    const seen: Record<string, number> = { [sel]: 0 };
    let frontier = [sel];
    for (let l = 1; l <= depth; l++) {
      const nxt: string[] = [];
      frontier.forEach((f) => X.nb[f].forEach((k) => { if (!(k.o in seen)) { seen[k.o] = l; nxt.push(k.o); } }));
      frontier = nxt;
    }
    return seen;
  }, [sel, depth, X]);
  const near = useMemo(() => {
    const s: Record<string, boolean> = {};
    if (sel) { s[sel] = true; X.nb[sel].forEach((l) => (s[l.o] = true)); }
    return s;
  }, [sel, X]);
  const ql = q.toLowerCase();
  const vis = (n: Node) => !off[n.t] && (!hood || n.id in hood);
  const match = (n: Node) => !ql || n.label.toLowerCase().includes(ql);
  const counts: Record<string, number> = {};
  G.nodes.forEach((n) => (counts[n.t] = (counts[n.t] || 0) + 1));

  function wheel(e: WheelEvent<SVGSVGElement>) {
    const r = svg.current!.getBoundingClientRect();
    const fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
    const k = e.deltaY > 0 ? 1.12 : 0.89;
    const nw = Math.max(G.w * 0.18, Math.min(G.w * 1.9, vb.w * k)), nh = (nw * G.h) / G.w;
    setVb({ x: vb.x + (vb.w - nw) * fx, y: vb.y + (vb.h - nh) * fy, w: nw, h: nh });
  }
  function down(e: PointerEvent<SVGSVGElement>) {
    if ((e.target as Element).closest(".gnode")) return;
    drag.current = { x: e.clientX, y: e.clientY, vx: vb.x, vy: vb.y };
    svg.current!.setPointerCapture(e.pointerId);
  }
  function move(e: PointerEvent<SVGSVGElement>) {
    if (!drag.current) return;
    const r = svg.current!.getBoundingClientRect();
    setVb({ ...vb, x: drag.current.vx - ((e.clientX - drag.current.x) * vb.w) / r.width, y: drag.current.vy - ((e.clientY - drag.current.y) * vb.h) / r.height });
  }

  return (
    <>
      <Disc><b>Research knowledge graph — synthetic.</b> Findings are written to be clinically plausible so the link structure is legible. They are not evidence. No individual patient appears as a node: participants enter only as cohorts (REQ-GRAPH-002).</Disc>
      <Kpis cols={5} items={[
        { k: "Nodes", v: T.nodes, d: `${T.edges} links · mean degree ${T.meanDeg}` }, { k: "Findings", v: T.findings, d: `across ${T.papers} manuscripts` },
        { k: "Collected, never used", v: T.unused, d: "variables with no finding", tone: "warn" }, { k: "Fragile claims", v: T.fragile, d: "rest on a sparse variable", tone: "bad" },
        { k: "Unevidenced sections", v: T.gaps, d: "no linked finding", tone: "warn" },
      ]} />

      <div className="gbar">
        <div className="gkey">
          {G.types.map((t) => (
            <button key={t.t} className={`gk${off[t.t] ? " off" : ""}`} onClick={() => setOff({ ...off, [t.t]: !off[t.t] })}>
              <i style={{ background: t.colour }} />{t.label}<span className="n">{counts[t.t] || 0}</span>
            </button>
          ))}
        </div>
        <input className="gsearch" placeholder="Filter by name…" value={q} onChange={(e) => setQ(e.target.value.trim())} />
        <div className="seg">{[[0, "Whole graph"], [1, "Local 1"], [2, "Local 2"], [3, "Local 3"]].map(([d, l]) => <button key={d} className={depth === d ? "on" : ""} onClick={() => setDepth(d as number)}>{l}</button>)}</div>
        <button className="btn sm" onClick={() => setVb({ x: 0, y: 0, w: G.w, h: G.h })}>Reset view</button>
      </div>

      <div className="glay">
        <div className="gstage">
          <svg ref={svg} viewBox={`${n1(vb.x)} ${n1(vb.y)} ${n1(vb.w)} ${n1(vb.h)}`} onWheel={wheel} onPointerDown={down} onPointerMove={move} onPointerUp={() => (drag.current = null)} style={{ touchAction: "none" }}>
            {G.edges.map((e, i) => {
              const a = X.by[e.s], b = X.by[e.t];
              if (!vis(a) || !vis(b)) return null;
              const hi = sel && (e.s === sel || e.t === sel);
              const dim = (sel && !hi) || (ql && !match(a) && !match(b));
              return <line key={i} className={`gedge${hi ? " hi" : dim ? " dim" : ""}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
            })}
            {(G.nodes as Node[]).map((n) => {
              if (!vis(n)) return null;
              const r = grad(n);
              const dim = (sel && !near[n.id]) || (ql && !match(n));
              const lbl = n.deg >= 6 || near[n.id] || (ql && match(n));
              return (
                <g key={n.id} className={`gnode${n.id === sel ? " sel" : ""}${dim ? " dim" : ""}${lbl ? "" : " lbl-off"}`} onClick={() => setSel(sel === n.id ? null : n.id)}>
                  <circle cx={n.x} cy={n.y} r={n1(r)} fill={X.col[n.t]} />
                  <text x={n.x} y={n.y - r - 3.5} textAnchor="middle">{n.label.length > 34 ? n.label.slice(0, 33) + "…" : n.label}</text>
                </g>
              );
            })}
          </svg>
        </div>
        <div className="gside"><Panel sel={sel} setSel={setSel} X={X} /></div>
      </div>

      <div className="grid2 mt14">
        <Card title="Claims resting on a sparse variable" hint="walk finding → cohort → variable → source">
          {I.fragileClaims.map((f) => (
            <div key={f.finding} style={{ padding: "9px 0", borderBottom: "1px solid var(--line)" }}>
              <div style={{ display: "flex", gap: 9, alignItems: "baseline" }}><Pill c="r">{n1(f.completeness)}%</Pill><span className="num sm"><b>{X.by[f.variable].label}</b></span><span className="xs mut" style={{ marginLeft: "auto" }}>{f.basis}</span></div>
              <button className="sm" style={{ marginTop: 5, background: "none", border: 0, padding: 0, textAlign: "left", color: "var(--blue)" }} onClick={() => setSel(f.finding)}>{f.label}</button>
            </div>
          ))}
        </Card>
        <Card title="Collected but never used" hint="variables with no inbound finding">
          <table className="t"><thead><tr><th>Variable</th><th>Prospective</th><th>Paper</th><th>Feeds from</th></tr></thead><tbody>
            {I.unusedVariables.map((v) => {
              const nd = X.by[v];
              const src = X.nb[v].filter((l) => l.rel === "feeds").map((l) => X.by[l.o].label);
              return <tr key={v} className="clk" onClick={() => setSel(v)}><td className="num sm"><b>{nd.label}</b><div className="xs mut">{nd.unit}</div></td><td className="num sm">{n1(nd.prosp ?? 0)}%</td><td className="num sm">{n1(nd.paper ?? 0)}%</td><td className="xs mut">{src.join(", ") || "—"}</td></tr>;
            })}
          </tbody></table>
        </Card>
      </div>

      <Card title="Manuscript sections with no linked finding" hint="select a manuscript node to see its full outline" right={<Pill c="a">{T.gaps}</Pill>} className="mt14">
        <table className="t"><thead><tr><th>Manuscript</th><th>Status</th><th>Section</th></tr></thead><tbody>
          {I.unevidencedSections.map((g) => (
            <tr key={g.paper + g.section} className="clk" onClick={() => setSel(g.paper)}>
              <td className="sm">{g.title.slice(0, 66)}{g.title.length > 66 ? "…" : ""}</td>
              <td><Pill c={g.status === "published" ? "g" : g.status === "submitted" ? "b" : "n"}>{g.status}</Pill></td><td className="sm mut">{g.section}</td>
            </tr>
          ))}
        </tbody></table>
      </Card>
    </>
  );
}

function Panel({ sel, setSel, X }: { sel: string | null; setSel: (s: string | null) => void; X: ReturnType<typeof useIndex> }) {
  const G = GRAPH, T = G.totals;
  if (!sel) {
    return (
      <>
        <div className="gside-h"><div className="ty" style={{ color: "var(--ink3)" }}>Nothing selected</div><h4>Click a node to open it</h4></div>
        <div className="gstat">{[["Nodes", T.nodes], ["Links", T.edges], ["Density", T.density + "%"], ["Mean degree", T.meanDeg]].map(([k, v]) => <div key={k}><div className="k">{k}</div><div className="v">{v}</div></div>)}</div>
        <div style={{ padding: "13px 14px" }} className="sm">
          <div style={{ color: "var(--ink2)", lineHeight: 1.68 }}>Selecting a node dims everything it does not touch and lists its links and backlinks. Switch to <b>Local 1–3</b> to hide the rest of the graph and walk outward one hop at a time. Scroll to zoom, drag to pan.</div>
          <div style={{ marginTop: 13, display: "flex", gap: 6, flexWrap: "wrap" }}>
            {["p-sitevar", "f-tcpo2-thr", "v-abi", "h-override"].map((id) => <button key={id} className="btn sm" onClick={() => setSel(id)}>{X.by[id].label.slice(0, 26)}</button>)}
          </div>
        </div>
      </>
    );
  }
  const n = X.by[sel], col = X.col[n.t];
  const ty = G.types.find((t) => t.t === n.t)!;
  const meta = [n.n != null && `n = ${n.n}`, n.effect, n.strength && `${n.strength} evidence`, n.status, n.venue, n.unit, n.rel].filter(Boolean) as string[];
  const groups: Record<string, Link[]> = {};
  X.nb[n.id].forEach((l) => { const k = `${l.dir === "out" ? "→ " : "← "}${REL_LABEL[l.rel] ?? l.rel}`; (groups[k] = groups[k] || []).push(l); });
  return (
    <>
      <div className="gside-h">
        <div className="ty" style={{ color: col }}><i style={{ background: col }} />{ty.label}</div>
        <h4>{n.label}</h4>
        {meta.length > 0 && <div style={{ marginTop: 7, display: "flex", gap: 5, flexWrap: "wrap" }}>{meta.map((m) => <Pill key={m}>{m}</Pill>)}</div>}
        {n.note && <div className="sm mut" style={{ marginTop: 7 }}>{n.note}</div>}
        <div className="xs mut" style={{ marginTop: 7 }}>{n.deg} link{n.deg === 1 ? "" : "s"}</div>
      </div>
      {n.t === "variable" && (
        <div className="gstat">
          <div><div className="k">Prospective</div><div className="v" style={{ color: (n.prosp ?? 0) >= 90 ? "var(--green)" : "var(--amber)" }}>{n1(n.prosp ?? 0)}%</div></div>
          <div><div className="k">Paper record</div><div className="v" style={{ color: (n.paper ?? 0) >= 60 ? "var(--green)" : (n.paper ?? 0) > 0 ? "var(--red)" : "var(--ink3)" }}>{(n.paper ?? 0) > 0 ? n1(n.paper!) + "%" : "n/a"}</div></div>
        </div>
      )}
      {n.t === "paper" && n.sections && (
        <>
          <div className="grel">Outline</div>
          {n.sections.map((s) => (
            <div key={s.name} className={`gsec${s.findings.length ? "" : " gap"}`}>
              <span><b>{s.name}</b>{s.findings.length > 0 && <div className="xs mut" style={{ marginTop: 3 }}>{s.findings.map((f) => <div key={f}><button onClick={() => setSel(f)} style={{ background: "none", border: 0, padding: 0, color: "var(--teal)", textAlign: "left" }}>{X.by[f].label.slice(0, 40)}</button></div>)}</div>}</span>
              <Pill c={s.findings.length ? "g" : "a"}>{s.findings.length || "none"}</Pill>
            </div>
          ))}
        </>
      )}
      {Object.keys(groups).sort().map((k) => (
        <div key={k}>
          <div className="grel">{k} <span style={{ opacity: 0.6 }}>{groups[k].length}</span></div>
          {groups[k].map((l, i) => { const o = X.by[l.o]; return <div key={o.id + i} className="glink" onClick={() => setSel(o.id)}><i style={{ background: X.col[o.t] }} />{o.label}</div>; })}
        </div>
      ))}
    </>
  );
}
