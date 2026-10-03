// Hospital-side visit model, demo data and a browser-only store for the staff prototype.
// Production: EHR / ADT system of record (SPEC §4.5, §6). Never put real PHI here.

import { useMemo, useSyncExternalStore } from "react";

export const stages = ["waiting", "triage", "ready", "provider", "lab", "checkout", "done"] as const;
export type Stage = (typeof stages)[number];

export const stageLabel: Record<Stage, string> = {
  waiting: "Waiting room",
  triage: "In triage",
  ready: "Ready for provider",
  provider: "With provider",
  lab: "Vascular lab",
  checkout: "Checkout",
  done: "Visit complete",
};

export type Acuity = "emergent" | "urgent" | "routine";
export type VisitType = "wound" | "vascular" | "hbot" | "diabetic-foot";
export const visitTypeLabel: Record<VisitType, string> = {
  wound: "Wound clinic",
  vascular: "Vascular consult",
  hbot: "HBOT evaluation",
  "diabetic-foot": "Diabetic foot",
};

export type Patient = {
  mrn: string;
  first: string;
  last: string;
  dob: string;
  sex: "F" | "M" | "X";
  phone: string;
  language: string;
  address: string;
  allergies: string;
  payer: string;
  memberId: string;
  referralId?: string;
  referredBy?: string;
};

export type Vitals = {
  bp: string; hr: string; temp: string; rr: string; spo2: string; glucose: string; pain: string; weight: string;
};

export type History = {
  diabetes: "none" | "type1" | "type2"; a1c: string; smoking: "never" | "former" | "current";
  ckd: boolean; dialysis: boolean; anticoag: boolean; priorAmputation: boolean; meds: string;
};

export type Pulse = "2+" | "1+" | "doppler" | "absent" | "";
export type Pulses = { dpL: Pulse; ptL: Pulse; dpR: Pulse; ptR: Pulse };

export type Wound = {
  id: string;
  location: string;
  etiology: "diabetic" | "arterial" | "venous" | "pressure" | "surgical" | "radiation" | "other";
  lengthCm: string; widthCm: string; depthCm: string;
  granulation: number; slough: number; eschar: number;
  exudate: "none" | "light" | "moderate" | "heavy";
  probeToBone: boolean;
  infection: string[];
  weeksOpen: string;
};

export type AbiResult = {
  brachialL: string; brachialR: string;
  dpL: string; ptL: string; dpR: string; ptR: string;
  toeL: string; toeR: string;
};

export type Plan = {
  wagner: string;
  wifiW: string; wifiI: string; wifiFi: string;
  assessment: string;
  orders: string[];
  procedures: string[];
};

export type Checkout = { followUp: string; tasks: { label: string; done: boolean }[]; avsPrinted: boolean };

export type LogEntry = { at: string; text: string; by: string };

export type Visit = {
  id: string;
  patient: Patient;
  visitType: VisitType;
  arrivalMode: "walk-in" | "scheduled" | "referral";
  mobility: "ambulatory" | "cane/walker" | "wheelchair" | "stretcher";
  chiefComplaint: string;
  acuity: Acuity;
  redFlags: string[];
  eligibility: { status: "verified" | "inactive" | "pending"; copay?: string; priorAuth?: string };
  consents: string[];
  stage: Stage;
  room?: string;
  arrivedAt: string;
  stageSince: string;
  vitals?: Vitals;
  history?: History;
  pulses?: Pulses;
  fallRisk?: boolean;
  wounds: Wound[];
  abi?: AbiResult;
  plan?: Plan;
  checkout?: Checkout;
  disposition?: "discharged" | "transferred-ed" | "admitted";
  log: LogEntry[];
};

export const rooms = ["Exam 1", "Exam 2", "Exam 3", "Exam 4", "Procedure", "Vascular lab", "HBOT suite"];

