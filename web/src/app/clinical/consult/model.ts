// Consultation form state, its prefill from registration and the nursing assessment, and
// the findings derived from it. Shared by the consultation screen and its tabs.

import {
  DEPTHS, FI_FROM_IWGDF, RISK, abi, bestMedicalTherapy, depthBand, iwgdfInfection, iwgdfRisk, num, sirsCount, tbi,
  utClass, wagner, wifiI, wifiStage, wifiW, type BmtItem, type Side,
} from "@/lib/cx/consult";
import type { Registration, Rx } from "@/lib/cx/store";

export type Sd = "right" | "left";
export type WoundF = {
  id: string; fromNurse: boolean; side: Sd; site: string; location: string;
  length: string; width: string; depth: string;
  granulation: string; slough: string; necrotic: string; epithelial: string;
  undermining: string; tunnelling: string; exposed: string[]; probeBone: boolean;
  periwound: string[]; exudate: string; gangrene: string;
  local: string[]; deep: string[]; erythemaCm: string; wagner: string;
  debride: boolean; method: string; anaesthesia: string; removed: string[]; depthTo: string; haemostasis: string; tolerated: string;
  primary: string; secondary: string; freq: string; by: string;
};
export type FootF = { vibration: string; reflex: string; deformity: string[]; callus: boolean; skin: string[] };
export type MedF = { drug: string; dose: string; action: string; reason: string };

export type C = {
  hpi: string; duration: string; symptoms: string[]; pmh: string[]; allergies: string; hba1c: string; egfr: string; wbc: string;
  home: MedF[];
  pulses: { fem: Side; pop: Side; dp: Side; pt: Side };
  bra: Side; dpP: Side; ptP: Side; toe: Side; abiNotDone: string;
  foot: { right: FootF; left: FootF }; footwear: string; ulcerHistory: boolean;
  wounds: WoundF[]; w: Record<Sd, string>; fi: Record<Sd, string>;
  offload: string;
  dx: { id: string; side: string }[]; orders: string[]; rx: Rx[]; overrides: Record<string, string>;
  abx: { indication: string; culture: string; duration: string; review: string };
  bmt: Record<string, string>;
  present: string[]; interpreter: string; discussed: string[]; decision: string; goals: string; teachBack: boolean;
  consent: { type: string; by: string; relName: string; risks: string[]; signed: boolean; witness: string };
  plan: string; instructions: string[]; disposition: string; followUp: string; attest: boolean;
};

export const SYMPTOMS = ["Claudication", "Rest pain", "Night pain", "Fever / chills", "Discharge / smell", "Recent trauma / footwear", "Swelling", "Numbness / burning"];
export const PMH = ["Diabetes", "Hypertension", "Ischaemic heart disease", "Heart failure", "Stroke / TIA", "Chronic kidney disease", "On dialysis", "Previous amputation", "Previous angioplasty / bypass", "On blood thinners", "Current smoker"];

const S = (r = "", l = ""): Side => ({ r, l });
const foot = (): FootF => ({ vibration: "", reflex: "", deformity: [], callus: false, skin: [] });
let wseq = 0;

export function newWound(side: Sd, o: Partial<WoundF> = {}): WoundF {
  return {
    id: `W${Date.now().toString(36)}${wseq++}`, fromNurse: false, side, site: "", location: "",
    length: "", width: "", depth: "", granulation: "", slough: "", necrotic: "", epithelial: "",
    undermining: "", tunnelling: "", exposed: [], probeBone: false, periwound: [], exudate: "", gangrene: "None",
    local: [], deep: [], erythemaCm: "0", wagner: "",
    debride: false, method: "", anaesthesia: "", removed: [], depthTo: "", haemostasis: "", tolerated: "",
    primary: "", secondary: "", freq: "", by: "", ...o,
  };
}

const sideOf = (site: string): Sd => (/left/i.test(site) ? "left" : "right");
const locOf = (site: string) => (/heel/i.test(site) ? "Heel" : /toe|forefoot|metatarsal|hallux/i.test(site) ? "Toes / forefoot" : /mid/i.test(site) ? "Midfoot" : /leg|ankle|malleol|shin/i.test(site) ? "Ankle / leg" : "");

