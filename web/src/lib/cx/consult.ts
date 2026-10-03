// Step 3 (doctor consultation): clinical rules as pure functions, kept apart from the UI so
// they can be reviewed and signed off by the clinical lead (docs/PATIENT_JOURNEY.md §5).
// Thresholds follow the cited sources; every one is listed in "Decisions for clinical sign-off".

import type { Rx } from "./store";

export type Side = { r: string; l: string };
export const PULSES = ["Palpable", "Weak", "Doppler only", "Absent"];

// ------------------------------------------------------------------ ABI / TBI

/** Ankle-brachial index: higher ankle pressure (DP or PT) on that side ÷ higher brachial pressure. */
export function abi(bra: Side, dp: Side, pt: Side, side: "r" | "l"): number | null {
  const b = Math.max(num(bra.r) || 0, num(bra.l) || 0);
  const a = Math.max(num(dp[side]) || 0, num(pt[side]) || 0);
  return a > 0 && b > 0 ? +(a / b).toFixed(2) : null;
}
export function tbi(bra: Side, toe: Side, side: "r" | "l"): number | null {
  const b = Math.max(num(bra.r) || 0, num(bra.l) || 0);
  const t = num(toe[side]);
  return t > 0 && b > 0 ? +(t / b).toFixed(2) : null;
}

/** AHA/ACC 2016 bands. Returns [label, tone]. */
export function abiBand(v: number | null): [string, string] {
  if (v == null) return ["not measured", "n"];
  if (v > 1.4) return ["non-compressible — use toe pressure", "a"];
  if (v >= 1.0) return ["normal", "g"];
  if (v >= 0.91) return ["borderline", "a"];
  if (v >= 0.7) return ["mild PAD", "a"];
  if (v >= 0.4) return ["moderate PAD", "o"];
  return ["severe PAD", "r"];
}

// ------------------------------------------------------------------ wound classification

export const DEPTHS = ["Superficial (skin / subcutaneous)", "Tendon or capsule exposed", "Bone or joint (probe-to-bone +)"];
export const GANGRENE = ["None", "Digits only", "Forefoot / midfoot", "Heel", "Whole foot"];
export const LOCATIONS = ["Toes / forefoot", "Midfoot", "Heel", "Ankle / leg"];

/** Wagner 0–5 suggested from the examination. */
export function wagner(hasWound: boolean, depth: string, gangrene: string): number {
  if (gangrene === "Whole foot") return 5;
  if (gangrene !== "None" && gangrene !== "") return 4;
  if (!hasWound) return 0;
  if (depth.startsWith("Bone")) return 3; // probe-to-bone: osteomyelitis until proven otherwise
  if (depth.startsWith("Tendon")) return 2;
  return 1;
}

/** University of Texas: grade 0–3 × stage A (clean) B (infected) C (ischaemic) D (both). */
export function utClass(hasWound: boolean, depth: string, infected: boolean, ischaemic: boolean): string {
  const g = !hasWound ? 0 : depth.startsWith("Bone") ? 3 : depth.startsWith("Tendon") ? 2 : 1;
  const s = infected && ischaemic ? "D" : ischaemic ? "C" : infected ? "B" : "A";
  return `${g}${s}`;
}

/** SVS WIfI wound grade (Mills 2014). */
export function wifiW(hasWound: boolean, depth: string, gangrene: string, location: string): number {
  if (!hasWound && (gangrene === "None" || gangrene === "")) return 0;
  if (gangrene === "Whole foot" || gangrene === "Forefoot / midfoot" || gangrene === "Heel") return 3;
  const deep = depth.startsWith("Bone") || depth.startsWith("Tendon");
  if (location === "Heel" && deep) return 3;
  if (deep || gangrene === "Digits only" || location === "Heel") return 2;
  return 1;
}

/** SVS WIfI ischaemia grade: ABI when compressible (≤ 1.3), otherwise toe pressure. */
export function wifiI(abiV: number | null, toeP: number): { grade: number | null; source: string } {
  if (abiV != null && abiV <= 1.3) return { grade: abiV >= 0.8 ? 0 : abiV >= 0.6 ? 1 : abiV >= 0.4 ? 2 : 3, source: `ABI ${abiV.toFixed(2)}` };
  if (toeP > 0) return { grade: toeP >= 60 ? 0 : toeP >= 40 ? 1 : toeP >= 30 ? 2 : 3, source: `toe pressure ${toeP} mmHg` };
  return { grade: null, source: abiV != null ? "ABI non-compressible and no toe pressure" : "no ABI or toe pressure" };
}

