// Step 4C (admission): bed layout, occupancy, scheme packages and admission rules.
// Package names and rates are demo values, not the official PM-JAY/CMCHIS package master.

import { NET } from "./data";
import type { Registration, State } from "./store";

export const UNITS = [
  { id: "Ward", name: "Vascular ward", beds: Array.from({ length: 24 }, (_, i) => `VW-${String(i + 1).padStart(2, "0")}`), side: ["VW-21", "VW-22", "VW-23", "VW-24"] },
  { id: "ICU", name: "Vascular ICU", beds: Array.from({ length: 8 }, (_, i) => `ICU-${String(i + 1).padStart(2, "0")}`), side: ["ICU-08"] },
] as const;

/** Who is in each Chennai bed now: the ward fixture (with transfers/discharges) plus admissions from OPD. */
export function occupancy(st: Pick<State, "adt" | "registrations">): Record<string, { name: string; from: "ward" | "opd" }> {
  const out: Record<string, { name: string; from: "ward" | "opd" }> = {};
  for (const r of NET.roster.filter((x) => x.site === "CHN")) {
    const a = st.adt[r.id];
    if (a?.discharged) continue;
    out[a?.bed ?? r.bed] = { name: r.name, from: "ward" };
  }
  for (const r of st.registrations) if (r.status === "admitted" && r.admission) out[r.admission.bed] = { name: r.name, from: "opd" };
  return out;
}

export const URGENCY = ["Emergency — admit now", "Urgent — today", "Planned — on a date"];
export const PROCEDURES = ["Angiography ± angioplasty", "Bypass surgery", "Surgical debridement in theatre", "Minor (toe / ray) amputation", "Major amputation", "IV antibiotics", "Glycaemic control", "NPWT", "Pain control"];
export const DIETS = ["Diabetic", "Renal (dialysis)", "Diabetic + renal", "Normal", "Nil by mouth from midnight"];

export const PACKAGES = [
  { code: "DEMO-VS-ANG", name: "Peripheral angioplasty ± stent (lower limb)", rate: 60000 },
  { code: "DEMO-VS-BYP", name: "Femoro-popliteal / distal bypass", rate: 110000 },
  { code: "DEMO-GS-DEB", name: "Surgical debridement of diabetic foot", rate: 15000 },
  { code: "DEMO-OR-TOE", name: "Toe / ray amputation", rate: 12000 },
  { code: "DEMO-OR-BKA", name: "Below-knee amputation", rate: 45000 },
  { code: "DEMO-MG-DFI", name: "Diabetic foot infection — medical management (per day)", rate: 1800 },
];
export const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

/** Suggested admission details from the signed consultation. */
export function suggestFromConsult(r: Registration) {
  const k = r.consult!;
  const dx = k.diagnoses.map((d) => d.id);
  const inf = Math.max(0, ...(k.wounds ?? []).map((w) => w.infection.grade));
  const procedures = [
    (dx.includes("clti") || k.orders.some((o) => /angiograph|MDT/i.test(o))) && "Angiography ± angioplasty",
    (inf >= 3 || k.orders.includes("Sharp debridement (dressing room)")) && "Surgical debridement in theatre",
    inf >= 3 && "IV antibiotics",
    r.clinical.diabetes === "Yes" && "Glycaemic control",
    (dx.includes("osteo") || dx.includes("gangrene")) && "Minor (toe / ray) amputation",
  ].filter(Boolean) as string[];
  const packages = [
    procedures.includes("Angiography ± angioplasty") && "DEMO-VS-ANG",
    procedures.includes("Surgical debridement in theatre") && "DEMO-GS-DEB",
    procedures.includes("Minor (toe / ray) amputation") && "DEMO-OR-TOE",
    procedures.includes("IV antibiotics") && "DEMO-MG-DFI",
  ].filter(Boolean) as string[];
  // Contact precautions for draining pus / abscess or severe infection, not for bone infection alone.
  const isolation = inf >= 4 || (k.wounds ?? []).some((w) => w.infection.deep.includes("Abscess"));
  const severe = inf >= 4 || (r.triage?.news ?? 0) >= 5;
  return {
    unit: severe ? "ICU" : "Ward",
    urgency: severe ? URGENCY[0] : dx.includes("clti") || inf >= 3 ? URGENCY[1] : URGENCY[2],
    procedures, packages, isolation,
    diet: r.clinical.dialysis ? (r.clinical.diabetes === "Yes" ? "Diabetic + renal" : "Renal (dialysis)") : r.clinical.diabetes === "Yes" ? "Diabetic" : "Normal",
    risks: [
      (r.age >= 75 || r.clinical.mobility !== "Walking unaided") && "Fall risk",
      /Wheelchair|Stretcher/i.test(r.clinical.mobility) && "Pressure-injury risk (Braden to be scored)",
      "VTE risk assessment due within 24 h",
      r.clinical.anticoag && "On anticoagulant — bridging plan needed before procedure",
      (r.clinical.ckd || r.clinical.dialysis) && "Kidney disease — contrast precautions",
    ].filter(Boolean) as string[],
    indication: `${k.diagnoses.map((d) => `${d.label}${d.side ? ` (${d.side})` : ""}`).join("; ")}. ${k.plan}`,
  };
}

/** Financial clearance by payer, as the admission desk records it. */
export function payerKind(scheme: string): "scheme" | "credit" | "insurance" | "self" {
  if (/PM-JAY|CMCHIS/i.test(scheme)) return "scheme";
  if (/CGHS|ESI|corporate/i.test(scheme)) return "credit";
  if (/insurance/i.test(scheme)) return "insurance";
  return "self";
}
