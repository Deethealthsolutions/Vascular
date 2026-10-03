"use client";

import Link from "next/link";
import { useState } from "react";
import { LineChart } from "@/components/cx/charts";
import { Guard, Top, useMe } from "@/components/cx/Shell";
import { Card, Disc, Modal, Pill, toast } from "@/components/cx/ui";
import { WOUNDS, n1, profileOf } from "@/lib/cx/data";
import { downscale } from "@/components/cx/photo";
import { audit, storageOk, setState, uid, useStore, type WoundPhoto } from "@/lib/cx/store";

const TC = { granulation: "#c2405a", slough: "#d9b24c", necrosis: "#2f2a28", epithelial: "#e8a7b4" };
type Tissue = { granulation: number; slough: number; necrosis: number; epithelial: number };
const USES = [["care", "Direct care"], ["teaching", "Teaching"], ["research", "Research"], ["publication", "Publication"]] as const;

/** Consent scope recorded in the patient master; enforced at read time (rule A29, REQ-WOUND-004). */
function allowed(scope: string, use: string) {
  if (use === "care") return true;
  if (use === "teaching") return scope !== "care-only";
  return scope.split("+").includes(use);
}

/** Schematic of the wound bed from recorded tissue percentages. The prototype ships no clinical imagery. */
function Swatch({ t, w = 132, h = 88 }: { t: Tissue; w?: number; h?: number }) {
  const segs: [keyof Tissue, number][] = [["necrosis", t.necrosis], ["slough", t.slough], ["granulation", t.granulation], ["epithelial", t.epithelial]];
  const tot = segs.reduce((a, s) => a + s[1], 0) || 100;
  let y = 0;
  const id = `wc${t.granulation}${t.slough}${t.necrosis}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} style={{ display: "block", borderRadius: 4 }}>
      <defs><clipPath id={id}><ellipse cx={w / 2} cy={h / 2} rx={w / 2 - 8} ry={h / 2 - 8} /></clipPath></defs>
      <rect width={w} height={h} fill="#f0e4e0" />
      {segs.map(([k, v]) => { const sh = (v / tot) * h; const r = <rect key={k} x={0} y={y} width={w} height={sh + 0.6} fill={TC[k]} clipPath={`url(#${id})`} />; y += sh; return r; })}
      <ellipse cx={w / 2} cy={h / 2} rx={w / 2 - 8} ry={h / 2 - 8} fill="none" stroke="#8a94a1" strokeWidth={1} strokeDasharray="2 2" />
    </svg>
  );
}

export function Wound({ wid }: { wid: string }) {
  return (
    <Guard screen="wound">
      <Top title="Wound & HBOT" sub="Photograph series, hyperbaric course, consent-scoped image repository" />
      <div className="wrap"><Body wid={wid} /></div>
    </Guard>
  );
}