export const FI_FROM_IWGDF: Record<string, number> = { none: 0, mild: 1, moderate: 2, severe: 3 };

/** SVS WIfI clinical stage 1–4 (estimated 1-year amputation risk), indexed [W][I][fI]. */
const STAGE = [
  [[1, 1, 2, 3], [1, 2, 3, 4], [2, 2, 3, 4], [2, 3, 3, 4]],
  [[1, 1, 2, 3], [1, 2, 3, 4], [2, 3, 4, 4], [3, 3, 4, 4]],
  [[2, 2, 3, 4], [3, 3, 4, 4], [3, 4, 4, 4], [4, 4, 4, 4]],
  [[3, 3, 4, 4], [4, 4, 4, 4], [4, 4, 4, 4], [4, 4, 4, 4]],
];
export const RISK = ["", "very low", "low", "moderate", "high"];
export function wifiStage(w: number, i: number | null, fi: number): number | null {
  return i == null ? null : STAGE[w]?.[i]?.[fi] ?? null;
}

// ------------------------------------------------------------------ diagnoses (ICD-10, WHO edition)

export const DX = [
  { id: "dfu-n", code: "E11.4 · L97", label: "Diabetic foot ulcer — neuropathic" },
  { id: "dfu-ni", code: "E11.5 · L97", label: "Diabetic foot ulcer — neuro-ischaemic" },
  { id: "dfi", code: "E11.6 · L08.9", label: "Diabetic foot infection" },
  { id: "osteo", code: "M86.9", label: "Osteomyelitis of foot (suspected)" },
  { id: "clti", code: "I70.2", label: "Chronic limb-threatening ischaemia" },
  { id: "pad", code: "I70.2", label: "Peripheral arterial disease with claudication" },
  { id: "gangrene", code: "I70.2 · R02", label: "Gangrene of toe(s)" },
  { id: "ali", code: "I74.3", label: "Acute limb ischaemia" },
  { id: "vlu", code: "I83.0", label: "Venous leg ulcer" },
  { id: "vv", code: "I83.9", label: "Varicose veins" },
  { id: "pu", code: "L89", label: "Pressure injury (heel)" },
  { id: "charcot", code: "E11.6 · M14.2", label: "Charcot foot" },
  { id: "cell", code: "L03.1", label: "Cellulitis of leg" },
  { id: "lymph", code: "I89.0", label: "Lymphoedema" },
];

// ------------------------------------------------------------------ orders

export const ORDERS: { g: string; items: string[] }[] = [
  { g: "Vascular lab", items: ["Formal ABI / TBI", "Arterial duplex — lower limb", "Venous duplex (reflux study)", "TcPO₂"] },
  { g: "Imaging", items: ["X-ray foot (3 views)", "MRI foot", "CT angiography — lower limb", "Digital subtraction angiography"] },
  { g: "Laboratory", items: ["HbA1c", "CBC", "CRP / ESR", "Creatinine / eGFR", "Lipid profile", "Blood culture ×2", "Deep tissue / bone culture"] },
  { g: "Treatment & referral", items: ["Sharp debridement (dressing room)", "Offloading — total contact cast", "Offloading — removable walker", "NPWT", "Compression bandaging (4-layer)", "HBOT assessment", "Vascular MDT — revascularisation", "Podiatry / footwear", "Diabetology"] },
];
export const CONTRAST = ["CT angiography — lower limb", "Digital subtraction angiography"];

// ------------------------------------------------------------------ prescriptions (demo formulary)

