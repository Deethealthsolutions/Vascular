// Quick visit: the one-screen record (form shape, option lists, derived values and the
// research-readiness score). Stored by supabase/migrations/*_quick_visits.sql.

export const SITES = ["Toe(s)", "Forefoot / plantar", "Midfoot", "Heel", "Dorsum of foot", "Ankle / malleolus", "Leg", "Other"];
export const COMPLAINTS = ["Foot ulcer", "Wound not healing", "Leg pain on walking", "Pain at rest / at night", "Black / discoloured toe", "Swelling / redness", "Dressing / review", "Other"];
export const WAGNER = [
  { v: 0, t: "0 · Intact skin, at risk" }, { v: 1, t: "1 · Superficial ulcer" }, { v: 2, t: "2 · Deep, to tendon / capsule" },
  { v: 3, t: "3 · Deep with abscess / bone" }, { v: 4, t: "4 · Forefoot gangrene" }, { v: 5, t: "5 · Whole-foot gangrene" },
];
export const INFECTION = ["Uninfected", "Mild", "Moderate", "Severe"];
export const PULSE = ["Palpable", "Weak", "Absent"];
export const DIAGNOSES = [
  "Diabetic foot ulcer — neuropathic", "Diabetic foot ulcer — neuro-ischaemic", "Diabetic foot infection", "Osteomyelitis",
  "Peripheral arterial disease", "Chronic limb-threatening ischaemia", "Gangrene", "Venous leg ulcer", "Pressure injury", "Charcot foot", "Other",
];
export const TREATMENTS = [
  "Sharp debridement", "Dressing", "Offloading device", "Antibiotics", "Compression", "NPWT", "Wound swab / culture",
  "X-ray", "Arterial duplex", "Referred to vascular surgery", "HBOT assessment", "Foot-care education",
];
export const OUTCOMES = ["Home — review booked", "Admitted", "Referred elsewhere", "Healed — discharged from clinic", "Amputation planned"];

export type Background = {
  diabetes: string; dm_years: string; hba1c: string; insulin: boolean; hypertension: boolean; ckd: string;
  smoking: string; amputation: string; revasc: boolean; anticoag: boolean; allergies: string; medicines: string;
};
export type Patient = {
  id: string | null; patient_no: string; hospital_id: string; name: string; sex: string; age_years: string; dob: string;
  phone: string; area: string; city: string; abha: string; background: Background;
};
export type Visit = {
  id: string | null; visit_date: string; visit_type: string; referred_by: string; complaint: string; complaint_detail: string;
  wound: boolean; side: string; site: string; length: string; width: string; depth: string; weeks: string;
  wagner: string; infection: string; probe_bone: boolean; gangrene: string;
  pulses: { dpR: string; ptR: string; dpL: string; ptL: string }; abi_right: string; abi_left: string; rest_pain: boolean; claudication_m: string;
  rbs: string; bp: string;
  diagnoses: string[]; treatments: string[]; outcome: string; next_review: string; notes: string;
  research_consent: string; study: string;
};

export const blankBackground = (): Background => ({
  diabetes: "", dm_years: "", hba1c: "", insulin: false, hypertension: false, ckd: "No",
  smoking: "", amputation: "None", revasc: false, anticoag: false, allergies: "", medicines: "",
});
export const blankPatient = (): Patient => ({
  id: null, patient_no: "", hospital_id: "", name: "", sex: "", age_years: "", dob: "", phone: "", area: "", city: "", abha: "",
  background: blankBackground(),
});

/** Today in India (YYYY-MM-DD). */
export function todayIst(): string {
  return new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
}

export const blankVisit = (): Visit => ({
  id: null, visit_date: todayIst(), visit_type: "New", referred_by: "", complaint: "", complaint_detail: "",
  wound: true, side: "", site: "", length: "", width: "", depth: "", weeks: "", wagner: "", infection: "", probe_bone: false, gangrene: "None",
  pulses: { dpR: "", ptR: "", dpL: "", ptL: "" }, abi_right: "", abi_left: "", rest_pain: false, claudication_m: "",
  rbs: "", bp: "", diagnoses: [], treatments: [], outcome: "", next_review: "", notes: "", research_consent: "Not asked", study: "",
});

const num = (s: string) => (s.trim() === "" || isNaN(Number(s)) ? null : Number(s));

