"use client";

// Wound photos on Quick visit: take or add photos (shrunk in the browser, location data
// removed), mark whether a ruler/scale is in the shot, and compare with the last visit.
// New photos stay in the browser until the visit is saved, then upload one by one.

/* eslint-disable @next/next/no-img-element -- private photos served by /api/quick-visit/photo behind the log-in, and local previews; next/image cannot optimise either */
import { useRef, useState } from "react";
import { downscale } from "@/components/cx/photo";
import { Modal, toast } from "@/components/cx/ui";

export type PhotoMeta = {
  id: string; visit_id: string; visit_date: string; label: string | null; note: string | null; has_scale: boolean;
  consent: string; width: number | null; height: number | null; bytes: number; sha256: string; created_at: string; created_by: string;
};
export type Pending = { key: string; dataUrl: string; w: number; h: number; kb: number; note: string; has_scale: boolean };

export const photoSrc = (id: string) => `/api/quick-visit/photo?id=${encodeURIComponent(id)}`;
const MAX = 6;
const fmt = (s: string) => new Date(`${s}T00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

type Shot = { src: string; caption: string };

export function WoundPhotos({ saved, pending, setPending, previous, onRemoveSaved }: {
  saved: PhotoMeta[]; pending: Pending[]; setPending: (f: (p: Pending[]) => Pending[]) => void;
  previous: PhotoMeta[]; onRemoveSaved: (p: PhotoMeta) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [compare, setCompare] = useState<{ before: Shot; after: Shot } | null>(null);
  const [view, setView] = useState<Shot | null>(null);
  const count = saved.length + pending.length;
  const last = previous[previous.length - 1];

  async function add(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    const room = MAX - count;
    const list = Array.from(files).slice(0, Math.max(0, room));
    if (files.length > room) toast(`Up to ${MAX} photos per visit — ${files.length - room} not added.`);
    for (const f of list) {
      try {
        const d = await downscale(f, 1600, 0.85);
        setPending((p) => [...p, { key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, ...d, note: "", has_scale: false }]);
      } catch {
        toast(`${f.name}: not an image the browser can read.`);
      }
    }
    setBusy(false);
  }

  const current: Shot | null = pending[0] ? { src: pending[0].dataUrl, caption: "Today (not saved yet)" }
    : saved[0] ? { src: photoSrc(saved[0].id), caption: `This visit · ${fmt(saved[0].visit_date)}` } : null;

  return (
    <div className="qv-photos">
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <span className="qv-l">Wound photos</span>
        <span className="mut xs">{count}/{MAX}</span>
        <span style={{ flex: 1 }} />
        {last && current && (
          <button type="button" className="btn sm" onClick={() => setCompare({ before: { src: photoSrc(last.id), caption: `Last visit · ${fmt(last.visit_date)}` }, after: current })}>
            Compare with last visit
          </button>
        )}
        <button type="button" className="btn sm p" disabled={busy || count >= MAX} onClick={() => input.current?.click()}>
          {busy ? "Preparing…" : "📷 Take / add photo"}
        </button>
        <input ref={input} type="file" accept="image/*" capture="environment" multiple className="sr-only" aria-label="Add wound photos"
          onChange={(e) => { void add(e.target.files); e.target.value = ""; }} />
      </div>
      <div className="xs mut" style={{ margin: "4px 0 8px" }}>
        For measuring later: camera straight above the wound, about 30 cm away, good light without flash glare, and a <b>ruler or paper scale</b> beside the wound.
      </div>

      {(saved.length > 0 || pending.length > 0 || last) && (
        <div className="qv-thumbs">
          {last && (
            <figure className="qv-thumb prev" title="Most recent photo from an earlier visit">
              <button type="button" onClick={() => setView({ src: photoSrc(last.id), caption: `Last visit · ${fmt(last.visit_date)}` })}><img src={photoSrc(last.id)} alt={`Wound at last visit, ${fmt(last.visit_date)}`} /></button>
              <figcaption>Last visit · {fmt(last.visit_date)}{last.has_scale ? " · scale" : ""}</figcaption>
            </figure>
          )}
          {saved.map((p) => (
            <figure key={p.id} className="qv-thumb">
              <button type="button" onClick={() => setView({ src: photoSrc(p.id), caption: `${p.label ?? "Wound"} · ${fmt(p.visit_date)}` })}><img src={photoSrc(p.id)} alt={`Wound photo ${p.label ?? ""}`} /></button>
              <figcaption>
                Saved{p.has_scale ? " · scale" : ""}{p.note ? ` · ${p.note}` : ""}
                <button type="button" className="qv-x" title="Remove from the record (kept for audit)" onClick={() => onRemoveSaved(p)}>Remove</button>
              </figcaption>
            </figure>
          ))}
          {pending.map((p) => (
            <figure key={p.key} className="qv-thumb new">
              <button type="button" onClick={() => setView({ src: p.dataUrl, caption: "Not saved yet" })}><img src={p.dataUrl} alt="New wound photo" /></button>
              <figcaption>
                <span className="mut">New · {p.kb} KB</span>
                <label className="xs" style={{ display: "flex", gap: 5, alignItems: "center" }}>
                  <input type="checkbox" checked={p.has_scale} onChange={(e) => setPending((x) => x.map((y) => (y.key === p.key ? { ...y, has_scale: e.target.checked } : y)))} /> Ruler / scale in shot
                </label>
                <input className="qv-note" value={p.note} placeholder="Note (optional)" aria-label="Photo note"
                  onChange={(e) => setPending((x) => x.map((y) => (y.key === p.key ? { ...y, note: e.target.value.slice(0, 120) } : y)))} />
                <button type="button" className="qv-x" onClick={() => setPending((x) => x.filter((y) => y.key !== p.key))}>Discard</button>
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      {view && (
        <Modal title={view.caption} onClose={() => setView(null)} width={900}>
          <img src={view.src} alt={view.caption} style={{ width: "100%", height: "auto", borderRadius: 6 }} />
        </Modal>
      )}
      {compare && (
        <Modal title="Compare wound photos" onClose={() => setCompare(null)} width={1100}>
          <div className="qv-compare">
            {[compare.before, compare.after].map((s) => (
              <figure key={s.caption}><img src={s.src} alt={s.caption} /><figcaption>{s.caption}</figcaption></figure>
            ))}
          </div>
          <div className="xs mut" style={{ marginTop: 8 }}>Sizes can only be compared fairly when both photos were taken from the same distance with a scale in the shot.</div>
        </Modal>
      )}
    </div>
  );
}

/** Upload new photos after the visit is saved. Returns how many failed. */
export async function uploadPending(visitId: string, pending: Pending[], label: string, consent: string): Promise<number> {
  let failed = 0;
  for (const p of pending) {
    const r = await fetch("/api/quick-visit/photo", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visit_id: visitId, image: p.dataUrl, label, note: p.note, has_scale: p.has_scale, consent, width: p.w, height: p.h }),
    }).catch(() => null);
    if (!r || !r.ok) failed++;
  }
  return failed;
}