export const FORMULARY: Rx[] = [
  { drug: "Amoxicillin-clavulanate", dose: "625 mg", route: "PO", freq: "TDS", days: "7" },
  { drug: "Clindamycin", dose: "300 mg", route: "PO", freq: "QID", days: "7" },
  { drug: "Cotrimoxazole", dose: "960 mg", route: "PO", freq: "BD", days: "7" },
  { drug: "Linezolid", dose: "600 mg", route: "PO", freq: "BD", days: "10" },
  { drug: "Cefuroxime", dose: "500 mg", route: "PO", freq: "BD", days: "7" },
  { drug: "Aspirin", dose: "75 mg", route: "PO", freq: "OD", days: "ongoing" },
  { drug: "Clopidogrel", dose: "75 mg", route: "PO", freq: "OD", days: "ongoing" },
  { drug: "Atorvastatin", dose: "40 mg", route: "PO", freq: "HS", days: "ongoing" },
  { drug: "Paracetamol", dose: "650 mg", route: "PO", freq: "QDS PRN", days: "5" },
  { drug: "Ibuprofen", dose: "400 mg", route: "PO", freq: "TDS", days: "3" },
  { drug: "Pentoxifylline", dose: "400 mg", route: "PO", freq: "TDS", days: "30" },
  { drug: "Metformin", dose: "500 mg", route: "PO", freq: "BD", days: "ongoing" },
  { drug: "Pregabalin", dose: "75 mg", route: "PO", freq: "BD", days: "30" },
  { drug: "Rosuvastatin", dose: "20 mg", route: "PO", freq: "HS", days: "ongoing" },
  { drug: "Amlodipine", dose: "5 mg", route: "PO", freq: "OD", days: "ongoing" },
  { drug: "Nicotine patch", dose: "14 mg/24 h", route: "TD", freq: "OD", days: "56" },
];

// ------------------------------------------------------------------ safety checks

/** fix: a one-click correction offered with the alert (e.g. a kidney-adjusted dose). */
export type Alert = { id: string; level: "block" | "warn"; text: string; fix?: { drug: string; dose: string; freq: string } };
type Ctx = {
  allergies: string; anticoag: boolean; ckd: boolean; dialysis: boolean;
  orders: string[]; rx: Rx[]; abiAffected: number | null; iGrade: number | null; fi: number; wagner: number | null;
};

const PEN = /amoxi|clav|penicillin|ampicillin|cloxacillin|piperacillin/i;
const CEPH = /cef|ceph/i;
const SULFA = /cotrimoxazole|sulfa|sulpha/i;
const NSAID = /ibuprofen|diclofenac|naproxen|aceclofenac|ketorolac/i;
const ANTIPLT = /aspirin|clopidogrel|ticagrelor/i;

/** Drug-allergy, drug-condition and order-condition checks. "block" needs a documented override to sign. */
export function alerts(c: Ctx): Alert[] {
  const out: Alert[] = [];
  const penAllergy = /penicillin|amoxi/i.test(c.allergies), sulfaAllergy = /sulfa|sulpha/i.test(c.allergies);
  for (const r of c.rx) {
    if (penAllergy && PEN.test(r.drug)) out.push({ id: `allergy-${r.drug}`, level: "block", text: `${r.drug}: patient is allergic to penicillin.` });
    if (penAllergy && CEPH.test(r.drug)) out.push({ id: `cross-${r.drug}`, level: "warn", text: `${r.drug}: possible cross-reactivity with penicillin allergy — check the reaction type.` });
    if (sulfaAllergy && SULFA.test(r.drug)) out.push({ id: `allergy-${r.drug}`, level: "block", text: `${r.drug}: patient is allergic to sulfonamides.` });
    if (c.anticoag && (NSAID.test(r.drug) || ANTIPLT.test(r.drug))) out.push({ id: `bleed-${r.drug}`, level: "warn", text: `${r.drug} with an anticoagulant: bleeding risk. Confirm the indication and add gastric protection.` });
    if ((c.ckd || c.dialysis) && NSAID.test(r.drug)) out.push({ id: `renal-${r.drug}`, level: "warn", text: `${r.drug}: avoid NSAIDs in kidney disease.` });
    if (c.dialysis && /metformin/i.test(r.drug)) out.push({ id: `metformin-${r.drug}`, level: "block", text: "Metformin is contraindicated in patients on dialysis." });
    else if (c.ckd && /metformin/i.test(r.drug)) out.push({ id: `metformin-${r.drug}`, level: "warn", text: "Metformin in kidney disease: check eGFR (stop below 30)." });
  }
  const contrast = c.orders.filter((o) => CONTRAST.includes(o));
  if (contrast.length && (c.ckd || c.dialysis)) out.push({ id: "contrast-renal", level: "warn", text: `${contrast[0]} with kidney disease: contrast-nephropathy precautions, hydrate, hold metformin 48 h${c.dialysis ? ", coordinate with the dialysis schedule" : ""}.` });
  if (contrast.length && !c.orders.includes("Creatinine / eGFR")) out.push({ id: "contrast-creat", level: "warn", text: "Contrast study ordered without creatinine / eGFR." });
  if (c.orders.includes("Compression bandaging (4-layer)") && c.abiAffected != null && c.abiAffected < 0.8)
    out.push({ id: "compression", level: "block", text: `Full compression with ABI ${c.abiAffected.toFixed(2)}: contraindicated below 0.8 (reduced compression only under specialist supervision; none below 0.5).` });
  if (c.orders.includes("Offloading — total contact cast") && ((c.iGrade ?? 0) >= 2 || c.fi >= 2))
    out.push({ id: "tcc", level: "block", text: "Total contact cast with significant ischaemia or moderate/severe infection: contraindicated." });
  if (c.orders.includes("HBOT assessment") && c.wagner != null && c.wagner < 3)
    out.push({ id: "hbot", level: "warn", text: `HBOT: the usual indication is a Wagner 3+ diabetic foot ulcer not healing after 30 days of standard care (this is Wagner ${c.wagner}).` });
  return out;
}