/** Wound area in cm² (length × width), or null. */
export function woundArea(v: Pick<Visit, "wound" | "length" | "width">): number | null {
  const l = num(v.length), w = num(v.width);
  return v.wound && l != null && w != null && l > 0 && w > 0 ? Math.round(l * w * 100) / 100 : null;
}

/** ABI band (TASC / ESVS): > 1.3 incompressible, 0.9–1.3 normal, 0.4–0.9 PAD, < 0.4 severe. */
export function abiBand(s: string): { label: string; tone: string } | null {
  const a = num(s);
  if (a == null || a <= 0) return null;
  if (a > 1.3) return { label: "Incompressible — use toe pressure", tone: "a" };
  if (a >= 0.9) return { label: "Normal", tone: "g" };
  if (a >= 0.4) return { label: "PAD", tone: "a" };
  return { label: "Severe ischaemia", tone: "r" };
}

/** Core research variables: which are recorded and which are missing (only those that apply). */
export function researchReadiness(p: Patient, v: Visit): { score: number; missing: string[]; total: number } {
  const diabetic = p.background.diabetes !== "" && p.background.diabetes !== "No";
  const items: [string, boolean, boolean][] = [
    // [label, applies, recorded]
    ["Age or date of birth", true, !!(p.age_years || p.dob)],
    ["Sex", true, !!p.sex],
    ["Diabetes status", true, !!p.background.diabetes],
    ["HbA1c", diabetic, num(p.background.hba1c) != null],
    ["Smoking", true, !!p.background.smoking],
    ["Wound site and side", v.wound, !!v.site && !!v.side],
    ["Wound size (length × width)", v.wound, woundArea(v) != null],
    ["Wound duration", v.wound, num(v.weeks) != null],
    ["Wagner grade", v.wound, v.wagner !== ""],
    ["Infection grade", v.wound, !!v.infection],
    ["ABI or all four foot pulses", true, num(v.abi_right) != null || num(v.abi_left) != null || Object.values(v.pulses).every(Boolean)],
    ["Diagnosis", true, v.diagnoses.length > 0],
    ["Treatment given", true, v.treatments.length > 0],
    ["Outcome", true, !!v.outcome],
    ["Research consent asked", true, v.research_consent !== "Not asked"],
  ];
  const apply = items.filter(([, a]) => a);
  const done = apply.filter(([, , r]) => r).length;
  return { score: Math.round((done / apply.length) * 100), missing: apply.filter(([, , r]) => !r).map(([l]) => l), total: apply.length };
}

/** What must be filled before saving (the rest is optional but lowers the research score). */
export function requiredMissing(p: Patient, v: Visit): string[] {
  return [
    p.name.trim().length < 2 && "patient name",
    !p.sex && "sex",
    !p.age_years && !p.dob && "age or date of birth",
    !v.complaint && "reason for visit",
    !v.outcome && "outcome",
  ].filter(Boolean) as string[];
}

/** Payload for qv_save(): research columns pulled out, full form kept in `data`. */
export function toSave(p: Patient, v: Visit, location: string) {
  const r = researchReadiness(p, v);
  return {
    patient: { id: p.id, hospital_id: p.hospital_id, name: p.name, sex: p.sex, age_years: p.age_years, dob: p.dob, phone: p.phone, area: p.area, city: p.city, abha: p.abha, background: p.background },
    visit: {
      id: v.id, visit_date: v.visit_date, visit_type: v.visit_type, location,
      diagnoses: v.diagnoses, wound_site: v.wound ? [v.side, v.site].filter(Boolean).join(" ") : "", wound_area_cm2: woundArea(v) ?? "",
      wagner: v.wound ? v.wagner : "", infection: v.wound ? v.infection : "", abi_right: v.abi_right, abi_left: v.abi_left,
      outcome: v.outcome, next_review: v.next_review, research_consent: v.research_consent, research_score: r.score,
      data: v,
    },
  };
}

/** Rebuild the form from a saved visit (`data` holds the full form). */
export function visitFromSaved(saved: { id: string; data: Partial<Visit> }): Visit {
  const b = blankVisit();
  return { ...b, ...saved.data, pulses: { ...b.pulses, ...(saved.data.pulses ?? {}) }, id: saved.id };
}