function Body({ wid }: { wid: string }) {
  const me = useMe();
  const W = WOUNDS.wounds.find((x) => x.woundId === wid) ?? WOUNDS.wounds[0];
  const P = WOUNDS.protocol, C = WOUNDS.capture, ph = W.photos, hb = W.hbot;
  const prof = profileOf(W.patientId);
  const scope = prof?.consent.photography ?? "care-only";
  const st = useStore();
  const uploads = st.woundPhotos[W.woundId] ?? [];
  const [view, setView] = useState<WoundPhoto | null>(null);
  const [use, setUse] = useState<{ id: string } | null>(null);
  const [capture, setCapture] = useState(false);
  const days = ph.map((p) => p.day), area = ph.map((p) => p.area);
  const a0 = area[0], aN = area[area.length - 1], chg = (100 * (aN - a0)) / a0;
  const laterality = /left/i.test(W.site) ? "Left" : /right/i.test(W.site) ? "Right" : "—";
  const status = chg <= -50 ? "healing" : chg < 0 ? "improving" : "deteriorating";
  const xl = [{ x: days[0], t: `day ${days[0]}`, a: "start" as const }, { x: days[days.length - 1], t: "today", a: "end" as const }];
  const expct = days.map((d) => +(a0 * Math.exp((-Math.LN2 / 28) * (d - days[0]))).toFixed(2));
  const hbCls = ({ "in-course": "g", assessment: "a", deferred: "o" } as Record<string, string>)[hb.status] ?? "n";

  function tryUse(p: { id: string }, u: string) {
    const ok = allowed(scope, u);
    audit(me.name, ok ? "export" : "deny", `${p.id} · ${W.patientId}`, `${ok ? "Released" : "Refused"} image for ${u} use (consent scope: ${scope})`);
    toast(ok ? `${p.id} released for ${u} use${u === "care" ? "" : " after de-identification (EXIF and identifying features removed)"}.` : `Refused: ${W.patientName}'s consent scope is "${scope}", which does not cover ${u} use. Logged.`);
    setUse(null);
  }

  return (
    <>
      <Disc><b>No clinical photographs ship with this prototype.</b> Seeded tiles render the recorded tissue composition as a schematic; photos you add with <i>Capture photograph</i> stay in this browser only. Image use is checked against the consent scope in the patient master every time the image is read, not only at upload.</Disc>

      <div className="filt">
        <div className="fg"><span className="fl">Wound</span>
          <div className="chips">{WOUNDS.wounds.map((x) => <Link key={x.woundId} className={`chip${x.woundId === W.woundId ? " on" : ""}`} href={`/clinical/wound?wid=${x.woundId}`}>{x.patientName} <span className="mut">{x.woundId}</span></Link>)}</div>
        </div>
        <div style={{ flex: 1 }} />
        <span className="xs mut">{WOUNDS.repo.photos} images · {WOUNDS.repo.megabytes} MB across 3 wounds</span>
      </div>

      <div className="phead">
        <div style={{ flex: 1 }}>
          <div className="nm">{W.patientName} <span className="mut sm">{W.woundId} · {W.patientId}</span></div>
          <div className="mt">{W.site} · {W.aetiology} · onset {W.onsetWeeks} weeks ago</div>
          <div className="sb" style={{ marginTop: 9, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Pill c={W.wagner >= 4 ? "r" : W.wagner >= 3 ? "o" : "a"}>Wagner {W.wagner}</Pill>
            <Pill>Laterality: {laterality}</Pill>
            <Pill c={status === "deteriorating" ? "r" : status === "healing" ? "g" : "a"}>Status: {status}</Pill>
            <Pill c={W.abi < 0.5 ? "r" : W.abi < 0.8 ? "a" : "g"}>ABI {W.abi}</Pill>
            <Pill c={W.tcpo2Air < 40 ? "r" : "g"}>TcPO₂ air {W.tcpo2Air} mmHg</Pill>
            {W.tcpo2Chamber ? <Pill c="g">in-chamber {W.tcpo2Chamber} mmHg</Pill> : <Pill>in-chamber study pending</Pill>}
            <Pill c={hbCls}>HBOT {hb.status}</Pill>
            <Pill c={scope === "care-only" ? "a" : "v"}>Photo consent: {scope}</Pill>
          </div>
          <div className="sb" style={{ marginTop: 8, maxWidth: 760 }}>{W.tcpo2Note}</div>
        </div>
        <div className="rt"><div style={{ textAlign: "right" }}>
          <div className="xs mut">Area now</div>
          <div style={{ font: "600 26px/1.1 var(--f)" }}>{aN} <small style={{ fontSize: 13, color: "var(--ink3)" }}>cm²</small></div>
          <div className="xs" style={{ color: chg < -20 ? "var(--green)" : chg > 10 ? "var(--red)" : "var(--ink3)", fontWeight: 600 }}>{chg > 0 ? "+" : ""}{Math.round(chg)}% from {a0} cm²</div>
        </div></div>
      </div>

      <div className="grid2 mb14">
        <Card title="Healing trajectory" hint="rule A28 · dashed line is the expected curve, 50% at four weeks" bodyClass={null}>
          <div className="card-b tight"><LineChart w={560} h={170} xs={days} xLab={xl} yMin={0} yTicks={4} fmtY={(v) => n1(v)}
            series={[{ c: "#8a94a1", w: 1.4, dash: "4 3", d: expct }, { c: chg < -20 ? "#12874a" : "#c32b45", w: 2.2, dots: true, d: area }]} /></div>
          <div className="legend"><span><i style={{ background: chg < -20 ? "#12874a" : "#c32b45" }} />Measured area cm²</span><span><i style={{ background: "#8a94a1" }} />Expected</span></div>
        </Card>
        <Card title="Wound bed composition" hint="percentage of wound area · rule A30 pre-fills these" bodyClass={null}>
          <div className="card-b tight"><LineChart w={560} h={170} xs={days} xLab={xl} yMin={0} yMax={100} yTicks={4} fmtY={(v) => Math.round(v) + "%"}
            series={[{ c: TC.granulation, w: 2, d: ph.map((p) => p.tissue.granulation) }, { c: TC.slough, w: 2, d: ph.map((p) => p.tissue.slough) }, { c: TC.necrosis, w: 2, d: ph.map((p) => p.tissue.necrosis) }]} /></div>
          <div className="legend">{[["Granulation", TC.granulation], ["Slough", TC.slough], ["Necrosis", TC.necrosis]].map(([l, c]) => <span key={l}><i style={{ background: c }} />{l}</span>)}</div>
        </Card>
      </div>

      <Card title="Hyperbaric oxygen course" hint={`${P.ata} ATA · ${P.minutes} min · ${P.perWeek} per week · ${P.course}-session course`} right={<Pill c={hbCls}>{hb.status}</Pill>} className="mb14">
        <div className="sm" style={{ color: "var(--ink2)", lineHeight: 1.65, marginBottom: 13 }}><b style={{ color: "var(--ink)" }}>Indication.</b> {hb.indication}</div>
        {hb.done ? (
          <>
            <div style={{ marginBottom: 15 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span className="sm"><b>{hb.done} of {hb.planned} sessions</b></span>
                <span className="xs mut">futility review at session {hb.futilityAt}{hb.futilityOutcome ? ` — ${hb.futilityOutcome}` : ""}</span>
              </div>
              <div style={{ height: 10, background: "#eef1f4", borderRadius: 5, overflow: "hidden", position: "relative" }}>
                <div style={{ height: "100%", width: `${(hb.done / hb.planned) * 100}%`, background: "var(--green)" }} />
                <div style={{ position: "absolute", left: `${(hb.futilityAt / hb.planned) * 100}%`, top: -3, bottom: -3, width: 2, background: "var(--ink)" }} />
              </div>
            </div>
            <div className="grid2">
              <div>
                <div className="card-h" style={{ padding: "0 0 9px", border: 0 }}><h3 style={{ fontSize: 12 }}>Capillary glucose, before and after each session</h3></div>
                <LineChart w={560} h={150} yMin={40} yTicks={4} xLab={[{ i: 0, t: "session 1" }, { i: hb.sessions.length - 1, t: `session ${hb.sessions.length}` }]}
                  band={{ lo: 70, hi: 180 }} refs={[{ v: P.cbgFloor, c: "#b57314" }]}
                  series={[{ c: "#0b6bcb", w: 1.9, dots: true, d: hb.sessions.map((s) => s.cbgPre) }, { c: "#6d4aff", w: 1.9, dots: true, d: hb.sessions.map((s) => s.cbgPost) }]} />
                <div className="legend" style={{ padding: "8px 0 0" }}><span><i style={{ background: "#0b6bcb" }} />Pre-session</span><span><i style={{ background: "#6d4aff" }} />Post-session</span><span><i style={{ background: "#b57314" }} />{P.cbgFloor} mg/dL floor</span></div>
                <div className="xs mut" style={{ marginTop: 8 }}>Mean fall {Math.round(hb.sessions.reduce((a, s) => a + (s.cbgPre - s.cbgPost), 0) / hb.sessions.length)} mg/dL. Rule A26 blocks compression below the floor.</div>
              </div>
              <div>
                <div className="card-h" style={{ padding: "0 0 9px", border: 0 }}><h3 style={{ fontSize: 12 }}>Session events</h3><div className="sp" /><Pill c={hb.sessions.some((s) => s.complication) ? "a" : "g"}>{hb.sessions.filter((s) => s.complication).length} of {hb.sessions.length}</Pill></div>
                {hb.sessions.filter((s) => s.complication).map((s) => (
                  <div key={s.n} className="att-i" style={{ padding: "10px 0" }}><div className="ic a">{s.n}</div>
                    <div><div className="t" style={{ fontSize: 12 }}>Session {s.n} · day {s.day}</div><div className="d">{s.complication}</div><div className="xs mut" style={{ marginTop: 4 }}>Glucose {s.cbgPre} → {s.cbgPost} mg/dL</div></div></div>
                ))}
                <table className="t" style={{ marginTop: 8 }}>
                  <thead><tr><th>#</th><th>Day</th><th>ATA</th><th>Min</th><th>Pre</th><th>Post</th></tr></thead>
                  <tbody>{hb.sessions.slice(-6).map((s) => <tr key={s.n}><td className="num xs">{s.n}</td><td className="num xs">{s.day}</td><td className="num xs">{s.ata}</td><td className="num xs">{s.minutes}</td><td className="num xs" style={s.cbgPre < P.cbgFloor ? { color: "var(--red)", fontWeight: 600 } : undefined}>{s.cbgPre}</td><td className="num xs">{s.cbgPost}</td></tr>)}</tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <div className="att-i" style={{ padding: "12px 0" }}><div className={`ic ${hb.status === "deferred" ? "r" : "a"}`}>!</div>
            <div><div className="t">No sessions delivered — {hb.status}</div>
              <div className="d">{hb.status === "deferred" ? "Deferred is recorded distinctly from declined, with the blocking condition named, so the patient is re-screened once it clears." : "Screening gates are partially met. The in-chamber TcPO₂ study is the outstanding evidence; rule A25 has raised the booking prompt."}</div></div></div>
        )}
      </Card>

      <Card title="Photograph series" hint={`${ph.length} images · ${n1(ph.reduce((a, p) => a + p.mb, 0))} MB · newest last · click a tile to request a use`} right={<button className="btn sm v" onClick={() => setCapture(true)}>Capture photograph</button>} className="mb14">
        <div style={{ display: "flex", gap: 11, overflowX: "auto", paddingBottom: 6 }}>
          {ph.map((p) => {
            const bad = !p.calibrated;
            return (
              <button key={p.id} onClick={() => setUse(p)} style={{ flex: "0 0 152px", textAlign: "left", border: `1px solid ${bad ? "var(--amber)" : "var(--line)"}`, borderRadius: "var(--r)", overflow: "hidden", background: bad ? "var(--amber-s)" : "var(--surf)", padding: 0 }}>
                <div style={{ padding: "10px 10px 0" }}><Swatch t={p.tissue as Tissue} /></div>
                <div style={{ padding: "9px 10px 10px" }}>
                  <div className="xs mut">day {p.day}</div>
                  <div style={{ font: "600 14px/1.2 var(--f)", margin: "3px 0" }}>{bad ? <span style={{ color: "var(--amber)" }}>no measure</span> : <>{p.area} <small style={{ fontSize: 10, color: "var(--ink3)" }}>cm²</small></>}</div>
                  <div className="xs mut">{bad ? "uncalibrated" : `${p.length} × ${p.width} × ${p.depth} cm`}</div>
                  <div className="xs mut" style={{ marginTop: 5 }}>{p.capturedBy} · {p.mb} MB · {p.tier}</div>
                  {p.note && <div className="xs" style={{ marginTop: 6, color: "var(--ink2)", lineHeight: 1.45 }}>{p.note}</div>}
                  {bad && <div className="pill a" style={{ marginTop: 7 }}>re-take requested</div>}
                </div>
              </button>
            );
          })}
          {uploads.map((p) => (
            <div key={p.id} style={{ flex: "0 0 152px", border: `1px solid ${p.marker ? "var(--blue)" : "var(--amber)"}`, borderRadius: "var(--r)", overflow: "hidden", background: "var(--surf)" }}>
              <button onClick={() => setView(p)} style={{ padding: 0, border: 0, display: "block", width: "100%", background: "#000" }} aria-label="Enlarge photo">
                {/* eslint-disable-next-line @next/next/no-img-element -- local data URL */}
                <img src={p.dataUrl} alt={`Wound photo ${p.site}`} style={{ width: "100%", height: 98, objectFit: "cover", display: "block" }} />
              </button>
              <div style={{ padding: "8px 10px 10px" }}>
                <div className="xs mut">today · uploaded</div>
                <div style={{ font: "600 13px/1.2 var(--f)", margin: "3px 0" }}>{p.marker ? "calibrated" : <span style={{ color: "var(--amber)" }}>no measure</span>}</div>
                <div className="xs mut">{p.by} · {p.kb} KB</div>
                {p.note && <div className="xs" style={{ marginTop: 4, color: "var(--ink2)" }}>{p.note}</div>}
                <button className="btn sm" style={{ marginTop: 6, width: "100%" }} onClick={() => setUse(p)}>Request a use</button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid2 mb14">
        <Card title="Capture standard" right={<Pill>rule A27</Pill>}>
          <table className="t"><tbody>
            {[["Distance", `${C.distanceCm} cm, fixed`], ["Calibration", C.ruler], ["Lighting", C.lighting], ["Angle", C.angle], ["Minimum resolution", `${C.minPx} px on the long edge`], ["Maximum size", `${C.maxMB} MB`], ["Format", C.fmt]].map((r) => (
              <tr key={r[0]}><td className="sm mut" style={{ width: "38%" }}>{r[0]}</td><td className="sm">{r[1]}</td></tr>
            ))}
          </tbody></table>
        </Card>
        <Card title="Image repository and consent" right={<Pill>rule A29</Pill>}>
          <div className="kpis" style={{ gridTemplateColumns: "repeat(3,1fr)", marginBottom: 13 }}>
            {[["Hot · 0-14d", WOUNDS.repo.hot, "instant read"], ["Warm · 15-60d", WOUNDS.repo.warm, "seconds"], ["Cold · 60d+", WOUNDS.repo.cold, "restore on request"]].map((k) => (
              <div key={k[0]} className="kpi" style={{ padding: "10px 12px" }}><div className="k">{k[0]}</div><div className="v" style={{ fontSize: 20 }}>{k[1]}</div><div className="d">{k[2]}</div></div>
            ))}
          </div>
          <table className="t"><thead><tr><th>Use</th><th>{W.patientName} ({scope})</th></tr></thead><tbody>
            {USES.map(([u, l]) => <tr key={u}><td className="sm">{l}</td><td>{allowed(scope, u) ? <Pill c="g">permitted</Pill> : <Pill c="r">blocked</Pill>}</td></tr>)}
          </tbody></table>
          <div className="xs mut" style={{ marginTop: 10 }}>EXIF location and device identifiers are stripped on ingest; objects hold no patient identifier in the key or pixels; every read is logged against a care relationship.</div>
        </Card>
      </div>

      <Card title="Unit patients with no wound record" hint="stated explicitly, so an absent photograph series is never ambiguous">
        <table className="t"><tbody>
          {WOUNDS.noWound.map((x) => <tr key={x.patientId}><td className="sm" style={{ width: "26%" }}><b>{x.patientName}</b><div className="xs mut">{x.patientId}</div></td><td className="sm mut">{x.reason}</td></tr>)}
        </tbody></table>
      </Card>

      {use && (
        <Modal title={`Use image ${use.id}`} onClose={() => setUse(null)}>
          <div className="sm mut" style={{ marginBottom: 12 }}>Recorded consent scope for {W.patientName}: <b>{scope}</b>. The check runs now, at read time.</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {USES.map(([u, l]) => <button key={u} className={`btn ${allowed(scope, u) ? "" : ""}`} onClick={() => tryUse(use, u)}>{l}{allowed(scope, u) ? "" : " 🔒"}</button>)}
          </div>
        </Modal>
      )}
      {capture && <CaptureModal wid={W.woundId} site={W.site} scope={scope} onClose={() => setCapture(false)} />}
      {view && (
        <Modal title={`Wound photo · ${view.site}`} onClose={() => setView(null)} width={900}>
          {/* eslint-disable-next-line @next/next/no-img-element -- local data URL */}
          <img src={view.dataUrl} alt="Wound photo enlarged" style={{ width: "100%", maxHeight: "65vh", objectFit: "contain", background: "#000", borderRadius: 6 }} />
          <div className="xs mut" style={{ marginTop: 8 }}>{view.w}×{view.h}px · {view.kb} KB · {view.by} · {new Date(view.at).toLocaleString("en-IN")} · {view.marker ? "calibration marker in frame" : "no calibration marker — not measurable"}{view.note ? ` · ${view.note}` : ""}</div>
        </Modal>
      )}
    </>
  );
}

function CaptureModal({ wid, site, scope, onClose }: { wid: string; site: string; scope: string; onClose: () => void }) {
  const [shots, setShots] = useState<{ dataUrl: string; w: number; h: number; kb: number }[]>([]);
  const [c, setC] = useState({ marker: false, focus: false, light: false, angle: false });
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const me = useMe().name;
  const faults = [!c.marker && "calibration marker not in frame", !c.focus && "focus not confirmed", !c.light && "lighting not confirmed", !c.angle && "angle not confirmed"].filter(Boolean) as string[];

  async function pick(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    const out: typeof shots = [];
    for (const f of Array.from(files).slice(0, 6 - shots.length)) {
      if (!f.type.startsWith("image/")) { toast(`${f.name} is not an image.`); continue; }
      try { out.push(await downscale(f)); } catch { toast(`${f.name} could not be read.`); }
    }
    setShots((x) => [...x, ...out]);
    setBusy(false);
  }

  function save() {
    const at = new Date().toISOString();
    const photos: WoundPhoto[] = shots.map((d) => ({ id: uid("IMG"), at, by: me, site, ...d, marker: c.marker, source: "camera / upload", note }));
    setState((s) => ({ woundPhotos: { ...s.woundPhotos, [wid]: [...(s.woundPhotos[wid] ?? []), ...photos] } }));
    if (!storageOk()) toast("Browser storage is full, so these photos will be lost on reload. The production system uploads to server storage.");
    audit(me, "write", wid, `${photos.length} wound photo${photos.length > 1 ? "s" : ""} uploaded · ${faults.length ? "quality gate: " + faults.join(", ") : "quality gate passed"} · EXIF stripped`);
    toast(faults.length ? `Saved as a record without measurement (${faults[0]}). Re-take while the dressing is down if you can.` : `${photos.length} photo${photos.length > 1 ? "s" : ""} added to the series.`);
    onClose();
  }

  return (
    <Modal title={`Add wound photograph · ${site}`} onClose={onClose} width={720}>
      <div className="sm mut" style={{ marginBottom: 10 }}>Consent on file: <b>{scope}</b>. Photos are resized in the browser and location data is removed before saving.</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <label className="btn p" style={{ cursor: "pointer" }}>📷 Take photo<input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => { pick(e.target.files); e.target.value = ""; }} /></label>
        <label className="btn" style={{ cursor: "pointer" }}>⤒ Upload from device<input type="file" accept="image/*" multiple className="sr-only" aria-label="Upload wound photos" onChange={(e) => { pick(e.target.files); e.target.value = ""; }} /></label>
        {busy && <span className="xs mut" style={{ alignSelf: "center" }}>processing…</span>}
      </div>
      {shots.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(130px,1fr))", gap: 8, marginBottom: 12 }}>
          {shots.map((d, i) => (
            <div key={i} style={{ position: "relative" }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- local data URL */}
              <img src={d.dataUrl} alt={`New photo ${i + 1}`} style={{ width: "100%", height: 100, objectFit: "cover", borderRadius: 6 }} />
              <button className="btn sm" style={{ position: "absolute", top: 4, right: 4, padding: "2px 7px" }} onClick={() => setShots(shots.filter((_, j) => j !== i))} aria-label="Remove">✕</button>
              <div className="xs mut">{d.w}×{d.h} · {d.kb} KB</div>
            </div>
          ))}
        </div>
      )}
      <div className="fsec-h"><h4>Quality gate — confirm before saving</h4><span className="hint">rule A27</span></div>
      {([["marker", "Calibration marker next to the wound and in frame"], ["focus", "Wound in focus"], ["light", "Ring light on, flash off"], ["angle", "Camera perpendicular to the wound, about 30 cm"]] as const).map(([k, l]) => (
        <label key={k} className="check"><input type="checkbox" checked={c[k]} onChange={(e) => setC({ ...c, [k]: e.target.checked })} /> {l}</label>
      ))}
      <div className="fld" style={{ margin: "10px 0" }}><label>Caption</label><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. after debridement, HBOT session 23" /></div>
      <div className={faults.length ? "disc" : "disc"} style={faults.length ? {} : { background: "var(--green-s)", borderColor: "#9bd3b4", color: "var(--green)" }}>
        {faults.length ? <>Will be saved as a clinical record but <b>without a measurement</b>: {faults.join(", ")}.</> : "Quality gate passed — area can be measured from the marker scale."}
      </div>
      <button className="btn p" disabled={!shots.length} onClick={save}>Save {shots.length || ""} photo{shots.length === 1 ? "" : "s"} to the series</button>
    </Modal>
  );
}