/** Orders the findings point to; shown as one-click suggestions, never added automatically. */
export function suggestOrders(x: { diabetic: boolean; probeBone: boolean; iGrade: number | null; clti: boolean; fi: number; wagner: number | null; venous: boolean; abiAffected: number | null; neuropathic: boolean; abiMissing: boolean }): string[] {
  const s = new Set<string>();
  if (x.abiMissing) s.add("Formal ABI / TBI");
  if (x.probeBone) ["X-ray foot (3 views)", "MRI foot", "Deep tissue / bone culture"].forEach((o) => s.add(o));
  if ((x.iGrade ?? 0) >= 1 || x.clti) { s.add("Arterial duplex — lower limb"); s.add("Lipid profile"); }
  if (x.clti) s.add("Vascular MDT — revascularisation");
  if (x.fi >= 2) ["CBC", "CRP / ESR", "Deep tissue / bone culture"].forEach((o) => s.add(o));
  if (x.fi >= 3) s.add("Blood culture ×2");
  if (x.diabetic) s.add("HbA1c");
  if (x.diabetic && (x.wagner ?? 0) >= 3) s.add("HBOT assessment");
  if (x.venous) { s.add("Venous duplex (reflux study)"); if (x.abiAffected != null && x.abiAffected >= 0.8) s.add("Compression bandaging (4-layer)"); }
  if (x.neuropathic && (x.iGrade ?? 0) === 0 && x.fi <= 1) s.add("Offloading — total contact cast");
  return [...s];
}

export const num = (s: string) => (s.trim() === "" ? NaN : Number(s));

// ------------------------------------------------------------------ doctor's wound assessment

export const EXPOSED = ["Tendon", "Joint capsule", "Bone"];
export const PERIWOUND = ["Healthy", "Macerated", "Callus rim", "Erythema", "Induration", "Dry / scaly", "Venous skin changes"];
export const EXUDATE_D = ["None", "Light", "Moderate", "Heavy"];
/** IWGDF/IDSA 2019 local signs; two or more (or pus) means infection. */
export const LOCAL_SIGNS = ["Swelling / induration", "Erythema > 0.5 cm", "Tenderness / pain", "Warmth", "Purulent discharge"];
export const DEEP_SIGNS = ["Abscess", "Osteomyelitis", "Septic arthritis", "Fasciitis"];

/** Wound depth band used by Wagner, University of Texas and WIfI, from the structures exposed. */
export function depthBand(exposed: string[], probeBone: boolean): string {
  if (probeBone || exposed.includes("Bone")) return DEPTHS[2];
  if (exposed.includes("Tendon") || exposed.includes("Joint capsule")) return DEPTHS[1];
  return DEPTHS[0];
}

/** SIRS criteria available in clinic (WBC only if entered). */
export function sirsCount(v: { temp: number; hr: number; rr: number }, wbc: number): number {
  return [v.temp > 38 || v.temp < 36, v.hr > 90, v.rr > 20, wbc > 12 || (wbc > 0 && wbc < 4)].filter(Boolean).length;
}

