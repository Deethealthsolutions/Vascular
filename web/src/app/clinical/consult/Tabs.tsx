"use client";

// Tabs of the doctor consultation form. State lives in Consult.tsx; findings come from model.ts.

import { useState, type ReactNode } from "react";
import { downscale } from "@/components/cx/photo";
import { Modal, Pill, toast } from "@/components/cx/ui";
import { SignaturePad } from "@/components/staff/SignaturePad";
import {
  ABX_INDICATION, ANAESTHESIA, BMT_REASONS, CONSENT_RISKS, CONTRAST, CULTURE, DEBRIDE_DEPTH, DEBRIDE_METHOD, DECISION, DEEP_SIGNS,
  DEFORMITY, DISCUSSED, DRESS_BY, DRESS_FREQ, DRESS_PRIMARY, DRESS_SECONDARY, DX, EXPOSED, EXUDATE_D, FOOTWEAR, FORMULARY, GANGRENE,
  HAEMOSTASIS, INTERPRETER, LOCAL_SIGNS, LOCATIONS, MED_ACTIONS, OFFLOAD, ORDERS, PERIWOUND, PRESENT, PULSES, REMOVED, RISK, SENSE3,
  SKIN, abiBand, num, type Alert, type Side,
} from "@/lib/cx/consult";
import { audit, setState, uid, type Registration, type WoundPhoto } from "@/lib/cx/store";
import type { Staff } from "@/lib/cx/users";
import { PMH, SYMPTOMS, newWound, type C, type D, type FootF, type Sd, type WoundF } from "./model";

export type TabProps = {
  r: Registration; c: C; d: D; me: Staff; al: Alert[];
  set: <K extends keyof C>(k: K, v: C[K]) => void;
  upd: (fn: (x: C) => C) => void;
};

// ------------------------------------------------------------------ small building blocks

const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
export function Chips({ opts, on, onChange, red }: { opts: readonly string[]; on: string[]; onChange: (v: string[]) => void; red?: (o: string) => boolean }) {
  return <div className="chipset">{opts.map((o) => <button key={o} className={on.includes(o) ? (red?.(o) ? "on red" : "on") : ""} onClick={() => onChange(toggle(on, o))}>{o}</button>)}</div>;
}
function Sel({ label, sub, value, opts, onChange, req, id }: { label: string; sub?: ReactNode; value: string; opts: readonly string[]; onChange: (v: string) => void; req?: boolean; id?: string }) {
  return (
    <div className="ob wide">
      <label htmlFor={id}>{label}{req && <b style={{ color: "var(--red)" }}> *</b>}{sub && <span>{sub}</span>}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={value === "" ? "" : ""}>
        <option value="">Select…</option>
        {opts.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}
function Num({ label, sub, value, onChange, req, id, warn }: { label: string; sub?: string; value: string; onChange: (v: string) => void; req?: boolean; id: string; warn?: boolean }) {
  return (
    <div className="ob">
      <label htmlFor={id}>{label}{req && <b style={{ color: "var(--red)" }}> *</b>}{sub && <span>{sub}</span>}</label>
      <input id={id} inputMode="decimal" value={value} placeholder="—" className={warn ? "p1" : ""} onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, "").slice(0, 5))} />
    </div>
  );
}
const H = ({ children, hint }: { children: ReactNode; hint?: ReactNode }) => <div className="fsec-h mt14"><h4>{children}</h4>{hint && <span className="hint">{hint}</span>}</div>;
const Sub = ({ children }: { children: ReactNode }) => <div className="xs" style={{ fontWeight: 700, color: "var(--ink2)", margin: "10px 0 4px", textTransform: "uppercase", letterSpacing: ".06em" }}>{children}</div>;

// ------------------------------------------------------------------ History

export function HistoryTab({ r, c, d, set }: TabProps) {
  return (
    <>
      <div className="grid2" style={{ gap: "0 24px" }}>
        <div className="fld"><label>Presenting complaint</label><input value={r.complaint} readOnly /></div>
        <div className="fld"><label>Duration</label><input value={c.duration} onChange={(e) => set("duration", e.target.value)} placeholder="e.g. 3 weeks" /></div>
      </div>
      <div className="fld" style={{ marginTop: 10 }}><label className="req-l">History of presenting complaint</label>
        <textarea id="c_hpi" value={c.hpi} onChange={(e) => set("hpi", e.target.value)} placeholder="Onset, cause (footwear, trauma, burn, barefoot walking), progression, treatment and antibiotics so far" /></div>
      <H>Symptoms</H>
      <Chips opts={SYMPTOMS} on={c.symptoms} onChange={(v) => set("symptoms", v)} />
      <H hint="pre-filled from registration · confirm with the patient">Past history</H>
      <Chips opts={PMH} on={c.pmh} onChange={(v) => set("pmh", v)} />
      <div className="grid2 mt14" style={{ gap: "0 24px" }}>
        <div className="fld"><label>Allergies (drug and reaction)</label><input value={c.allergies} onChange={(e) => set("allergies", e.target.value)} style={c.allergies && !/^(nkda|none)/i.test(c.allergies) ? { borderColor: "var(--red)", color: "var(--red)", fontWeight: 600 } : {}} /></div>
        <div className="grid2" style={{ gap: "0 12px" }}>
          {d.diabetic && <Num id="c_hba1c" label="Last HbA1c" sub="%" value={c.hba1c} onChange={(v) => set("hba1c", v)} warn={num(c.hba1c) >= 8} />}
          <Num id="c_egfr" label="Latest eGFR" sub={d.cl.ckd || d.cl.dialysis ? "needed for dosing" : "mL/min/1.73 m²"} value={c.egfr} onChange={(v) => set("egfr", v)} warn={num(c.egfr) < 30} />
          <Num id="c_wbc" label="WBC" sub="×10⁹/L, if known" value={c.wbc} onChange={(v) => set("wbc", v)} warn={num(c.wbc) > 12 || (num(c.wbc) > 0 && num(c.wbc) < 4)} />
        </div>
      </div>
      <div className="xs mut" style={{ marginTop: 4 }}>Current medicines are reconciled on the <b>Medicines</b> tab.</div>
    </>
  );
}

