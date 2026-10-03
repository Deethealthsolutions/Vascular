// Fixtures the mockup did not have, added to cover gaps in the requirements.
// REQ-CARE-001 asks for emergency and day-case encounters alongside IP and OP.

export type EdCase = {
  id: string; name: string; age: number; sex: string; centre: string; arrived: string;
  complaint: string; triage: 1 | 2 | 3; status: "awaiting vascular review" | "referred to vascular" | "admitted" | "discharged";
};

export const ED: EdCase[] = [
  { id: "ED-7701", name: "Ramesh Iyer", age: 67, sex: "M", centre: "CHN", arrived: "05:12", complaint: "Cold, pale left foot for 4 hours, known PAD", triage: 1, status: "awaiting vascular review" },
  { id: "ED-7702", name: "Shanthi Pillai", age: 58, sex: "F", centre: "CHN", arrived: "04:40", complaint: "Fever and spreading redness from right heel ulcer", triage: 2, status: "referred to vascular" },
  { id: "ED-7703", name: "Venkat Rao", age: 72, sex: "M", centre: "HYD", arrived: "03:55", complaint: "Black discoloration of two toes, diabetic", triage: 2, status: "admitted" },
  { id: "ED-7704", name: "Latha Gowda", age: 49, sex: "F", centre: "BLR", arrived: "05:30", complaint: "Foot blister after walking barefoot, glucose 312", triage: 3, status: "awaiting vascular review" },
];

export type DayCase = {
  id: string; name: string; age: number; sex: string; centre: string; time: string;
  procedure: string; status: "pre-op checklist" | "in theatre" | "recovery" | "ready for discharge";
  flags: string[];
};

export const DAYCASE: DayCase[] = [
  { id: "DC-3101", name: "Arvind Menon", age: 61, sex: "M", centre: "CHN", time: "08:00", procedure: "Right SFA angioplasty", status: "pre-op checklist", flags: ["eGFR 48 · hydration protocol", "Metformin held 24h"] },
  { id: "DC-3102", name: "Geetha Balan", age: 55, sex: "F", centre: "CHN", time: "09:30", procedure: "Sharp debridement, left forefoot", status: "in theatre", flags: [] },
  { id: "DC-3103", name: "Karthik Raman", age: 68, sex: "M", centre: "BLR", time: "08:30", procedure: "Great saphenous vein ablation", status: "recovery", flags: ["Anticoagulated · hold confirmed"] },
  { id: "DC-3104", name: "Priya Sundaram", age: 47, sex: "F", centre: "HYD", time: "10:00", procedure: "Total contact cast application", status: "ready for discharge", flags: [] },
  { id: "DC-3105", name: "Suresh Naidu", age: 70, sex: "M", centre: "CHN", time: "11:00", procedure: "Diagnostic angiogram", status: "pre-op checklist", flags: ["Iodinated contrast allergy · premedication"] },
];

export const OUTCOMES = ["Follow-up booked", "Discharged from clinic", "Admitted", "Referred for HBOT", "Referred to vascular surgery"] as const;
export const FOLLOWUPS = ["1 week", "2 weeks", "4 weeks", "3 months", "None"] as const;
