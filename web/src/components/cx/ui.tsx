"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { newsClass } from "@/lib/cx/data";

export function Card({ title, hint, right, children, className = "", bodyClass = "card-b", attn }: {
  title?: ReactNode; hint?: ReactNode; right?: ReactNode; children?: ReactNode; className?: string; bodyClass?: string | null; attn?: boolean;
}) {
  return (
    <div className={`card ${attn ? "att " : ""}${className}`}>
      {title != null && (
        <div className="card-h">
          <h3>{title}</h3>
          {hint && <span className="hint">{hint}</span>}
          {right && <><div className="sp" />{right}</>}
        </div>
      )}
      {bodyClass === null ? children : <div className={bodyClass}>{children}</div>}
    </div>
  );
}

export function Kpis({ items, cols = 4 }: { items: { k: string; v: ReactNode; d?: ReactNode; tone?: "" | "good" | "warn" | "bad" }[]; cols?: number }) {
  return (
    <div className="kpis" style={{ gridTemplateColumns: `repeat(${cols},minmax(0,1fr))` }}>
      {items.map((k) => (
        <div key={k.k} className={`kpi ${k.tone ?? ""}`}>
          <div className="k">{k.k}</div>
          <div className="v">{k.v}</div>
          {k.d != null && <div className="d">{k.d}</div>}
        </div>
      ))}
    </div>
  );
}

export const Pill = ({ c = "n", children, title }: { c?: string; children: ReactNode; title?: string }) => (
  <span className={`pill ${c}`} title={title}>{children}</span>
);

export function Seg<T extends string | number>({ value, options, onChange, hrefFor }: {
  value: T; options: [T, string][]; onChange?: (v: T) => void; hrefFor?: (v: T) => string;
}) {
  return (
    <div className="seg">
      {options.map(([v, l]) =>
        hrefFor ? (
          <Link key={String(v)} href={hrefFor(v)} scroll={false}
            style={{ padding: "6px 12px", borderRadius: 4, font: "500 12px/1 var(--f)", color: value === v ? "var(--ink)" : "var(--ink2)", background: value === v ? "var(--surf)" : "none", boxShadow: value === v ? "var(--sh)" : "none", textDecoration: "none" }}>
            {l}
          </Link>
        ) : (
          <button key={String(v)} className={value === v ? "on" : ""} onClick={() => onChange?.(v)}>{l}</button>
        ),
      )}
    </div>
  );
}

export function NewsBadge({ n, size = 40 }: { n: number; size?: number }) {
  return (
    <div className={`news ${newsClass(n)}`} style={size !== 40 ? { width: size, height: size, fontSize: size * 0.4 } : undefined}>
      {n}<small>NEWS2</small>
    </div>
  );
}

export const Disc = ({ children }: { children: ReactNode }) => <div className="disc">{children}</div>;

export const Dot = ({ c }: { c: string }) => <span className="dot" style={{ display: "inline-block", background: c }} />;

export function Modal({ title, onClose, children, width = 560 }: { title: ReactNode; onClose: () => void; children: ReactNode; width?: number }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" style={{ width: `min(${width}px,100%)` }}>
        <div className="card-h"><h3>{title}</h3><div className="sp" /><button className="btn sm" onClick={onClose}>Close</button></div>
        <div className="card-b">{children}</div>
      </div>
    </div>
  );
}

let toastSet: ((t: string | null) => void) | null = null;
export const toast = (t: string) => toastSet?.(t);

export function Toaster() {
  const [t, setT] = useState<string | null>(null);
  useEffect(() => {
    toastSet = setT;
    return () => { toastSet = null; };
  }, []);
  useEffect(() => {
    if (!t) return;
    const id = setTimeout(() => setT(null), 3600);
    return () => clearTimeout(id);
  }, [t]);
  return t ? <div className="toast" role="status">{t}</div> : null;
}

export function Prog({ pct, c = "var(--teal)", label }: { pct: number; c?: string; label?: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
      <div className="prog" style={{ flex: 1, height: 6 }}><i style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: c }} /></div>
      {label != null && <span className="num xs">{label}</span>}
    </div>
  );
}

export function Denied({ why }: { why: string }) {
  return (
    <div className="deny">
      <b>Access denied.</b> {why} The attempt has been written to the audit log.
    </div>
  );
}