// Returning patients the front desk can look up (demo registry).
export const registry: Patient[] = [
  { mrn: "MRN-400218", first: "Robert", last: "Hayes", dob: "1956-04-11", sex: "M", phone: "(555) 010-3321", language: "English", address: "12 Demo St", allergies: "Penicillin", payer: "Medicare", memberId: "1EG4-TE5-MK72" },
  { mrn: "MRN-400377", first: "Lucia", last: "Moreno", dob: "1963-09-02", sex: "F", phone: "(555) 010-8810", language: "Español", address: "88 Sample Ave", allergies: "NKDA", payer: "Humana", memberId: "H7723019" },
  { mrn: "MRN-400502", first: "James", last: "Whitfield", dob: "1949-11-02", sex: "M", phone: "(555) 010-4410", language: "English", address: "3 Example Ct", allergies: "Sulfa, adhesive tape", payer: "Aetna", memberId: "W22918374", referralId: "R-10497", referredBy: "Dr. Demo Referrer (Demo Family Practice)" },
  { mrn: "MRN-400611", first: "Denise", last: "Carter", dob: "1971-02-17", sex: "F", phone: "(555) 010-2299", language: "English", address: "450 Placeholder Rd", allergies: "NKDA", payer: "Blue Cross Blue Shield", memberId: "XJH88120044" },
  // Not on today's board — use these to demo a fresh check-in.
  { mrn: "MRN-400734", first: "Samuel", last: "Ortiz", dob: "1972-01-30", sex: "M", phone: "(555) 010-7781", language: "English", address: "9 Mock Lane", allergies: "NKDA", payer: "UnitedHealthcare", memberId: "UHC00918822", referralId: "R-10511", referredBy: "Dr. Demo Referrer (Demo Family Practice)" },
  { mrn: "MRN-400859", first: "Grace", last: "Kim", dob: "1958-07-23", sex: "F", phone: "(555) 010-6630", language: "English", address: "71 Test Blvd", allergies: "Iodinated contrast", payer: "Medicare", memberId: "4TR2-QX8-LP19" },
  { mrn: "MRN-400921", first: "Harold", last: "Bennett", dob: "1944-12-05", sex: "M", phone: "(555) 010-1187", language: "English", address: "200 Fictional Way", allergies: "NKDA", payer: "Medicare", memberId: "7HN3-WE1-KD55" },
];

const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();

const emptyWound = (): Omit<Wound, "id"> => ({
  location: "", etiology: "diabetic", lengthCm: "", widthCm: "", depthCm: "",
  granulation: 0, slough: 0, eschar: 0, exudate: "light", probeToBone: false, infection: [], weeksOpen: "",
});
export const newWound = (): Wound => ({ id: crypto.randomUUID(), ...emptyWound() });