// ------------------------------------------------------------------ Examination

export function ExamTab({ c, d, set, upd }: TabProps) {
  const setSide = (k: "bra" | "dpP" | "ptP" | "toe", sd: "r" | "l", v: string) => upd((x) => ({ ...x, [k]: { ...x[k], [sd]: v.replace(/[^\d]/g, "").slice(0, 3) } }));
  const setPulse = (k: keyof C["pulses"], sd: "r" | "l", v: string) => upd((x) => ({ ...x, pulses: { ...x.pulses, [k]: { ...x.pulses[k], [sd]: v } } }));
  const setFoot = (sd: Sd, patch: Partial<FootF>) => upd((x) => ({ ...x, foot: { ...x.foot, [sd]: { ...x.foot[sd], ...patch } } }));
  const pulseSel = (k: keyof C["pulses"], sd: "r" | "l") => {
    const v = c.pulses[k][sd];
    return (
      <select className={`cmp${v === "Absent" || v === "Doppler only" || v === "Weak" ? " warn" : ""}${v === "" ? " empty" : ""}`} value={v} onChange={(e) => setPulse(k, sd, e.target.value)} aria-label={`${k} ${sd}`}>
        {v === "" && <option value="">Select…</option>}
        {PULSES.map((o) => <option key={o}>{o}</option>)}
      </select>
    );
  };
  const press = (k: "bra" | "dpP" | "ptP" | "toe", sd: "r" | "l") => (
    <input className="cmp" inputMode="numeric" placeholder="mmHg" value={(c[k] as Side)[sd]} onChange={(e) => setSide(k, sd, e.target.value)} aria-label={`${k} ${sd}`} />
  );
  const fsel = (sd: Sd, k: "vibration" | "reflex", label: string) => {
    const v = c.foot[sd][k];
    return <select className={`cmp${v === "Absent" || v === "Reduced" ? " warn" : ""}${v === "" ? " empty" : ""}`} value={v} onChange={(e) => setFoot(sd, { [k]: e.target.value })} aria-label={`${label} ${sd}`}>
      {v === "" && <option value="">Select…</option>}{SENSE3.map((o) => <option key={o}>{o}</option>)}</select>;
  };
  return (
    <>
      <div className="grid2" style={{ gap: "0 24px" }}>
        <div>
          <div className="fsec-h"><h4>Pulses</h4><span className="hint">pedal pulses pre-filled by the nurse</span></div>
          <table className="t cmp-t"><thead><tr><th style={{ width: "40%" }} /><th>Right</th><th>Left</th></tr></thead><tbody>
            {([["Femoral", "fem"], ["Popliteal", "pop"], ["Dorsalis pedis *", "dp"], ["Posterior tibial *", "pt"]] as const).map(([l, k]) => (
              <tr key={k}><td className="sm">{l}</td><td>{pulseSel(k, "r")}</td><td>{pulseSel(k, "l")}</td></tr>))}
          </tbody></table>
        </div>
        <div>
          <div className="fsec-h"><h4>Bedside Doppler pressures</h4><span className="hint">mmHg</span></div>
          <table className="t cmp-t"><thead><tr><th style={{ width: "40%" }} /><th>Right</th><th>Left</th></tr></thead><tbody>
            <tr><td className="sm">Brachial</td><td>{press("bra", "r")}</td><td>{press("bra", "l")}</td></tr>
            <tr><td className="sm">Ankle — DP</td><td>{press("dpP", "r")}</td><td>{press("dpP", "l")}</td></tr>
            <tr><td className="sm">Ankle — PT</td><td>{press("ptP", "r")}</td><td>{press("ptP", "l")}</td></tr>
            <tr><td className="sm">Great toe</td><td>{press("toe", "r")}</td><td>{press("toe", "l")}</td></tr>
            <tr><td className="sm"><b>ABI</b></td>{[d.abiBy.right, d.abiBy.left].map((v, i) => <td key={i}><b className="num">{v ?? "—"}</b> <Pill c={abiBand(v)[1]}>{abiBand(v)[0]}</Pill></td>)}</tr>
            <tr><td className="sm"><b>TBI</b></td>{[d.tbiBy.right, d.tbiBy.left].map((v, i) => <td key={i}><b className="num">{v ?? "—"}</b>{v != null && <> <Pill c={v <= 0.7 ? "a" : "g"}>{v <= 0.7 ? "abnormal" : "normal"}</Pill></>}</td>)}</tr>
          </tbody></table>
          {d.abiMissing && <div className="fld" style={{ marginTop: 8 }}><label className="req-l">No pressures today — why?</label><input value={c.abiNotDone} onChange={(e) => set("abiNotDone", e.target.value)} placeholder="e.g. Doppler unavailable, formal ABI ordered" /></div>}
        </div>
      </div>

      {d.diabetic ? (
        <>
          <H hint="IWGDF 2019 · both feet, shoes and socks off">Diabetic foot examination</H>
          <div className="grid2" style={{ gap: "0 24px" }}>
            <table className="t cmp-t"><thead><tr><th style={{ width: "40%" }} /><th>Right</th><th>Left</th></tr></thead><tbody>
              <tr><td className="sm">10 g monofilament <div className="xs mut">nurse</div></td><td className="sm">{d.t.limbs.right.sensation || "—"}</td><td className="sm">{d.t.limbs.left.sensation || "—"}</td></tr>
              <tr><td className="sm">Vibration (128 Hz) *</td><td>{fsel("right", "vibration", "Vibration")}</td><td>{fsel("left", "vibration", "Vibration")}</td></tr>
              <tr><td className="sm">Ankle reflex</td><td>{fsel("right", "reflex", "Reflex")}</td><td>{fsel("left", "reflex", "Reflex")}</td></tr>
              <tr><td className="sm">Callus</td>{(["right", "left"] as Sd[]).map((sd) => <td key={sd}><label className="check" style={{ padding: 0 }}><input type="checkbox" checked={c.foot[sd].callus} onChange={(e) => setFoot(sd, { callus: e.target.checked })} aria-label={`Callus ${sd}`} /> present</label></td>)}</tr>
            </tbody></table>
            <div>
              <Sel id="c_footwear" label="Footwear" sub="inspected today" value={c.footwear} opts={FOOTWEAR} onChange={(v) => set("footwear", v)} req />
              <label className="check"><input type="checkbox" checked={c.ulcerHistory} onChange={(e) => set("ulcerHistory", e.target.checked)} /> Current or previous foot ulcer</label>
              <div className="xs mut">Previous amputation {d.cl.prevAmp ? <b>yes</b> : "no"} · on dialysis {d.cl.dialysis ? <b>yes</b> : "no"} (from registration)</div>
            </div>
          </div>
          <div className="grid2" style={{ gap: "0 24px" }}>
            {(["right", "left"] as Sd[]).map((sd) => (
              <div key={sd}>
                <Sub>{sd} foot — deformity and skin</Sub>
                <Chips opts={DEFORMITY} on={c.foot[sd].deformity} onChange={(v) => setFoot(sd, { deformity: v })} />
                <div style={{ height: 6 }} />
                <Chips opts={SKIN} on={c.foot[sd].skin} onChange={(v) => setFoot(sd, { skin: v })} />
              </div>
            ))}
          </div>
          <div className="live" style={{ background: ["#12874a", "#4b8fd4", "#b57314", "#c32b45"][d.risk.cat], marginBottom: 0 }}>
            <div className="k">IWGDF risk category{c.wounds.length ? " — applies once the ulcer has healed" : ""}</div>
            <div className="v">{d.risk.cat} · {d.risk.label}</div>
            <div className="a">Loss of protective sensation {d.lops ? "yes" : "no"} · PAD {d.pad ? "yes" : "no"} · deformity {d.deformity ? "yes" : "no"} → foot check {d.risk.interval}</div>
          </div>
        </>
      ) : <div className="xs mut mt14">Not diabetic: the IWGDF foot examination is not required.</div>}
    </>
  );
}