/** IWGDF/IDSA 2019 classification: 1 uninfected · 2 mild · 3 moderate · 4 severe; "(O)" when osteomyelitis. */
export function iwgdfInfection(local: string[], erythemaCm: number, deep: string[], sirs: number): { grade: 1 | 2 | 3 | 4; label: string; fi: number; osteo: boolean } {
  const infected = local.length >= 2 || local.includes("Purulent discharge") || deep.length > 0;
  const osteo = deep.includes("Osteomyelitis");
  const grade: 1 | 2 | 3 | 4 = !infected ? 1 : sirs >= 2 ? 4 : erythemaCm > 2 || deep.length > 0 ? 3 : 2;
  const label = ["", "uninfected", "mild", "moderate", "severe"][grade] + (osteo ? " (O)" : "");
  return { grade, label, fi: grade - 1, osteo };
}

// ------------------------------------------------------------------ diabetic foot examination

export const SENSE3 = ["Present", "Reduced", "Absent"];
export const DEFORMITY = ["Claw / hammer toes", "Hallux valgus (bunion)", "Prominent metatarsal heads", "Charcot deformity", "Previous minor amputation", "Limited joint mobility"];
export const SKIN = ["Dry skin", "Fissures", "Fungal nails", "Maceration between toes", "Ingrown nail"];
export const FOOTWEAR = ["Appropriate", "Ill-fitting", "Barefoot / chappals", "Therapeutic footwear"];

/** IWGDF 2019 risk stratification. Returns category 0–3 with the screening interval. */
export function iwgdfRisk(x: { lops: boolean; pad: boolean; deformity: boolean; ulcerHistory: boolean; amputation: boolean; esrd: boolean }): { cat: number; label: string; interval: string } {
  const cat = (x.lops || x.pad) && (x.ulcerHistory || x.amputation || x.esrd) ? 3
    : (x.lops && x.pad) || (x.lops && x.deformity) || (x.pad && x.deformity) ? 2
    : x.lops || x.pad ? 1 : 0;
  return { cat, label: ["very low", "low", "moderate", "high"][cat], interval: ["once a year", "every 6–12 months", "every 3–6 months", "every 1–3 months"][cat] };
}

// ------------------------------------------------------------------ treatment given today

export const DEBRIDE_METHOD = ["Sharp (scalpel / curette)", "Surgical (theatre)", "Autolytic", "Enzymatic", "Mechanical (monofilament pad)"];
export const ANAESTHESIA = ["None needed (neuropathic)", "Topical (EMLA)", "Local infiltration"];
export const REMOVED = ["Slough", "Necrotic tissue", "Callus", "Biofilm", "Non-viable bone"];
export const DEBRIDE_DEPTH = ["Dermis", "Subcutaneous", "Fascia", "Tendon", "Bone"];
export const HAEMOSTASIS = ["Pressure", "Silver nitrate", "Adrenaline gauze", "None needed"];
export const DRESS_PRIMARY = ["Alginate", "Hydrofibre", "Foam", "Hydrocolloid", "Hydrogel", "Silver dressing", "Povidone-iodine / cadexomer", "Medical honey", "Paraffin gauze", "Saline-moistened gauze", "NPWT", "Keep dry — povidone-iodine paint"];
export const DRESS_SECONDARY = ["Gauze + crepe bandage", "Foam pad", "Film", "4-layer compression", "Short-stretch compression", "None"];
export const DRESS_FREQ = ["Daily", "Alternate days", "Twice a week", "Weekly", "NPWT change 3× a week"];
export const DRESS_BY = ["Clinic dressing room", "Home-care nurse", "Family (trained today)", "Patient"];
export const OFFLOAD = ["Not needed", "Total contact cast", "Removable knee-high walker", "Removable ankle-high walker", "Forefoot offloading shoe", "Felted foam", "Post-operative shoe", "Crutches / wheelchair", "Therapeutic footwear with insoles"];

type TreatCtx = {
  wounds: { n: number; plantar: boolean; necrotic: boolean; exudate: string; fi: number; side: "right" | "left"; debrided: boolean; primary: string; secondary: string }[];
  iBySide: Record<"right" | "left", number | null>; abiBySide: Record<"right" | "left", number | null>;
  offload: string; diabetic: boolean;
};