function seedVisits(): Visit[] {
  return [
    {
      id: "V-3001", patient: registry[0], visitType: "wound", arrivalMode: "scheduled", mobility: "cane/walker",
      chiefComplaint: "Follow-up R plantar DFU, dressing soaked through", acuity: "urgent", redFlags: [],
      eligibility: { status: "verified", copay: "$0" }, consents: ["treat", "hipaa", "photo", "financial"],
      stage: "provider", room: "Exam 2", arrivedAt: ago(74), stageSince: ago(12),
      vitals: { bp: "148/86", hr: "92", temp: "37.4", rr: "16", spo2: "97", glucose: "212", pain: "3", weight: "96" },
      history: { diabetes: "type2", a1c: "8.9", smoking: "former", ckd: true, dialysis: false, anticoag: false, priorAmputation: false, meds: "Metformin, insulin glargine, lisinopril, atorvastatin" },
      pulses: { dpL: "1+", ptL: "1+", dpR: "doppler", ptR: "absent" }, fallRisk: true,
      wounds: [{ id: "w1", location: "R plantar 1st metatarsal head", etiology: "diabetic", lengthCm: "2.1", widthCm: "1.4", depthCm: "0.4", granulation: 60, slough: 40, eschar: 0, exudate: "moderate", probeToBone: false, infection: [], weeksOpen: "9" }],
      log: [
        { at: ago(74), text: "Checked in (scheduled)", by: "Front desk · K. Lee" },
        { at: ago(58), text: "Triage started, roomed Exam 2", by: "Nurse · T. Brooks, RN" },
        { at: ago(20), text: "Triage complete, ready for provider", by: "Nurse · T. Brooks, RN" },
        { at: ago(12), text: "Provider encounter started", by: "Provider · Dr. A. Rivera" },
      ],
    },
    {
      id: "V-3002", patient: registry[1], visitType: "diabetic-foot", arrivalMode: "walk-in", mobility: "ambulatory",
      chiefComplaint: "Blister on L heel from new shoes, 5 days", acuity: "routine", redFlags: [],
      eligibility: { status: "verified", copay: "$25" }, consents: ["treat", "hipaa", "photo", "financial"],
      stage: "triage", room: "Exam 1", arrivedAt: ago(31), stageSince: ago(6), wounds: [],
      log: [
        { at: ago(31), text: "Walk-in registered. Interpreter: Spanish requested", by: "Front desk · K. Lee" },
        { at: ago(6), text: "Triage started, roomed Exam 1", by: "Nurse · T. Brooks, RN" },
      ],
    },
    {
      id: "V-3003", patient: registry[2], visitType: "hbot", arrivalMode: "referral", mobility: "ambulatory",
      chiefComplaint: "HBOT evaluation: exposed mandible after extraction (prior head & neck radiation)", acuity: "routine", redFlags: [],
      eligibility: { status: "verified", copay: "$40", priorAuth: "Required for HBOT (payer: Aetna)" }, consents: ["treat", "hipaa", "photo", "financial", "hbot"],
      stage: "waiting", arrivedAt: ago(14), stageSince: ago(14), wounds: [],
      log: [{ at: ago(14), text: "Checked in (referral R-10497)", by: "Front desk · K. Lee" }],
    },
    {
      id: "V-3004", patient: registry[3], visitType: "vascular", arrivalMode: "scheduled", mobility: "ambulatory",
      chiefComplaint: "Calf pain after 1 block walking, R > L", acuity: "routine", redFlags: [],
      eligibility: { status: "verified", copay: "$40" }, consents: ["treat", "hipaa", "financial"],
      stage: "lab", room: "Exam 3", arrivedAt: ago(52), stageSince: ago(9),
      vitals: { bp: "136/82", hr: "74", temp: "36.8", rr: "14", spo2: "98", glucose: "", pain: "2", weight: "71" },
      history: { diabetes: "none", a1c: "", smoking: "current", ckd: false, dialysis: false, anticoag: false, priorAmputation: false, meds: "Amlodipine" },
      pulses: { dpL: "2+", ptL: "1+", dpR: "1+", ptR: "doppler" }, fallRisk: false, wounds: [],
      plan: { wagner: "", wifiW: "", wifiI: "", wifiFi: "", assessment: "Lifestyle-limiting claudication, suspect R SFA disease.", orders: ["ABI / TBI"], procedures: [] },
      log: [
        { at: ago(52), text: "Checked in (scheduled)", by: "Front desk · K. Lee" },
        { at: ago(40), text: "Triage complete", by: "Nurse · T. Brooks, RN" },
        { at: ago(20), text: "Provider exam, ABI/TBI ordered", by: "Provider · Dr. A. Rivera" },
        { at: ago(9), text: "Sent to vascular lab", by: "Provider · Dr. A. Rivera" },
      ],
    },
  ];
}

const KEY = "prototype.clinic.v1";
const EVT = "clinic-store-change";
let memoryRaw: string | null = null; // fallback when localStorage is unavailable

