"use client";

// Dependency-free SVG charts ported from the mockup. Charts stretch to their container
// width (preserveAspectRatio="none") and keep a fixed pixel height.

import type { MouseEvent } from "react";

export type LineSeries = {
  d: (number | null)[]; c: string; w?: number; dash?: string; fill?: boolean; step?: boolean;
  dots?: boolean; mark?: (v: number) => boolean;
};

export type LineProps = {
  series: LineSeries[]; w?: number; h?: number; yMin?: number; yMax?: number; yTicks?: number;
  band?: { lo: number; hi: number; c?: string; o?: number } | null;
  refs?: { v: number; c: string }[];
  xLab?: { i?: number; x?: number; t: string; a?: "start" | "middle" | "end" }[];
  xs?: number[]; fmtY?: (v: number) => string | number; noAxis?: boolean; pl?: number;
  hover?: number | null; onHover?: (i: number | null) => void;
};

export function LineChart(o: LineProps) {
  const w = o.w ?? 560, h = o.h ?? 130;
  const pl = o.pl ?? (o.noAxis ? 2 : 34), pr = o.noAxis ? 2 : 8;
  const pt = o.noAxis ? 3 : 8, pb = o.noAxis ? 3 : o.xLab ? 20 : 8;
  const iw = w - pl - pr, ih = h - pt - pb;
  const all = o.series.flatMap((s) => s.d.filter((v): v is number => v != null));
  let mn = o.yMin ?? Math.min(...all), mx = o.yMax ?? Math.max(...all);
  if (!isFinite(mn)) mn = 0;
  if (!isFinite(mx) || mx === mn) mx = mn + 1;
  const n = o.series[0]?.d.length ?? 0;
  const xs = o.xs;
  const xmn = xs ? Math.min(...xs) : 0;
  let xmx = xs ? Math.max(...xs) : 1;
  if (xmx === xmn) xmx = xmn + 1;
  const X = (i: number) => (xs ? pl + ((xs[i] - xmn) / (xmx - xmn)) * iw : pl + (n < 2 ? iw / 2 : (i * iw) / (n - 1)));
  const Y = (v: number) => pt + ih - ((v - mn) / (mx - mn)) * ih;
  const ticks = o.noAxis ? 0 : o.yTicks ?? 3;
  const fmt = o.fmtY ?? ((v: number) => Math.round(v));

  function move(e: MouseEvent<SVGSVGElement>) {
    if (!o.onHover || n < 2) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * w;
    const i = Math.round(((x - pl) / iw) * (n - 1));
    o.onHover(i >= 0 && i < n ? i : null);
  }

  return (
    <svg className="chart" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" height={h}
      onMouseMove={o.onHover ? move : undefined} onMouseLeave={o.onHover ? () => o.onHover?.(null) : undefined}>
      {o.band && (() => {
        const y1 = Y(Math.min(o.band.hi, mx)), y2 = Y(Math.max(o.band.lo, mn));
        return <rect x={pl} y={y1} width={iw} height={Math.max(0, y2 - y1)} fill={o.band.c ?? "#12874a"} opacity={o.band.o ?? 0.07} />;
      })()}
      {Array.from({ length: ticks ? ticks + 1 : 0 }).map((_, i) => {
        const v = mn + ((mx - mn) * i) / ticks, y = Y(v);
        return (
          <g key={i}>
            <line className="gl" x1={pl} y1={y} x2={w - pr} y2={y} />
            <text className="ax" x={pl - 5} y={y + 3.5} textAnchor="end">{fmt(v)}</text>
          </g>
        );
      })}
      {(o.refs ?? []).filter((r) => r.v >= mn && r.v <= mx).map((r, i) => (
        <line key={i} x1={pl} y1={Y(r.v)} x2={w - pr} y2={Y(r.v)} stroke={r.c} strokeWidth={1} strokeDasharray="3 3" opacity={0.8} />
      ))}
      {o.series.map((s, si) => {
        const segs: [number, number][][] = [];
        let seg: [number, number][] = [];
        s.d.forEach((v, i) => {
          if (v == null) { if (seg.length) segs.push(seg); seg = []; return; }
          seg.push([X(i), Y(v)]);
        });
        if (seg.length) segs.push(seg);
        return (
          <g key={si}>
            {segs.map((sg, gi) => {
              const d = sg.map((p, i) => (i === 0 ? `M${p[0].toFixed(1)} ${p[1].toFixed(1)}` : s.step ? `H${p[0].toFixed(1)}V${p[1].toFixed(1)}` : `L${p[0].toFixed(1)} ${p[1].toFixed(1)}`)).join("");
              return (
                <g key={gi}>
                  {s.fill && <path d={`${d}V${pt + ih}H${sg[0][0].toFixed(1)}Z`} fill={s.c} opacity={0.11} />}
                  <path d={d} fill="none" stroke={s.c} strokeWidth={s.w ?? 1.8} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={s.dash} />
                </g>
              );
            })}
            {s.dots && s.d.map((v, i) => (v == null ? null : <circle key={i} cx={X(i)} cy={Y(v)} r={2.6} fill={s.c} />))}
            {s.mark && s.d.map((v, i) => (v == null || !s.mark!(v) ? null : <circle key={`m${i}`} cx={X(i)} cy={Y(v)} r={3.4} fill="#c32b45" stroke="#fff" strokeWidth={1.2} />))}
          </g>
        );
      })}
      {(o.xLab ?? []).map((l, i) => {
        const x = l.x != null ? pl + ((l.x - xmn) / (xmx - xmn)) * iw : X(l.i ?? 0);
        const a = l.a ?? (l.i === 0 ? "start" : (l.i ?? 0) >= n - 1 ? "end" : "middle");
        return <text key={i} className="ax" x={x} y={h - 5} textAnchor={a}>{l.t}</text>;
      })}
      {o.hover != null && o.hover >= 0 && o.hover < n && (
        <line x1={X(o.hover)} y1={pt} x2={X(o.hover)} y2={pt + ih} stroke="#10151c" strokeWidth={1} opacity={0.35} />
      )}
    </svg>
  );
}