/** Prefill from registration and the nursing assessment; the doctor confirms or corrects. */
export function blank(r: Registration): C {
  const t = r.triage, cl = r.clinical, tw = t?.wound;
  const pmh = [
    cl.diabetes === "Yes" && "Diabetes", cl.ckd && "Chronic kidney disease", cl.dialysis && "On dialysis", cl.prevAmp && "Previous amputation",
    cl.prevRevasc && "Previous angioplasty / bypass", cl.anticoag && "On blood thinners", cl.smoking === "Current" && "Current smoker",
  ].filter(Boolean) as string[];
  const home: MedF[] = [
    cl.insulin && { drug: "Insulin (type and dose to confirm)", dose: "", action: "", reason: "" },
    cl.anticoag && { drug: "Anticoagulant (name to confirm)", dose: "", action: "", reason: "" },
    cl.diabetes === "Yes" && !cl.insulin && { drug: "Oral diabetes medicine (name to confirm)", dose: "", action: "", reason: "" },
  ].filter(Boolean) as MedF[];
  const nurseLocal = tw ? [tw.erythemaCm > 0.5 && "Erythema > 0.5 cm", tw.exudate === "Purulent" && "Purulent discharge", t!.vitals.pain >= 4 && "Tenderness / pain"].filter(Boolean) as string[] : [];
  const wounds = tw ? [newWound(sideOf(tw.site), {
    fromNurse: true, site: tw.site, location: locOf(tw.site),
    length: String(tw.length || ""), width: String(tw.width || ""), depth: tw.depth ? String(tw.depth) : "",
    probeBone: tw.probeBone, exudate: tw.exudate === "Purulent" ? "Heavy" : tw.exudate, erythemaCm: String(tw.erythemaCm ?? 0),
    gangrene: /Necrotic|eschar/i.test(tw.bed) && /toe/i.test(tw.site) ? "Digits only" : "None", local: nurseLocal,
  })] : [];
  return {
    hpi: "", duration: cl.woundWeeks ? `${cl.woundWeeks} weeks` : "",
    symptoms: [t?.limbs.restPain && "Rest pain", t?.limbs.claudicationM && "Claudication"].filter(Boolean) as string[],
    pmh, allergies: cl.allergies, hba1c: "", egfr: "", wbc: "", home,
    pulses: { fem: S(), pop: S(), dp: S(t?.limbs.right.dp, t?.limbs.left.dp), pt: S(t?.limbs.right.pt, t?.limbs.left.pt) },
    bra: S(), dpP: S(), ptP: S(), toe: S(), abiNotDone: "",
    foot: { right: foot(), left: foot() }, footwear: "", ulcerHistory: !!tw,
    wounds, w: { right: "", left: "" }, fi: { right: "", left: "" }, offload: "",
    dx: [], orders: [], rx: [], overrides: {},
    abx: { indication: "", culture: "", duration: "", review: "" }, bmt: {},
    present: ["Patient"], interpreter: "", discussed: [], decision: "", goals: "", teachBack: false,
    consent: { type: "", by: "Patient", relName: "", risks: [], signed: false, witness: "" },
    plan: "", instructions: [], disposition: "", followUp: "", attest: false,
  };
}

/** Older drafts (single-wound form) are merged onto a fresh prefill so no field is missing. */
export function fromDraft(r: Registration, d: Record<string, unknown>): C {
  const b = blank(r);
  const x = { ...b, ...(d as Partial<C>) };
  return Array.isArray(x.wounds) && x.home && x.foot && x.consent ? x : { ...x, wounds: b.wounds, home: x.home ?? b.home, foot: x.foot ?? b.foot, consent: x.consent ?? b.consent };
}

// ------------------------------------------------------------------ derived findings

export type WoundCalc = {
  w: WoundF; n: number; depth: string; area: number; tissueSum: number; inf: ReturnType<typeof iwgdfInfection>;
  wagSug: number; wag: number; ut: string; wifiW: number; plantar: boolean; necrotic: boolean;
};
export type LimbCalc = { side: Sd; abi: number | null; tbi: number | null; toe: number; isch: { grade: number | null; source: string }; wSug: number; w: number; fiSug: number; fi: number; stage: number | null; risk: string; wounds: WoundCalc[]; involved: boolean };