function readRaw(): string {
  try {
    let raw = localStorage.getItem(KEY);
    if (!raw) {
      raw = JSON.stringify(seedVisits());
      localStorage.setItem(KEY, raw);
    }
    return raw;
  } catch {
    return (memoryRaw ??= JSON.stringify(seedVisits()));
  }
}

function write(visits: Visit[]) {
  const raw = JSON.stringify(visits);
  memoryRaw = raw;
  try {
    localStorage.setItem(KEY, raw);
  } catch {
    // memory fallback already updated
  }
  window.dispatchEvent(new Event(EVT));
}

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(EVT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVT, cb);
  };
}

/** All visits. `null` until hydrated on the client. */
export function useVisits(): Visit[] | null {
  const raw = useSyncExternalStore(subscribe, readRaw, () => null);
  return useMemo(() => (raw === null ? null : (JSON.parse(raw) as Visit[])), [raw]);
}

const current = () => JSON.parse(readRaw()) as Visit[];

export function addVisit(v: Visit) {
  write([v, ...current()]);
}

export function updateVisit(id: string, fn: (v: Visit) => Visit) {
  write(current().map((v) => (v.id === id ? fn(v) : v)));
}

/** Move a visit to a new stage and record who did it. */
export function moveStage(id: string, stage: Stage, text: string, by: string, extra?: Partial<Visit>) {
  const now = new Date().toISOString();
  updateVisit(id, (v) => ({ ...v, ...extra, stage, stageSince: now, log: [...v.log, { at: now, text, by }] }));
}

export function resetDemo() {
  write(seedVisits());
}

export const nextVisitId = (visits: Visit[]) =>
  `V-${Math.max(3000, ...visits.map((v) => Number(v.id.slice(2)) || 0)) + 1}`;

export const nextMrn = () => `MRN-${Math.floor(500000 + Math.random() * 99999)}`;

// ---- helpers ----

export function age(dob: string, now = new Date()) {
  const d = new Date(dob);
  let a = now.getFullYear() - d.getFullYear();
  if (now < new Date(now.getFullYear(), d.getMonth(), d.getDate())) a--;
  return a;
}

export const minutesSince = (iso: string, now: number) => Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));

export const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

/** Abnormal-vital alerts shown to nurse and provider. Thresholds are demo defaults — set by clinical policy. */
export function vitalAlerts(v?: Vitals): string[] {
  if (!v) return [];
  const out: string[] = [];
  const [sys] = v.bp.split("/").map(Number);
  if (Number(v.temp) >= 38) out.push(`Fever ${v.temp}°C`);
  if (sys >= 180) out.push(`SBP ${sys}`);
  if (sys && sys < 90) out.push(`Hypotension ${sys}`);
  if (Number(v.hr) > 110) out.push(`HR ${v.hr}`);
  if (v.spo2 && Number(v.spo2) < 92) out.push(`SpO₂ ${v.spo2}%`);
  if (v.glucose && Number(v.glucose) < 70) out.push(`Glucose ${v.glucose} (low)`);
  if (Number(v.glucose) > 300) out.push(`Glucose ${v.glucose} (high)`);
  return out;
}

export const woundArea = (w: Wound) => {
  const a = Number(w.lengthCm) * Number(w.widthCm);
  return a > 0 ? a.toFixed(2) : "–";
};

/** ABI per leg = higher ankle pressure (DP/PT) ÷ higher brachial pressure. */
export function computeAbi(r: AbiResult) {
  const brachial = Math.max(Number(r.brachialL) || 0, Number(r.brachialR) || 0);
  const ankle = (a: string, b: string) => Math.max(Number(a) || 0, Number(b) || 0);
  const calc = (a: number) => (brachial > 0 && a > 0 ? a / brachial : undefined);
  const toe = (t: string) => (brachial > 0 && Number(t) > 0 ? Number(t) / brachial : undefined);
  return {
    left: calc(ankle(r.dpL, r.ptL)),
    right: calc(ankle(r.dpR, r.ptR)),
    tbiLeft: toe(r.toeL),
    tbiRight: toe(r.toeR),
  };
}