export function BarChart({ groups, w = 560, h = 150, yMax, fmtY }: {
  groups: { lab: string; bars: { v: number; c: string }[] }[]; w?: number; h?: number; yMax?: number; fmtY?: (v: number) => string | number;
}) {
  const pl = 34, pr = 8, pt = 10, pb = 26, iw = w - pl - pr, ih = h - pt - pb;
  const mx = yMax ?? Math.max(1, ...groups.flatMap((g) => g.bars.map((b) => b.v)));
  const gw = iw / Math.max(1, groups.length), nb = groups[0]?.bars.length ?? 1;
  const bw = Math.min(26, (gw - 12) / nb);
  const fmt = fmtY ?? ((v: number) => Math.round(v));
  return (
    <svg className="chart" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" height={h}>
      {[0, 1, 2, 3].map((i) => {
        const y = pt + ih - (ih * i) / 3;
        return (
          <g key={i}>
            <line className="gl" x1={pl} y1={y} x2={w - pr} y2={y} />
            <text className="ax" x={pl - 5} y={y + 3.5} textAnchor="end">{fmt((mx * i) / 3)}</text>
          </g>
        );
      })}
      {groups.map((g, gi) => {
        const cx = pl + gw * gi + gw / 2, tot = nb * bw + (nb - 1) * 4;
        return (
          <g key={gi}>
            {g.bars.map((b, bi) => {
              const bh = Math.max(1, (b.v / mx) * ih), x = cx - tot / 2 + bi * (bw + 4);
              return (
                <g key={bi}>
                  <rect x={x} y={pt + ih - bh} width={bw} height={bh} fill={b.c} rx={2} />
                  <text className="ax" x={x + bw / 2} y={pt + ih - bh - 4} textAnchor="middle" fontSize={9}>{b.v}</text>
                </g>
              );
            })}
            <text className="lb" x={cx} y={h - 8} textAnchor="middle">{g.lab}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function StackBar({ segs, w = 300, h = 16 }: { segs: { v: number; c: string; lab: string }[]; w?: number; h?: number }) {
  const tot = segs.reduce((a, s) => a + s.v, 0) || 1;
  const widths = segs.map((s) => (s.v / tot) * w);
  const starts = widths.map((_, i) => widths.slice(0, i).reduce((a, b) => a + b, 0));
  return (
    <svg className="chart" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" height={h}>
      {segs.map((s, i) => (widths[i] > 0 ? <rect key={i} x={starts[i]} y={0} width={widths[i]} height={h} fill={s.c}><title>{`${s.lab}: ${s.v}`}</title></rect> : null))}
    </svg>
  );
}

/** Variance against a network reference, centred. `good` says which direction is better. */
export function VarBar({ v, refV, w = 74, good }: { v: number; refV: number; w?: number; good?: "low" | "high" }) {
  const h = 16, mid = w / 2;
  let d = refV ? (v - refV) / refV : 0;
  d = Math.max(-1, Math.min(1, d));
  const len = Math.abs(d) * (w / 2 - 2);
  const worse = good === "low" ? d > 0 : d < 0;
  const c = Math.abs(d) < 0.07 ? "#8a94a1" : worse ? "#c32b45" : "#12874a";
  return (
    <svg className="chart" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" height={h}>
      <line x1={mid} y1={1} x2={mid} y2={h - 1} stroke="#d3d9e0" strokeWidth={1} />
      {len > 0.5 && <rect x={d < 0 ? mid - len : mid} y={4} width={len} height={8} fill={c} rx={2} />}
    </svg>
  );
}