/** Checks on what the doctor does today: debridement, dressings and offloading. */
export function treatmentAlerts(c: TreatCtx): Alert[] {
  const out: Alert[] = [];
  for (const w of c.wounds) {
    const i = c.iBySide[w.side] ?? 0, a = c.abiBySide[w.side];
    if (w.debrided && w.necrotic && i >= 2) out.push({ id: `debride-isch-${w.n}`, level: "block", text: `Wound ${w.n}: sharp debridement of dry necrosis in an ischaemic limb (I${i}) — keep it dry until revascularised.` });
    if (/compression/i.test(w.secondary) && a != null && a < 0.8) out.push({ id: `compress-${w.n}`, level: "block", text: `Wound ${w.n}: compression with ABI ${a.toFixed(2)} on the ${w.side} — contraindicated below 0.8.` });
    if (w.primary === "Hydrogel" && w.exudate === "Heavy") out.push({ id: `hydrogel-${w.n}`, level: "warn", text: `Wound ${w.n}: hydrogel on a heavily exuding wound will macerate — consider alginate or hydrofibre.` });
    if ((w.primary === "Hydrocolloid" || w.secondary === "Film") && w.fi >= 1) out.push({ id: `occlusive-${w.n}`, level: "warn", text: `Wound ${w.n}: occlusive dressing on an infected wound — use a non-occlusive or antimicrobial dressing.` });
    if (w.primary === "NPWT" && w.necrotic) out.push({ id: `npwt-${w.n}`, level: "warn", text: `Wound ${w.n}: NPWT over necrotic tissue — debride first.` });
  }
  const worstI = Math.max(c.iBySide.right ?? 0, c.iBySide.left ?? 0), worstFi = Math.max(0, ...c.wounds.map((w) => w.fi));
  if (c.offload === "Total contact cast" && (worstI >= 2 || worstFi >= 2)) out.push({ id: "tcc-today", level: "block", text: "Total contact cast with significant ischaemia or moderate/severe infection: contraindicated." });
  if (c.diabetic && c.wounds.some((w) => w.plantar) && (!c.offload || c.offload === "Not needed")) out.push({ id: "offload-missing", level: "warn", text: "Plantar diabetic foot ulcer without offloading — IWGDF: offload every plantar ulcer (non-removable knee-high device first choice)." });
  return out;
}

// ------------------------------------------------------------------ medicines: reconciliation, kidney dosing, stewardship

export const MED_ACTIONS = ["Continue", "Stop", "Hold", "Change dose"];
export const ABX = /amoxi|clav|clindamycin|cotrimoxazole|linezolid|cef|cipro|levoflox|doxy|metronidazole|piperacillin|meropenem/i;
export const ABX_INDICATION = ["Diabetic foot infection — mild", "Diabetic foot infection — moderate", "Diabetic foot infection — severe", "Osteomyelitis", "Cellulitis", "Post-debridement cover"];
export const CULTURE = ["Yes — sample taken before the first dose", "No — started empirically, culture pending", "No — not indicated (mild, no prior antibiotics)"];