export function interpretAbi(abi?: number) {
  if (abi === undefined) return { label: "–", tone: "muted" as const };
  if (abi > 1.4) return { label: "Non-compressible", tone: "warn" as const };
  if (abi >= 1.0) return { label: "Normal", tone: "ok" as const };
  if (abi >= 0.91) return { label: "Borderline", tone: "warn" as const };
  if (abi >= 0.7) return { label: "Mild PAD", tone: "warn" as const };
  if (abi >= 0.4) return { label: "Moderate PAD", tone: "alert" as const };
  return { label: "Severe PAD", tone: "alert" as const };
}

/** Follow-up tasks generated at checkout from the provider's orders. */
export function checkoutTasks(v: Visit): { label: string; done: boolean }[] {
  const o = v.plan?.orders ?? [];
  const p = v.plan?.procedures ?? [];
  const t: string[] = [];
  if (o.includes("HBOT evaluation / series")) t.push(`Prior authorization: HBOT (${v.patient.payer})`);
  if (p.includes("Skin substitute application")) t.push(`Prior authorization: skin substitute (${v.patient.payer})`);
  if (o.includes("Angiography ± intervention")) t.push("Schedule angiography, send pre-procedure labs and instructions");
  if (o.includes("MRI foot")) t.push("Schedule MRI foot");
  if (o.includes("Arterial duplex")) t.push("Schedule arterial duplex");
  if (o.includes("Venous duplex")) t.push("Schedule venous duplex");
  if (p.includes("Total contact cast")) t.push("Book weekly cast change");
  if (o.includes("Custom footwear / offloading referral")) t.push("Send orthotics/pedorthist referral");
  if (v.patient.referralId) t.push(`Send consult summary to referring provider (${v.patient.referralId})`);
  t.push("Send visit note to primary care provider");
  return t.map((label) => ({ label, done: false }));
}

// ---- signed-in staff member (demo role switcher) ----

export const staffUsers = [
  { id: "desk", name: "K. Lee", role: "Front desk" },
  { id: "rn", name: "T. Brooks, RN", role: "Nurse" },
  { id: "md", name: "Dr. A. Rivera", role: "Provider" },
  { id: "tech", name: "P. Nguyen, RVT", role: "Vascular tech" },
] as const;
export type StaffUser = (typeof staffUsers)[number];

const STAFF_KEY = "prototype.staff.v1";
const STAFF_EVT = "staff-change";

function readStaff(): string {
  try {
    return localStorage.getItem(STAFF_KEY) ?? "desk";
  } catch {
    return "desk";
  }
}

function subscribeStaff(cb: () => void) {
  window.addEventListener(STAFF_EVT, cb);
  return () => window.removeEventListener(STAFF_EVT, cb);
}

export function useStaff(): StaffUser {
  const id = useSyncExternalStore(subscribeStaff, readStaff, () => "desk");
  return staffUsers.find((u) => u.id === id) ?? staffUsers[0];
}

export function setStaff(id: StaffUser["id"]) {
  try {
    localStorage.setItem(STAFF_KEY, id);
  } catch {
    // ignore: role resets to front desk on reload
  }
  window.dispatchEvent(new Event(STAFF_EVT));
}

export const by = (u: StaffUser) => `${u.role} · ${u.name}`;

/** Current time, re-rendering every 30 s so wait timers stay live. */
export function useNow(): number | null {
  return useSyncExternalStore(subscribeClock, getClock, () => null);
}
let clock = 0;
function getClock() {
  if (!clock) clock = Date.now();
  return clock;
}
function subscribeClock(cb: () => void) {
  const t = setInterval(() => {
    clock = Date.now();
    cb();
  }, 30_000);
  return () => clearInterval(t);
}
