// Step 4B (tests & procedures): result forms per order, critical-result flags (rule A05),
// and the HBOT candidacy gates (rule A25) with the in-chamber glucose floor (rule A26).

export type Field = { k: string; label: string; unit?: string; type: "num" | "sel" | "text"; opts?: string[] };
export type ResultForm = { dept: "Vascular lab" | "Imaging" | "Laboratory"; fields: Field[]; critical?: (v: Record<string, string>) => string | null; pendingOk?: boolean };

const n = (s?: string) => (s == null || s.trim() === "" ? NaN : Number(s));
const SEG = ["Normal", "< 50% stenosis", "≥ 50% stenosis", "Occluded"];

export const RESULT_FORMS: Record<string, ResultForm> = {
  "Formal ABI / TBI": { dept: "Vascular lab", fields: [{ k: "abiR", label: "ABI right", type: "num" }, { k: "abiL", label: "ABI left", type: "num" }, { k: "tbiR", label: "TBI right", type: "num" }, { k: "tbiL", label: "TBI left", type: "num" }],
    critical: (v) => (n(v.abiR) < 0.4 || n(v.abiL) < 0.4 ? "ABI below 0.4 — critical limb ischaemia" : null) },
  "Arterial duplex — lower limb": { dept: "Vascular lab", fields: [{ k: "side", label: "Side scanned", type: "sel", opts: ["Right", "Left", "Both"] }, { k: "iliac", label: "Iliac", type: "sel", opts: SEG }, { k: "sfa", label: "Superficial femoral", type: "sel", opts: SEG }, { k: "pop", label: "Popliteal", type: "sel", opts: SEG }, { k: "tibial", label: "Tibial vessels", type: "sel", opts: SEG }, { k: "text", label: "Report", type: "text" }],
    critical: (v) => (v.pop === "Occluded" && v.tibial === "Occluded" ? "Popliteal and tibial occlusion — no run-off" : null) },
  "Venous duplex (reflux study)": { dept: "Vascular lab", fields: [{ k: "gsv", label: "Great saphenous reflux", type: "sel", opts: ["No", "Yes"] }, { k: "ssv", label: "Small saphenous reflux", type: "sel", opts: ["No", "Yes"] }, { k: "deep", label: "Deep venous reflux", type: "sel", opts: ["No", "Yes"] }, { k: "dvt", label: "Deep vein thrombosis", type: "sel", opts: ["No", "Yes"] }],
    critical: (v) => (v.dvt === "Yes" ? "Deep vein thrombosis" : null) },
  "TcPO₂": { dept: "Vascular lab", fields: [{ k: "tcpo2", label: "Periwound TcPO₂ on air", unit: "mmHg", type: "num" }],
    critical: (v) => (n(v.tcpo2) < 30 ? "TcPO₂ below 30 mmHg — poor healing potential" : null) },
  "X-ray foot (3 views)": { dept: "Imaging", fields: [{ k: "finding", label: "Main finding", type: "sel", opts: ["Normal", "Osteomyelitis changes", "Gas in soft tissue", "Charcot changes", "Fracture", "Foreign body", "Vascular calcification"] }, { k: "text", label: "Report", type: "text" }],
    critical: (v) => (v.finding === "Gas in soft tissue" ? "Gas in soft tissue — possible necrotising infection" : null) },
  "MRI foot": { dept: "Imaging", fields: [{ k: "osteo", label: "Osteomyelitis", type: "sel", opts: ["No", "Equivocal", "Yes"] }, { k: "abscess", label: "Abscess", type: "sel", opts: ["No", "Yes"] }, { k: "text", label: "Report", type: "text" }],
    critical: (v) => (v.abscess === "Yes" ? "Abscess on MRI — needs drainage" : null) },
  "CT angiography — lower limb": { dept: "Imaging", fields: [{ k: "target", label: "Revascularisation option", type: "sel", opts: ["Endovascular target", "Surgical bypass target", "No target vessel"] }, { k: "text", label: "Report", type: "text" }] },
  "Digital subtraction angiography": { dept: "Imaging", fields: [{ k: "target", label: "Revascularisation option", type: "sel", opts: ["Endovascular target", "Surgical bypass target", "No target vessel"] }, { k: "text", label: "Report", type: "text" }] },
  "HbA1c": { dept: "Laboratory", fields: [{ k: "hba1c", label: "HbA1c", unit: "%", type: "num" }] },
  "CBC": { dept: "Laboratory", fields: [{ k: "wbc", label: "WBC", unit: "×10⁹/L", type: "num" }, { k: "hb", label: "Haemoglobin", unit: "g/dL", type: "num" }, { k: "plt", label: "Platelets", unit: "×10⁹/L", type: "num" }],
    critical: (v) => (n(v.hb) < 7 ? "Haemoglobin below 7 g/dL" : n(v.wbc) > 20 ? "WBC above 20 — severe infection" : n(v.plt) < 50 ? "Platelets below 50" : null) },
  "CRP / ESR": { dept: "Laboratory", fields: [{ k: "crp", label: "CRP", unit: "mg/L", type: "num" }, { k: "esr", label: "ESR", unit: "mm/h", type: "num" }] },
  "Creatinine / eGFR": { dept: "Laboratory", fields: [{ k: "creat", label: "Creatinine", unit: "mg/dL", type: "num" }, { k: "egfr", label: "eGFR", unit: "mL/min", type: "num" }, { k: "k", label: "Potassium", unit: "mmol/L", type: "num" }],
    critical: (v) => (n(v.k) > 6 ? "Potassium above 6.0" : n(v.egfr) < 30 ? "eGFR below 30 — review doses and contrast" : null) },
  "Lipid profile": { dept: "Laboratory", fields: [{ k: "ldl", label: "LDL cholesterol", unit: "mg/dL", type: "num" }] },
  "Blood culture ×2": { dept: "Laboratory", pendingOk: true, fields: [{ k: "status", label: "Result", type: "sel", opts: ["Pending (48–72 h)", "No growth", "Growth"] }, { k: "organism", label: "Organism", type: "text" }],
    critical: (v) => (v.status === "Growth" ? `Positive blood culture${v.organism ? `: ${v.organism}` : ""}` : null) },
  "Deep tissue / bone culture": { dept: "Laboratory", pendingOk: true, fields: [{ k: "status", label: "Result", type: "sel", opts: ["Pending (48–72 h)", "No growth", "Growth"] }, { k: "organism", label: "Organism and sensitivities", type: "text" }] },
};