/** Kidney dose checks for the demo formulary. eGFR in mL/min/1.73 m²; NaN when unknown. */
export function renalAlerts(rx: Rx[], egfr: number, ckd: boolean, dialysis: boolean): Alert[] {
  const out: Alert[] = [];
  if ((ckd || dialysis) && isNaN(egfr) && rx.length) out.push({ id: "egfr-unknown", level: "warn", text: "Kidney disease: enter the latest eGFR on the History tab to check doses." });
  const low = dialysis || egfr < 30, mid = !low && egfr < 60;
  for (const r of rx) {
    if (/amoxicillin-clav/i.test(r.drug) && low && r.freq !== "BD" && r.freq !== "OD")
      out.push({ id: `renal-${r.drug}`, level: "warn", text: `${r.drug}: reduce to 625 mg BD when eGFR < 30${dialysis ? "; give the dose after dialysis" : ""}.`, fix: { drug: r.drug, dose: "625 mg", freq: "BD" } });
    if (/cotrimoxazole/i.test(r.drug) && (dialysis || egfr < 15)) out.push({ id: `renal-${r.drug}`, level: "block", text: `${r.drug}: avoid when eGFR < 15 or on dialysis.` });
    else if (/cotrimoxazole/i.test(r.drug) && egfr < 30 && r.dose !== "480 mg")
      out.push({ id: `renal-${r.drug}`, level: "warn", text: `${r.drug}: halve the dose when eGFR 15–30.`, fix: { drug: r.drug, dose: "480 mg", freq: "BD" } });
    if (/cefuroxime/i.test(r.drug) && low && r.freq !== "OD") out.push({ id: `renal-${r.drug}`, level: "warn", text: `${r.drug}: once daily when eGFR < 30.`, fix: { drug: r.drug, dose: r.dose, freq: "OD" } });
    if (/pentoxifylline/i.test(r.drug) && low && r.freq === "TDS") out.push({ id: `renal-${r.drug}`, level: "warn", text: `${r.drug}: reduce to BD when eGFR < 30.`, fix: { drug: r.drug, dose: r.dose, freq: "BD" } });
    if (/pregabalin/i.test(r.drug) && (low || mid) && !(r.freq === "OD" && r.dose === (low ? "25 mg" : "75 mg")))
      out.push({ id: `renal-${r.drug}`, level: "warn", text: `${r.drug}: ${low ? "25 mg once daily when eGFR < 30 or on dialysis" : "75 mg once daily when eGFR 30–60"}.`, fix: { drug: r.drug, dose: low ? "25 mg" : "75 mg", freq: "OD" } });
  }
  return out;
}

/** Best medical therapy for peripheral arterial disease (ESVS 2024 / GVG 2019), plus glucose for diabetics. */
export type BmtItem = { id: "antiplatelet" | "statin" | "bp" | "glucose" | "smoking"; label: string; met: boolean; detail: string; add?: string };
export function bestMedicalTherapy(x: { pad: boolean; diabetic: boolean; smoker: boolean; sbp: number; hba1c: number; hba1cOrdered: boolean; meds: string[] }): BmtItem[] {
  const has = (re: RegExp) => x.meds.some((m) => re.test(m));
  const out: BmtItem[] = [];
  if (x.pad) {
    out.push({ id: "antiplatelet", label: "Antiplatelet", met: has(/aspirin|clopidogrel|ticagrelor|rivaroxaban 2\.5/i), detail: "single antiplatelet for symptomatic PAD", add: "Clopidogrel" });
    out.push({ id: "statin", label: "High-intensity statin", met: has(/atorvastatin|rosuvastatin/i), detail: "atorvastatin 40–80 or rosuvastatin 20–40", add: "Atorvastatin" });
    out.push({ id: "bp", label: "Blood pressure < 140/90", met: x.sbp > 0 && x.sbp < 140, detail: x.sbp ? `today ${x.sbp} systolic` : "not measured", add: "Amlodipine" });
  }
  if (x.diabetic) out.push({ id: "glucose", label: "HbA1c known and < 8%", met: (x.hba1c > 0 && x.hba1c < 8) || (isNaN(x.hba1c) && x.hba1cOrdered), detail: isNaN(x.hba1c) ? (x.hba1cOrdered ? "ordered today" : "not known") : `HbA1c ${x.hba1c}%` });
  if (x.smoker) out.push({ id: "smoking", label: "Smoking cessation", met: has(/nicotine|varenicline|bupropion/i), detail: "current smoker", add: "Nicotine patch" });
  return out;
}
export const BMT_REASONS = ["Advice given, patient to decide", "Declined by patient", "Contraindicated", "Already optimised elsewhere", "Referred to physician", "On anticoagulant instead"];

// ------------------------------------------------------------------ discussion and consent

export const PRESENT = ["Patient", "Spouse", "Son / daughter", "Other relative", "Carer"];
export const INTERPRETER = ["Not needed", "Staff interpreter", "Family member interpreted", "Telephone interpreter"];
export const DISCUSSED = ["Diagnosis", "Treatment options", "Risks and benefits", "Amputation risk", "Expected healing time", "Warning signs to return", "Cost / scheme cover"];
export const DECISION = ["Revascularisation first", "Conservative wound care", "Minor amputation", "Major amputation considered", "Palliative wound care", "Needs time to decide"];
export const CONSENT_RISKS = ["Pain", "Bleeding", "Infection", "Wound may look larger after debridement", "Further procedures may be needed", "Anaesthetic reaction"];