// ------------------------------------------------------------------ Wounds

export function WoundsTab({ r, c, d, me, set, upd }: TabProps) {
  const [zoom, setZoom] = useState<WoundPhoto | null>(null);
  const pw = (id: string, patch: Partial<WoundF>) => upd((x) => ({ ...x, wounds: x.wounds.map((w) => (w.id === id ? { ...w, ...patch } : w)) }));
  const photos = r.photos ?? [];

  async function addPhotos(w: WoundF, n: number, files: FileList | null) {
    if (!files?.length) return;
    const added: WoundPhoto[] = [];
    for (const f of Array.from(files).slice(0, 4)) {
      if (!f.type.startsWith("image/")) continue;
      try { const x = await downscale(f); added.push({ id: uid("IMG"), at: new Date().toISOString(), by: me.name, site: w.site || `${w.side} ${w.location}`, ...x, marker: false, source: "camera / upload", note: `Wound ${n} · consultation`, woundRef: w.id }); }
      catch { toast(`${f.name} could not be read.`); }
    }
    if (!added.length) return;
    setState((s) => ({ registrations: s.registrations.map((x) => (x.id === r.id ? { ...x, photos: [...(x.photos ?? []), ...added] } : x)) }));
    audit(me.name, "write", `${r.epi} ${r.name}`, `${added.length} wound photo(s) added at consultation (wound ${n})`);
  }

  return (
    <>
      {d.involved.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${d.involved.length},minmax(0,1fr))`, gap: 10, marginBottom: 12 }}>
          {d.involved.map((l) => (
            <div key={l.side} style={{ border: "1px solid var(--line)", borderRadius: "var(--r)", overflow: "hidden" }}>
              <div className="live" style={{ margin: 0, borderRadius: 0, background: l.stage == null ? "var(--line2)" : ["", "#12874a", "#4b8fd4", "#d2541a", "#c32b45"][l.stage], color: l.stage == null ? "var(--ink2)" : "#fff" }}>
                <div className="k">WIfI · {l.side} limb</div>
                <div className="v">{l.stage == null ? "—" : `Stage ${l.stage}`}</div>
                <div className="a">W{l.w} I{l.isch.grade ?? "?"} fI{l.fi} · {l.stage == null ? "needs ABI or toe pressure" : `1-year amputation risk ${RISK[l.stage]}`}</div>
              </div>
              <div style={{ padding: "8px 12px" }}>
                <div className="grid2" style={{ gap: "0 10px" }}>
                  <Sel id={`c_w_${l.side}`} label="W" sub={`worst wound · suggested W${l.wSug}`} value={c.w[l.side]} opts={["0", "1", "2", "3"]} onChange={(v) => set("w", { ...c.w, [l.side]: v })} />
                  <Sel id={`c_fi_${l.side}`} label="fI" sub={`worst infection · suggested fI${l.fiSug}`} value={c.fi[l.side]} opts={["0", "1", "2", "3"]} onChange={(v) => set("fi", { ...c.fi, [l.side]: v })} />
                </div>
                <div className="xs mut">I from {l.isch.source}</div>
              </div>
            </div>
          ))}
        </div>
      )}
      {d.clti && <div className="disc"><b>Chronic limb-threatening ischaemia.</b> Urgent vascular imaging and revascularisation MDT are suggested; discuss amputation risk on the Consent tab.</div>}

      {c.wounds.length === 0 && <div className="sm mut" style={{ marginBottom: 10 }}>No wounds recorded. Add one if the examination finds an ulcer the nurse did not record.</div>}
      {d.wounds.map(({ w, n, depth, area, tissueSum, inf, wagSug, wag, ut }) => {
        const mine = photos.filter((p) => p.woundRef === w.id || (w.fromNurse && !p.woundRef));
        return (
          <div key={w.id} className="card mb14" style={{ boxShadow: "none" }}>
            <div className="card-h">
              <h3>Wound {n} · <span style={{ textTransform: "capitalize" }}>{w.side}</span>{w.site && ` · ${w.site}`}</h3>
              <span className="hint">{w.fromNurse ? "recorded by the nurse — confirm or correct" : "added by the doctor"}</span>
              <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
                <Pill c={inf.grade >= 4 ? "r" : inf.grade === 3 ? "o" : inf.grade === 2 ? "a" : "g"}>IWGDF {inf.grade} · {inf.label}</Pill>
                <Pill>Wagner {wag}</Pill><Pill>UT {ut}</Pill>
                {!w.fromNurse && <button className="btn sm" onClick={() => set("wounds", c.wounds.filter((x) => x.id !== w.id))} aria-label={`Remove wound ${n}`}>✕</button>}
              </div>
            </div>
            <div className="card-b">
              <div className="grid2" style={{ gap: "0 24px" }}>
                <div>
                  <Sel id={`w${n}_side`} label="Side" value={w.side} opts={["right", "left"]} onChange={(v) => pw(w.id, { side: v as Sd })} req />
                  <div className="ob wide"><label>Site<span>free text</span></label><input value={w.site} onChange={(e) => pw(w.id, { site: e.target.value })} placeholder="e.g. plantar 1st metatarsal head" /></div>
                  <Sel id={`w${n}_loc`} label="Location" sub="for WIfI" value={w.location} opts={LOCATIONS} onChange={(v) => pw(w.id, { location: v })} req />
                  <Num id={`w${n}_len`} label="Length" sub="cm, head-to-toe" value={w.length} onChange={(v) => pw(w.id, { length: v })} req />
                  <Num id={`w${n}_wid`} label="Width" sub="cm, side-to-side" value={w.width} onChange={(v) => pw(w.id, { width: v })} req />
                  <Num id={`w${n}_dep`} label="Depth" sub="cm" value={w.depth} onChange={(v) => pw(w.id, { depth: v })} />
                  <div className="ob"><label>Area<span>length × width</span></label><div className="num" style={{ textAlign: "center", fontWeight: 700 }}>{area ? `${area} cm²` : "—"}</div></div>
                  <Num id={`w${n}_und`} label="Undermining" sub="cm, deepest" value={w.undermining} onChange={(v) => pw(w.id, { undermining: v })} />
                  <Num id={`w${n}_tun`} label="Tunnelling" sub="cm" value={w.tunnelling} onChange={(v) => pw(w.id, { tunnelling: v })} />
                </div>
                <div>
                  <Sub>Wound bed (% of area) <span style={{ color: tissueSum === 100 ? "var(--green)" : "var(--amber)", textTransform: "none", letterSpacing: 0 }}>· total {tissueSum}%</span></Sub>
                  <div className="grid2" style={{ gap: "0 12px" }}>
                    <Num id={`w${n}_gran`} label="Granulation" sub="red" value={w.granulation} onChange={(v) => pw(w.id, { granulation: v })} />
                    <Num id={`w${n}_slo`} label="Slough" sub="yellow" value={w.slough} onChange={(v) => pw(w.id, { slough: v })} />
                    <Num id={`w${n}_nec`} label="Necrotic" sub="black" value={w.necrotic} onChange={(v) => pw(w.id, { necrotic: v })} warn={num(w.necrotic) > 0} />
                    <Num id={`w${n}_epi`} label="Epithelial" sub="pink" value={w.epithelial} onChange={(v) => pw(w.id, { epithelial: v })} />
                  </div>
                  <Sub>Exposed structures · depth: {depth.split(" (")[0]}</Sub>
                  <Chips opts={EXPOSED} on={w.exposed} onChange={(v) => pw(w.id, { exposed: v })} red={() => true} />
                  <label className="check" style={{ marginTop: 4 }}><input type="checkbox" checked={w.probeBone} onChange={(e) => pw(w.id, { probeBone: e.target.checked })} /> Probe-to-bone positive</label>
                  <Sel id={`w${n}_gang`} label="Gangrene" value={w.gangrene === "None" ? "None" : w.gangrene} opts={GANGRENE} onChange={(v) => pw(w.id, { gangrene: v || "None" })} />
                  <Sel id={`w${n}_exu`} label="Exudate" value={w.exudate} opts={EXUDATE_D} onChange={(v) => pw(w.id, { exudate: v })} />
                  <Sub>Surrounding skin</Sub>
                  <Chips opts={PERIWOUND} on={w.periwound} onChange={(v) => pw(w.id, { periwound: v })} />
                </div>
              </div>

              <Sub>Infection (IWGDF/IDSA 2019) — {inf.grade === 1 ? "no infection" : `grade ${inf.grade}, ${inf.label}`}{d.sirs >= 2 && inf.grade > 1 ? ` · SIRS ${d.sirs}` : ""}{w.fromNurse && <span style={{ textTransform: "none", letterSpacing: 0, fontWeight: 400 }}> · nurse graded: {d.t.infection}</span>}</Sub>
              <div className="grid2" style={{ gap: "0 24px" }}>
                <div><div className="xs mut" style={{ marginBottom: 4 }}>Local signs (2 or more, or pus = infected)</div><Chips opts={LOCAL_SIGNS} on={w.local} onChange={(v) => pw(w.id, { local: v })} /></div>
                <div>
                  <div className="xs mut" style={{ marginBottom: 4 }}>Deeper than skin</div><Chips opts={DEEP_SIGNS} on={w.deep} onChange={(v) => pw(w.id, { deep: v })} red={() => true} />
                  <Num id={`w${n}_ery`} label="Erythema from edge" sub="cm (> 2 = moderate)" value={w.erythemaCm} onChange={(v) => pw(w.id, { erythemaCm: v })} warn={num(w.erythemaCm) > 2} />
                </div>
              </div>

              <div className="grid2" style={{ gap: "0 24px", marginTop: 6 }}>
                <Sel id={`w${n}_wag`} label="Wagner" sub={`suggested ${wagSug}`} value={w.wagner} opts={["0", "1", "2", "3", "4", "5"]} onChange={(v) => pw(w.id, { wagner: v })} />
                <div className="ob wide"><label>University of Texas<span>depth grade · A clean B infected C ischaemic D both</span></label><div className="num" style={{ textAlign: "center", fontWeight: 700 }}>{ut}</div></div>
              </div>

              <Sub>Photos</Sub>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                {mine.map((p) => (
                  <button key={p.id} onClick={() => setZoom(p)} style={{ padding: 0, border: "1px solid var(--line2)", borderRadius: 5, overflow: "hidden", background: "#000" }} aria-label="Enlarge wound photo">
                    {/* eslint-disable-next-line @next/next/no-img-element -- local data URL */}
                    <img src={p.dataUrl} alt={`Wound ${n}`} style={{ width: 92, height: 70, objectFit: "cover", display: "block" }} />
                  </button>
                ))}
                <label className="btn sm" style={{ cursor: "pointer" }}>⤒ Add photo
                  <input type="file" accept="image/*" multiple className="sr-only" aria-label={`Upload photo for wound ${n}`} onChange={(e) => { addPhotos(w, n, e.target.files); e.target.value = ""; }} />
                </label>
              </div>
            </div>
          </div>
        );
      })}
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn sm" onClick={() => set("wounds", [...c.wounds, newWound("right")])}>+ Add wound (right)</button>
        <button className="btn sm" onClick={() => set("wounds", [...c.wounds, newWound("left")])}>+ Add wound (left)</button>
      </div>
      {zoom && (
        <Modal title={`Wound photo · ${zoom.site}`} onClose={() => setZoom(null)} width={900}>
          {/* eslint-disable-next-line @next/next/no-img-element -- local data URL */}
          <img src={zoom.dataUrl} alt="Wound photo enlarged" style={{ width: "100%", maxHeight: "65vh", objectFit: "contain", background: "#000", borderRadius: 6 }} />
          <div className="xs mut" style={{ marginTop: 8 }}>{zoom.by} · {zoom.note}</div>
        </Modal>
      )}
    </>
  );
}

// ------------------------------------------------------------------ Treatment today

export function TreatmentTab({ c, d, set, upd }: TabProps) {
  const pw = (id: string, patch: Partial<WoundF>) => upd((x) => ({ ...x, wounds: x.wounds.map((w) => (w.id === id ? { ...w, ...patch } : w)) }));
  if (!c.wounds.length) return <div className="sm mut">No wounds recorded, so there is no wound treatment to document. Offloading and footwear advice can still go in the plan.</div>;
  return (
    <>
      {d.wounds.map(({ w, n, necrotic }) => (
        <div key={w.id} style={{ borderBottom: "1px solid var(--line)", paddingBottom: 12, marginBottom: 12 }}>
          <div className="sm" style={{ fontWeight: 700, marginBottom: 6 }}>Wound {n} · {w.side}{w.site && ` · ${w.site}`}{necrotic && <> <Pill c="a">necrotic tissue</Pill></>}</div>
          <div className="grid2" style={{ gap: "0 24px" }}>
            <div>
              <Sub>Debridement today</Sub>
              <div className="chipset" style={{ marginBottom: 6 }}>
                <button className={!w.debride ? "on" : ""} onClick={() => pw(w.id, { debride: false })}>Not done</button>
                <button className={w.debride ? "on" : ""} onClick={() => pw(w.id, { debride: true })}>Debrided</button>
              </div>
              {w.debride && (
                <>
                  <Sel id={`t${n}_m`} label="Method" value={w.method} opts={DEBRIDE_METHOD} onChange={(v) => pw(w.id, { method: v })} req />
                  <Sel id={`t${n}_a`} label="Anaesthesia" value={w.anaesthesia} opts={ANAESTHESIA} onChange={(v) => pw(w.id, { anaesthesia: v })} req />
                  <div className="xs mut" style={{ margin: "4px 0" }}>Tissue removed</div>
                  <Chips opts={REMOVED} on={w.removed} onChange={(v) => pw(w.id, { removed: v })} />
                  <Sel id={`t${n}_d`} label="Down to" value={w.depthTo} opts={DEBRIDE_DEPTH} onChange={(v) => pw(w.id, { depthTo: v })} />
                  <Sel id={`t${n}_h`} label="Bleeding control" value={w.haemostasis} opts={HAEMOSTASIS} onChange={(v) => pw(w.id, { haemostasis: v })} />
                  <Sel id={`t${n}_tol`} label="Tolerated" value={w.tolerated} opts={["Well", "With discomfort", "Stopped early — pain"]} onChange={(v) => pw(w.id, { tolerated: v })} />
                </>
              )}
            </div>
            <div>
              <Sub>Dressing plan</Sub>
              <Sel id={`t${n}_p`} label="Primary dressing" value={w.primary} opts={DRESS_PRIMARY} onChange={(v) => pw(w.id, { primary: v })} req />
              <Sel id={`t${n}_s`} label="Secondary / bandage" value={w.secondary} opts={DRESS_SECONDARY} onChange={(v) => pw(w.id, { secondary: v })} />
              <Sel id={`t${n}_f`} label="Change" value={w.freq} opts={DRESS_FREQ} onChange={(v) => pw(w.id, { freq: v })} req />
              <Sel id={`t${n}_b`} label="Changed by" value={w.by} opts={DRESS_BY} onChange={(v) => pw(w.id, { by: v })} req />
            </div>
          </div>
        </div>
      ))}
      <Sub>Offloading</Sub>
      <div style={{ maxWidth: 520 }}><Sel id="t_off" label="Device issued today" sub={d.diabetic ? "IWGDF: every plantar diabetic ulcer" : undefined} value={c.offload} opts={OFFLOAD} onChange={(v) => set("offload", v)} req={d.diabetic} /></div>
      {c.wounds.some((w) => w.debride) && <div className="xs mut" style={{ marginTop: 6 }}>Debridement recorded: consent is required on the <b>Consent</b> tab before signing.</div>}
    </>
  );
}

// ------------------------------------------------------------------ Diagnosis & orders

export function OrdersTab({ c, set, sugDx, sugOrders, sideName }: TabProps & { sugDx: string[]; sugOrders: string[]; sideName: string }) {
  const pending = sugDx.filter((id) => !c.dx.some((d) => d.id === id));
  return (
    <>
      <div className="fsec-h"><h4>Diagnoses</h4><span className="hint">ICD-10 (WHO) · the coding team verifies</span></div>
      {pending.length > 0 && (
        <div className="xs" style={{ marginBottom: 8 }}>Suggested: {pending.map((id) => (
          <button key={id} className="btn sm" style={{ margin: "0 4px 4px 0" }} onClick={() => set("dx", [...c.dx, { id, side: id === "vv" || id === "lymph" ? "" : sideName }])}>+ {DX.find((d) => d.id === id)!.label}</button>))}</div>
      )}
      <table className="t cmp-t" style={{ marginBottom: 8 }}><tbody>
        {c.dx.map((d, i) => (
          <tr key={d.id}><td className="sm"><b>{DX.find((x) => x.id === d.id)!.label}</b>{i === 0 && <span className="xs mut"> · primary</span>}</td><td className="num xs">{DX.find((x) => x.id === d.id)!.code}</td>
            <td style={{ width: 110 }}><select className="cmp" value={d.side} onChange={(e) => set("dx", c.dx.map((y) => (y.id === d.id ? { ...y, side: e.target.value } : y)))} aria-label="Side"><option value="">—</option><option value="right">right</option><option value="left">left</option><option value="bilateral">bilateral</option></select></td>
            <td style={{ width: 30 }}><button className="btn sm" onClick={() => set("dx", c.dx.filter((y) => y.id !== d.id))} aria-label="Remove diagnosis">✕</button></td></tr>))}
      </tbody></table>
      <select className="cmp" style={{ maxWidth: 360 }} value="" onChange={(e) => e.target.value && set("dx", [...c.dx, { id: e.target.value, side: sideName }])} aria-label="Add diagnosis">
        <option value="">+ Add a diagnosis…</option>
        {DX.filter((d) => !c.dx.some((x) => x.id === d.id)).map((d) => <option key={d.id} value={d.id}>{d.label} · {d.code}</option>)}
      </select>
      <div className="fsec-h mt14"><h4>Orders</h4>{c.orders.some((o) => CONTRAST.includes(o)) && <span className="hint">contrast study selected</span>}</div>
      {sugOrders.length > 0 && (
        <div className="xs" style={{ marginBottom: 10 }}>Suggested by the findings: {sugOrders.map((o) => <button key={o} className="btn sm" style={{ margin: "0 4px 4px 0" }} onClick={() => set("orders", [...c.orders, o])}>+ {o}</button>)}
          {sugOrders.length > 1 && <button className="btn sm p" style={{ marginBottom: 4 }} onClick={() => set("orders", [...c.orders, ...sugOrders])}>Add all</button>}</div>
      )}
      <div className="grid2" style={{ gap: "4px 24px" }}>
        {ORDERS.map((g) => (
          <div key={g.g}>
            <Sub>{g.g}</Sub>
            {g.items.map((o) => <label key={o} className="check"><input type="checkbox" checked={c.orders.includes(o)} onChange={() => set("orders", toggle(c.orders, o))} /> {o}</label>)}
          </div>
        ))}
      </div>
    </>
  );
}

// ------------------------------------------------------------------ Medicines

export function MedsTab({ c, d, set, upd, al }: TabProps) {
  const [newMed, setNewMed] = useState("");
  const abx = c.rx.filter((x) => /amoxi|clav|clindamycin|cotrimoxazole|linezolid|cef|cipro|levoflox|doxy|metronidazole|piperacillin|meropenem/i.test(x.drug));
  const setHome = (i: number, patch: Partial<C["home"][number]>) => upd((x) => ({ ...x, home: x.home.map((m, j) => (j === i ? { ...m, ...patch } : m)) }));
  return (
    <>
      <div className="fsec-h"><h4>Medicine reconciliation</h4><span className="hint">what the patient already takes · decide each one</span></div>
      <table className="t cmp-t">
        <thead><tr><th>Medicine</th><th style={{ width: 110 }}>Dose</th><th style={{ width: 140 }}>Decision *</th><th>Reason (if stopped, held or changed)</th><th /></tr></thead>
        <tbody>
          {c.home.length === 0 && <tr><td colSpan={5} className="sm mut">No current medicines recorded.</td></tr>}
          {c.home.map((m, i) => (
            <tr key={i}>
              <td><input className="cmp" value={m.drug} onChange={(e) => setHome(i, { drug: e.target.value })} aria-label={`Home medicine ${i + 1}`} /></td>
              <td><input className="cmp" value={m.dose} onChange={(e) => setHome(i, { dose: e.target.value })} aria-label={`Home dose ${i + 1}`} /></td>
              <td><select className={`cmp${m.action === "" ? " empty" : m.action !== "Continue" ? " warn" : ""}`} value={m.action} onChange={(e) => setHome(i, { action: e.target.value })} aria-label={`Decision ${i + 1}`}>
                <option value="">Select…</option>{MED_ACTIONS.map((a) => <option key={a}>{a}</option>)}</select></td>
              <td>{m.action && m.action !== "Continue" && <input className="cmp" value={m.reason} onChange={(e) => setHome(i, { reason: e.target.value })} placeholder="e.g. hold 48 h before angiography" aria-label={`Reason ${i + 1}`} />}</td>
              <td><button className="btn sm" onClick={() => set("home", c.home.filter((_, j) => j !== i))} aria-label="Remove">✕</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: "flex", gap: 6, marginTop: 6, maxWidth: 480 }}>
        <input className="cmp" value={newMed} onChange={(e) => setNewMed(e.target.value)} placeholder="Add a current medicine (name)" aria-label="New home medicine" />
        <button className="btn sm" disabled={!newMed.trim()} onClick={() => { set("home", [...c.home, { drug: newMed.trim(), dose: "", action: "", reason: "" }]); setNewMed(""); }}>Add</button>
      </div>

      <H hint="demo formulary with typical adult doses — not a verified drug database">New prescription</H>
      <table className="t cmp-t" style={{ marginBottom: 10 }}>
        <thead><tr><th>Drug</th><th>Dose</th><th>Route</th><th>Frequency</th><th>Days</th><th /></tr></thead>
        <tbody>
          {c.rx.length === 0 && <tr><td colSpan={6} className="sm mut">No new medicines.</td></tr>}
          {c.rx.map((x, i) => (
            <tr key={i}>
              <td className="sm"><b>{x.drug}</b>{al.some((a) => a.id.endsWith(x.drug)) && <> <Pill c={al.some((a) => a.id.endsWith(x.drug) && a.level === "block") ? "r" : "a"}>check</Pill></>}</td>
              {(["dose", "route", "freq", "days"] as const).map((k) => <td key={k}><input className="cmp" value={x[k]} onChange={(e) => set("rx", c.rx.map((y, j) => (j === i ? { ...y, [k]: e.target.value } : y)))} aria-label={`${x.drug} ${k}`} /></td>)}
              <td><button className="btn sm" onClick={() => set("rx", c.rx.filter((_, j) => j !== i))} aria-label="Remove">✕</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <select className="cmp" style={{ maxWidth: 360 }} value="" aria-label="Add a medicine" onChange={(e) => { const f = FORMULARY.find((y) => y.drug === e.target.value); if (f) set("rx", [...c.rx, { ...f }]); }}>
        <option value="">+ Add a medicine…</option>
        {FORMULARY.filter((f) => !c.rx.some((x) => x.drug === f.drug)).map((f) => <option key={f.drug} value={f.drug}>{f.drug} {f.dose} {f.route} {f.freq}</option>)}
      </select>

      {abx.length > 0 && (
        <>
          <H hint="antimicrobial stewardship">Antibiotic: {abx.map((x) => x.drug).join(", ")}</H>
          <div className="grid2" style={{ gap: "0 24px" }}>
            <div>
              <Sel id="abx_ind" label="Indication" value={c.abx.indication} opts={ABX_INDICATION} onChange={(v) => set("abx", { ...c.abx, indication: v })} req />
              <Sel id="abx_cx" label="Culture before first dose" value={c.abx.culture} opts={CULTURE} onChange={(v) => set("abx", { ...c.abx, culture: v })} req />
            </div>
            <div>
              <Sel id="abx_dur" label="Planned duration" value={c.abx.duration} opts={["5 days", "7 days", "10–14 days", "1–2 weeks", "3 weeks (soft tissue, slow response)", "6 weeks (osteomyelitis)"]} onChange={(v) => set("abx", { ...c.abx, duration: v })} req />
              <Sel id="abx_rev" label="Review" value={c.abx.review} opts={["48–72 h with culture result", "At next clinic visit", "Phone review in 3 days"]} onChange={(v) => set("abx", { ...c.abx, review: v })} req />
            </div>
          </div>
        </>
      )}

      {d.bmt.length > 0 && (
        <>
          <H hint="PAD / diabetes quality measures · add or give a reason">Best medical therapy</H>
          <table className="t cmp-t"><tbody>
            {d.bmt.map((b) => (
              <tr key={b.id}>
                <td className="sm" style={{ width: "34%" }}><b>{b.label}</b><div className="xs mut">{b.detail}</div></td>
                <td style={{ width: 90 }}>{b.met ? <Pill c="g">met</Pill> : <Pill c="a">not met</Pill>}</td>
                <td>{!b.met && (
                  <div style={{ display: "flex", gap: 6 }}>
                    {b.add && FORMULARY.some((f) => f.drug === b.add) && <button className="btn sm" onClick={() => set("rx", [...c.rx, { ...FORMULARY.find((f) => f.drug === b.add)! }])}>+ {b.add}</button>}
                    <select className={`cmp${c.bmt[b.id] ? "" : " empty"}`} value={c.bmt[b.id] ?? ""} onChange={(e) => set("bmt", { ...c.bmt, [b.id]: e.target.value })} aria-label={`${b.label} reason`}>
                      <option value="">Reason not given…</option>{BMT_REASONS.map((x) => <option key={x}>{x}</option>)}</select>
                  </div>
                )}</td>
              </tr>
            ))}
          </tbody></table>
        </>
      )}
    </>
  );
}

// ------------------------------------------------------------------ Discussion & consent

export function ConsentTab({ r, c, d, set }: TabProps) {
  const procedures = c.wounds.filter((w) => w.debride);
  const [padKey, setPadKey] = useState(0);
  return (
    <>
      <div className="grid2" style={{ gap: "0 24px" }}>
        <div>
          <Sub>Present at the consultation</Sub>
          <Chips opts={PRESENT} on={c.present} onChange={(v) => set("present", v)} />
          <div style={{ marginTop: 8 }}><Sel id="c_interp" label="Interpreter" sub={`patient's language: ${r.language}`} value={c.interpreter} opts={INTERPRETER} onChange={(v) => set("interpreter", v)} req /></div>
        </div>
        <div>
          <Sub>Discussed with the patient{d.clti || d.involved.some((l) => (l.stage ?? 0) >= 4) ? " · amputation risk must be discussed" : ""}</Sub>
          <Chips opts={DISCUSSED} on={c.discussed} onChange={(v) => set("discussed", v)} />
        </div>
      </div>
      {(d.clti || d.involved.some((l) => (l.stage ?? 0) >= 3)) && (
        <>
          <H hint={d.clti || d.involved.some((l) => (l.stage ?? 0) >= 4) ? "required · shared decision" : "optional at WIfI stage 3 · shared decision"}>Treatment decision</H>
          <div className="chipset">{DECISION.map((o) => <button key={o} className={c.decision === o ? "on" : ""} onClick={() => set("decision", o)}>{o}</button>)}</div>
        </>
      )}
      <div className="fld mt14"><label>Patient&apos;s goals and concerns</label><input value={c.goals} onChange={(e) => set("goals", e.target.value)} placeholder="e.g. wants to keep walking to work; worried about cost" /></div>
      <label className="check" style={{ marginTop: 8 }}><input type="checkbox" checked={c.teachBack} onChange={(e) => set("teachBack", e.target.checked)} /> Patient (or family) explained the plan back in their own words (teach-back) *</label>

      <H hint={procedures.length ? `required: debridement of wound ${procedures.map((w) => c.wounds.indexOf(w) + 1).join(", ")}` : "only when a procedure is done today"}>Procedure consent</H>
      {procedures.length === 0 ? <div className="sm mut">No procedure recorded on the Treatment tab.</div> : (
        <>
          <div className="grid2" style={{ gap: "0 24px" }}>
            <div>
              <Sel id="cons_type" label="Consent" value={c.consent.type} opts={["Verbal (documented)", "Written (signed)"]} onChange={(v) => set("consent", { ...c.consent, type: v })} req />
              <Sel id="cons_by" label="Given by" value={c.consent.by} opts={["Patient", "Relative / legal representative"]} onChange={(v) => set("consent", { ...c.consent, by: v })} req />
              {c.consent.by !== "Patient" && <div className="ob wide"><label>Name and relation *</label><input value={c.consent.relName} onChange={(e) => set("consent", { ...c.consent, relName: e.target.value })} /></div>}
              <div className="ob wide"><label>Witness<span>staff name</span></label><input value={c.consent.witness} onChange={(e) => set("consent", { ...c.consent, witness: e.target.value })} /></div>
            </div>
            <div>
              <div className="xs mut" style={{ marginBottom: 4 }}>Risks explained (at least three) *</div>
              <Chips opts={CONSENT_RISKS} on={c.consent.risks} onChange={(v) => set("consent", { ...c.consent, risks: v })} />
            </div>
          </div>
          {c.consent.type === "Written (signed)" && (
            <div style={{ marginTop: 10, maxWidth: 520 }} key={padKey}>
              <SignaturePad onChange={(s) => set("consent", { ...c.consent, signed: s })} />
              {c.consent.signed && <button className="btn sm" style={{ marginTop: 4 }} onClick={() => { set("consent", { ...c.consent, signed: false }); setPadKey((k) => k + 1); }}>Sign again</button>}
            </div>
          )}
        </>
      )}
    </>
  );
}