/** A result is complete when every non-report field is filled, or a pending-allowed culture is marked pending. */
export function resultComplete(order: string, v: Record<string, string>) {
  const f = RESULT_FORMS[order];
  if (!f) return true;
  if (f.pendingOk && v.status) return true;
  return f.fields.filter((x) => x.type !== "text" && x.k !== "organism").every((x) => (v[x.k] ?? "").trim() !== "");
}

// ------------------------------------------------------------------ dressing room

export const EDUCATION = ["How to keep the dressing clean and dry", "Signs of infection and when to come back", "Using the offloading device", "Daily foot check", "Leg elevation / compression care"];

// ------------------------------------------------------------------ HBOT assessment (rule A25 / A26)

export const HBOT_INDICATIONS = [
  "Diabetic foot ulcer, Wagner 3 or higher, not healing after 30 days of standard care",
  "Chronic refractory osteomyelitis",
  "Delayed radiation injury (soft tissue or bone)",
  "Compromised skin graft or flap",
  "Acute arterial insufficiency / crush injury",
];
export const HBOT_ABSOLUTE = ["Untreated pneumothorax", "Current bleomycin, cisplatin or doxorubicin", "Disulfiram"];
export const HBOT_RELATIVE = ["COPD with CO₂ retention", "Uncontrolled seizures", "Claustrophobia", "Upper respiratory infection / sinusitis", "Cannot equalise ears", "Fever above 38.5 °C", "Pregnancy", "Implanted device not cleared for the chamber"];
export const HBOT_CHECKS = ["Chest X-ray reviewed", "ECG reviewed", "Ear examination (otoscopy)", "Perfusion confirmed or revascularised", "Glucose plan: ≥ 120 mg/dL before each session (rule A26)"];

export function hbotGates(x: { indication: string; wagner: number | null; weeks: number; perfusionOk: boolean; tcpo2: number; absolute: string[] }) {
  const dfu = x.indication.startsWith("Diabetic foot ulcer");
  const gates = [
    { k: "Indication", ok: !!x.indication, why: x.indication || "not chosen" },
    { k: "Wagner ≥ 3", ok: !dfu || (x.wagner ?? 0) >= 3, why: dfu ? `Wagner ${x.wagner ?? "—"}` : "not a DFU indication" },
    { k: "30 days of standard care", ok: !dfu || x.weeks >= 4, why: dfu ? `${x.weeks || "?"} weeks so far` : "n/a" },
    { k: "Perfusion adequate or revascularised", ok: x.perfusionOk, why: x.perfusionOk ? "confirmed" : "not confirmed" },
    { k: "Tissue hypoxia (TcPO₂ < 40)", ok: !dfu || (x.tcpo2 > 0 && x.tcpo2 < 40), why: x.tcpo2 > 0 ? `${x.tcpo2} mmHg` : "TcPO₂ not measured" },
    { k: "No absolute contraindication", ok: x.absolute.length === 0, why: x.absolute.join(", ") || "none" },
  ];
  return { gates, eligible: gates.every((g) => g.ok) };
}