export function derive(r: Registration, c: C) {
  const t = r.triage!, cl = r.clinical, diabetic = cl.diabetes !== "No";
  const sirs = sirsCount(t.vitals, num(c.wbc) || 0);
  const abiBy: Record<Sd, number | null> = { right: abi(c.bra, c.dpP, c.ptP, "r"), left: abi(c.bra, c.dpP, c.ptP, "l") };
  const tbiBy: Record<Sd, number | null> = { right: tbi(c.bra, c.toe, "r"), left: tbi(c.bra, c.toe, "l") };
  const ischBy: Record<Sd, { grade: number | null; source: string }> = {
    right: wifiI(abiBy.right, num(c.toe.r) || 0), left: wifiI(abiBy.left, num(c.toe.l) || 0),
  };

  const wounds: WoundCalc[] = c.wounds.map((w, i) => {
    const depth = depthBand(w.exposed, w.probeBone);
    const inf = iwgdfInfection(w.local, num(w.erythemaCm) || 0, w.deep, sirs);
    const isch = (ischBy[w.side].grade ?? 0) >= 1 || (abiBy[w.side] != null && abiBy[w.side]! < 0.9);
    const wagSug = wagner(true, depth, w.gangrene || "None");
    return {
      w, n: i + 1, depth, area: +((num(w.length) || 0) * (num(w.width) || 0)).toFixed(2),
      tissueSum: ["granulation", "slough", "necrotic", "epithelial"].reduce((a, k) => a + (num(w[k as keyof WoundF] as string) || 0), 0),
      inf, wagSug, wag: w.wagner === "" ? wagSug : Number(w.wagner), ut: utClass(true, depth, inf.grade >= 2, isch),
      wifiW: wifiW(true, depth, w.gangrene || "None", w.location),
      plantar: w.location === "Toes / forefoot" || w.location === "Midfoot" || w.location === "Heel",
      necrotic: (num(w.necrotic) || 0) > 0 || (w.gangrene !== "None" && w.gangrene !== ""),
    };
  });

  const limbs: LimbCalc[] = (["right", "left"] as Sd[]).map((side) => {
    const ws = wounds.filter((x) => x.w.side === side);
    const restPain = t.limbs.restPain && (side === "left" ? t.limbs.left : t.limbs.right).dp !== "Palpable";
    const wSug = ws.length ? Math.max(...ws.map((x) => x.wifiW)) : 0;
    const fiSug = ws.length ? Math.max(...ws.map((x) => x.inf.fi)) : 0;
    const w = c.w[side] === "" ? wSug : Number(c.w[side]);
    const fi = c.fi[side] === "" ? fiSug : Number(c.fi[side]);
    const isch = ischBy[side];
    const stage = ws.length || restPain ? wifiStage(w, isch.grade, fi) : null;
    return { side, abi: abiBy[side], tbi: tbiBy[side], toe: num(c.toe[side === "right" ? "r" : "l"]) || 0, isch, wSug, w, fiSug, fi, stage, risk: stage ? RISK[stage] : "", wounds: ws, involved: ws.length > 0 || restPain };
  });
  const involved = limbs.filter((l) => l.involved);
  const worst = [...involved].sort((a, b) => (b.isch.grade ?? -1) - (a.isch.grade ?? -1))[0] ?? limbs[0];

  // foot risk
  const lops = (["right", "left"] as const).some((s) => /Reduced|Absent/.test(t.limbs[s].sensation) || /Reduced|Absent/.test(c.foot[s].vibration));
  const pedalAbnormal = [c.pulses.dp.r, c.pulses.dp.l, c.pulses.pt.r, c.pulses.pt.l].some((p) => p === "Absent" || p === "Doppler only");
  const pad = pedalAbnormal || (["right", "left"] as Sd[]).some((s) => (abiBy[s] != null && abiBy[s]! < 0.9) || (tbiBy[s] != null && tbiBy[s]! < 0.7));
  const deformity = c.foot.right.deformity.length > 0 || c.foot.left.deformity.length > 0;
  const risk = iwgdfRisk({ lops, pad, deformity, ulcerHistory: c.ulcerHistory, amputation: cl.prevAmp, esrd: cl.dialysis });

  const maxI = Math.max(-1, ...involved.map((l) => l.isch.grade ?? -1));
  const maxFi = Math.max(0, ...wounds.map((x) => x.inf.fi));
  const maxWag = wounds.length ? Math.max(...wounds.map((x) => x.wag)) : null;
  const anyBone = wounds.some((x) => x.depth === DEPTHS[2]);
  const gangreneDigits = wounds.some((x) => x.w.gangrene === "Digits only");
  const clti = (t.limbs.restPain || wounds.length > 0) && (maxI >= 2 || t.flags.some((f) => /CLTI/.test(f)));
  const abiMissing = abiBy.right == null && abiBy.left == null && !(num(c.toe.r) > 0) && !(num(c.toe.l) > 0);

  const medsTaken = [...c.rx.map((x) => x.drug), ...c.home.filter((m) => m.action === "Continue" || m.action === "Change dose").map((m) => m.drug)];
  const bmt: BmtItem[] = bestMedicalTherapy({
    pad: pad || maxI >= 1 || c.dx.some((d) => d.id === "clti" || d.id === "pad" || d.id === "dfu-ni"),
    diabetic, smoker: cl.smoking === "Current", sbp: t.vitals.sbp, hba1c: num(c.hba1c), hba1cOrdered: c.orders.includes("HbA1c"), meds: medsTaken,
  });

  return {
    t, cl, diabetic, sirs, abiBy, tbiBy, ischBy, wounds, limbs, involved, worst, lops, pad, deformity, risk,
    maxI, maxFi, maxWag, anyBone, gangreneDigits, clti, abiMissing, bmt, FI_FROM_IWGDF,
    worstSideName: worst.side,
  };
}
export type D = ReturnType<typeof derive>;
