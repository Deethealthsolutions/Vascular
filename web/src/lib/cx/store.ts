"use client";

// Browser-only state layered on top of the static fixtures, so every action in the
// prototype actually does something: observations save, signatures append to a ledger,
// merges and ADT events stick, and every read/write/deny lands in the audit log.
// Production: PostgreSQL behind the API gateway (SCHEMA.md). Never store real PHI here.

import { useSyncExternalStore } from "react";
import { SIGN } from "./data";

export type ObsEntry = {
  id: string; pid: string; at: string; by: string; mode: "direct" | "notepad-ocr";
  hr: number; pulse: number; sbp: number; dbp: number; spo2: number; o2: number; rr: number;
  temp: number; avpu: string; cbg: number; uo: number; news: number; three: boolean;
  synced: boolean; note?: string; algo?: string;
};

export type Pending = {
  id: string; kind: "clinical" | "research"; doc: string; docType: string;
  entered: string; enteredRole: string; at: string; need: string; needFrom: string;
  priority: "high" | "medium" | "low"; why: string;
  subject?: { type: "visit" | "obs" | "discharge" | "merge" | "extract" | "amend" | "fixture" | "consult"; ref: string };
  content?: string; version?: number; amendOf?: string; aiDraft?: string;
};

export type LedgerEntry = {
  id: string; at: string; kind: string; docType: string; doc: string; entered: string; enteredRole: string;
  centre: string; action: string; signer: string; attest: string; version: number; amended: boolean;
  hash: string; method: string; latencyMin: number; supersedes?: string;
};

export type VisitNote = {
  id: string; pid: string; by: string; at: string; status: "draft" | "submitted" | "signed" | "returned" | "superseded";
  mode: "typed" | "voice"; version: number; fields: Record<string, string>; meds: MedChange[];
};
export type MedChange = { drug: string; change: "start" | "stop" | "hold" | "dose"; detail: string; reason: string };

export type Merge = { id: string; a: string; b: string; decision: "merged" | "not-duplicate" | "unmerged"; by: string; at: string; signed: boolean };

export type Adt = { bed?: string; unit?: string; centre?: string; discharged?: { at: string; by: string }; history: { at: string; by: string; text: string }[] };

export type Attendance = { status: "arrived" | "seen" | "dna"; outcome?: string; followUp?: string; by: string; at: string };

export type AuditEntry = {
  at: string; user: string; action: "read" | "write" | "sign" | "deny" | "export" | "ai" | "return"; subject: string; detail: string;
};

export type ExtractReq = {
  id: string; study: string; requested: string; requestedBy: string; cohort: string; variables: string[];
  identifiability: string; images: boolean; status: "awaiting-approval" | "materialised" | "rejected"; released?: number; withheld?: number;
};

export type Registration = {
  id: string; epi: string; mrn: string; token: string; queue: string; queueLabel: string;
  priority: "emergency" | "priority" | "routine"; at: string; by: string; centre: string;
  returning: boolean; pid?: string; emergencyQuick: boolean;
  name: string; age: number; ageApprox: boolean; dob?: string; sex: string;
  phone: string; phoneVerified: boolean; language: string;
  area: string; city: string; state: string; pin: string;
  kin?: { name: string; rel: string; phone: string }; abha?: string; idSeen: string;
  arrival: string; referredBy?: string; visit: string; complaint: string; redFlags: string[];
  clinical: {
    diabetes: string; dmYears: string; insulin: boolean; ckd: boolean; dialysis: boolean; prevAmp: boolean;
    prevRevasc: boolean; anticoag: boolean; smoking: string; allergies: string; woundSite: string; woundWeeks: string; mobility: string;
  };
  scheme: string; schemeId: string;
  consent: { care: boolean; share: boolean; research: boolean; photo: string };
  status: "waiting for assessment" | "in assessment" | "ready for doctor" | "sent to emergency" | "left without being seen"
    | "with doctor" | "at tests" | "for procedure" | "to checkout" | "admitted"
    | "awaiting admission" | "checked out";
  bay?: string; calledAt?: string; triage?: TriageRecord;
  /** Queue position anchor: set when a no-show goes to the back of the queue. */
  requeuedAt?: string; recalls?: number;
  notes?: { at: string; by: string; text: string }[];
  history?: { at: string; by: string; text: string }[];
  /** Wound photographs taken at the initial nursing assessment (downscaled, EXIF stripped). */
  photos?: WoundPhoto[];
  /** In-progress assessment form, so a nurse can switch patients without losing entries. */
  draft?: Record<string, unknown>;
  /** Step 3: consultation room, doctor, in-progress note and the signed consultation. */
  room?: string; doctor?: string; seenAt?: string; testsAt?: string; backFromTests?: boolean;
  consultDraft?: Record<string, unknown>;
  consult?: ConsultRecord;
  /** Step 4A: checkout (appointment, documents, letter to the referrer, bill). */
  checkout?: CheckoutRecord;
  /** Step 4C: admission from the outpatient clinic to a ward bed. */
  admission?: AdmissionRecord;
  /** Step 4B: results entered at the vascular lab / imaging / lab desk, and the dressing-room / HBOT record. */
  results?: TestResult[];
  procedure?: ProcedureRecord;
};

export type TestResult = { order: string; dept: string; at: string; by: string; values: Record<string, string>; critical: string | null; informed?: string };

export type ProcedureRecord = {
  at: string; by: string;
  wounds: { wound: number; plan: string; applied: boolean; actual: string; painBefore: string; painAfter: string }[];
  checks: string[]; debridedBy?: string; education: string[];
  hbot: null | { indication: string; absolute: string[]; relative: string[]; checks: string[]; gates: { k: string; ok: boolean; why: string }[]; eligible: boolean; decision: string; plan?: { sessions: number; ata: string; minutes: number; start: string } };
};

export type AdmissionRecord = {
  at: string; by: string; ipNo: string; unit: string; bed: string; urgency: string; plannedDate?: string;
  indication: string; procedures: string[]; consultant: string; expectedDays: number; isolation: boolean; diet: string; risks: string[];
  payer: { scheme: string; kind: string; packages: string[]; estimate: number; preauth: { status: string; ref: string }; deposit: number; mode: string; note: string };
  documents: string[]; handover: string;
};

export type Appointment = { id: string; regId: string; name: string; mrn: string; date: string; time: string; clinic: string; doctor: string; at: string; by: string };

export type CheckoutRecord = {
  at: string; by: string;
  appointment: { date: string; time: string; clinic: string; doctor: string } | null; noFollowUpReason?: string;
  documents: string[]; homeCare: string[];
  letter: { to: string; via: string; text: string } | null;
  bill: { payer: string; items: { item: string; amount: number; covered: boolean }[]; total: number; payable: number; mode: string; receipt: string; note: string };
};

export type Rx = { drug: string; dose: string; route: string; freq: string; days: string };

export type FootExam = { vibration: string; reflex: string; deformity: string[]; callus: boolean; skin: string[] };
export type ConsultWound = {
  n: number; side: "right" | "left"; site: string; location: string; length: number; width: number; depth: number; area: number;
  tissue: { granulation: number; slough: number; necrotic: number; epithelial: number };
  undermining: number; tunnelling: number; exposed: string[]; probeBone: boolean; periwound: string[]; exudate: string; gangrene: string;
  infection: { local: string[]; deep: string[]; erythemaCm: number; grade: number; label: string };
  wagner: number; ut: string; photoIds: string[];
};

export type ConsultRecord = {
  at: string; by: string; byRole: string; room?: string;
  hpi: string; duration: string; symptoms: string[]; pmh: string[]; meds: string; allergies: string; hba1c: string;
  pulses: Record<"fem" | "pop" | "dp" | "pt", { r: string; l: string }>;
  abi: { r: number | null; l: number | null; tbiR: number | null; tbiL: number | null; notDone?: string };
  /** Single-wound fields from the first version of the consultation (kept so older records display). */
  woundExam?: { depth: string; gangrene: string; location: string } | null;
  wagner?: number | null; ut?: string | null;
  wifi?: { w: number; i: number | null; fi: number; stage: number | null; risk: string } | null;
  /** Round 1 additions: every wound, per-limb staging, foot exam, treatment, medicines, discussion and consent. */
  wounds?: ConsultWound[];
  limbs?: { side: "right" | "left"; w: number; i: number | null; fi: number; stage: number | null; risk: string }[];
  footExam?: { right: FootExam; left: FootExam; footwear: string; ulcerHistory: boolean; risk: { cat: number; label: string; interval: string } } | null;
  treatment?: {
    debridements: { wound: number; method: string; anaesthesia: string; removed: string[]; depthTo: string; haemostasis: string; tolerated: string }[];
    dressings: { wound: number; primary: string; secondary: string; freq: string; by: string }[];
    offload: string;
  };
  medRec?: { drug: string; dose: string; action: string; reason: string }[];
  egfr?: number | null; wbc?: number | null;
  antibiotic?: { indication: string; culture: string; duration: string; review: string } | null;
  bmt?: { label: string; met: boolean; reason?: string }[];
  discussion?: { present: string[]; interpreter: string; discussed: string[]; decision: string; goals: string; teachBack: boolean };
  consent?: { type: string; by: string; relName: string; risks: string[]; signed: boolean; witness: string } | null;
  diagnoses: { id: string; code: string; label: string; side: string }[];
  orders: string[]; rx: Rx[]; alerts: { text: string; level: "block" | "warn"; override?: string }[];
  plan: string; instructions: string[]; disposition: string; followUp: string;
  hash: string; countersign: "not needed" | "awaiting consultant" | string;
};

export type WoundPhoto = { id: string; at: string; by: string; site: string; dataUrl: string; w: number; h: number; kb: number; marker: boolean; source: "camera / upload"; note: string; woundRef?: string };

export type Limb = { dp: string; pt: string; colour: string; temp: string; sensation: string; swelling: boolean };

export type TriageRecord = {
  at: string; by: string; idChecked: boolean;
  vitals: { rr: number; spo2: number; o2: number; hr: number; sbp: number; dbp: number; pulse: number; temp: number; avpu: string; cbg: number | null; pain: number; weight: number | null; height: number | null };
  news: number; newsThree: boolean; algo: string;
  limbs: { right: Limb; left: Limb; crt: string; restPain: boolean; claudicationM: string };
  wound: null | { site: string; length: number; width: number; depth: number; area: number; bed: string; exudate: string; odour: boolean; erythemaCm: number; probeBone: boolean; photo: boolean; photoIds?: string[] };
  infection: "none" | "mild" | "moderate" | "severe"; flags: string[];
  category: "Emergency" | "Urgent" | "Standard" | "Routine"; suggested: string; overrideReason?: string;
  actions: string[]; note: string;
};

/** Update one registration and append to its history. */
export function updateReg(id: string, by: string, text: string, patch: Partial<Registration> = {}) {
  setState((s) => ({
    registrations: s.registrations.map((r) => (r.id === id
      ? { ...r, ...patch, history: [...(r.history ?? []), { at: new Date().toISOString(), by, text }] }
      : r)),
  }));
}

export type State = {
  user: string;
  obs: ObsEntry[];
  pending: Pending[];
  resolved: Record<string, { status: "signed" | "returned"; by: string; at: string; note?: string }>;
  ledger: LedgerEntry[];
  notes: VisitNote[];
  merges: Merge[];
  adt: Record<string, Adt>;
  attendance: Record<string, Attendance>;
  audit: AuditEntry[];
  extracts: ExtractReq[];
  registrations: Registration[];
  /** Photos added on the Wound & HBOT screen, keyed by wound ID. */
  woundPhotos: Record<string, WoundPhoto[]>;
  /** Clinic appointment book (follow-ups booked at checkout). */
  appointments: Appointment[];
  hydrated: boolean;
};

const KEY = "prototype.clinical.v1";

const initial: State = {
  user: "mk", obs: [], pending: [], resolved: {}, ledger: [], notes: [], merges: [], adt: {},
  attendance: {}, audit: [], extracts: [], registrations: [], woundPhotos: {}, appointments: [], hydrated: false,
};

let state: State = initial;
let loaded = false;
const listeners = new Set<() => void>();

/** "Triage" was renamed "Initial nursing assessment": map statuses and bay names saved before the rename. */
function migrate(s: State): State {
  const st: Record<string, Registration["status"]> = { "waiting for triage": "waiting for assessment", "in triage": "in assessment" };
  return { ...s, registrations: s.registrations.map((r) => ({ ...r, status: st[r.status] ?? r.status, bay: r.bay?.replace("Triage bay", "Assessment bay") })) };
}

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    state = migrate({ ...initial, ...(raw ? (JSON.parse(raw) as Partial<State>) : {}), hydrated: true });
  } catch {
    state = { ...initial, hydrated: true };
  }
}

function persist() {
  try {
    const { hydrated: _h, ...rest } = state;
    void _h;
    localStorage.setItem(KEY, JSON.stringify(rest));
    persistOk = true;
  } catch {
    // storage unavailable or full (photos are large): state lives for this tab only
    persistOk = false;
  }
}

let persistOk = true;
/** False when the last save to browser storage failed, e.g. quota exceeded by photos. */
export const storageOk = () => persistOk;

export function setState(fn: (s: State) => Partial<State>) {
  load();
  state = { ...state, ...fn(state) };
  persist();
  listeners.forEach((l) => l());
}

export const getState = () => {
  load();
  return state;
};

function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      loaded = false;
      load();
      l();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

/** Whole store. Server render and first hydration pass see the empty initial state. */
export function useStore(): State {
  return useSyncExternalStore(subscribe, getState, () => initial);
}

export function resetStore() {
  state = { ...initial, hydrated: true };
  persist();
  listeners.forEach((l) => l());
}

let seq = 0;
/** Unique within the browser even when several records are created in the same millisecond. */
export const uid = (p: string) => `${p}-${Date.now().toString(36).slice(-5)}${(seq++ % 1296).toString(36).padStart(2, "0")}${Math.floor(Math.random() * 36).toString(36)}`;
export const nowIso = () => new Date().toISOString().slice(0, 16);

export function audit(user: string, action: AuditEntry["action"], subject: string, detail: string) {
  setState((s) => ({ audit: [{ at: new Date().toISOString(), user, action, subject, detail }, ...s.audit].slice(0, 500) }));
}

/** SHA-256 of the signed content, truncated for display like the mockup ledger. */
export async function contentHash(payload: unknown): Promise<string> {
  const text = JSON.stringify(payload);
  try {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 10);
  } catch {
    let h = 0;
    for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
    return (h >>> 0).toString(16).padStart(10, "0").slice(0, 10);
  }
}

/** All pending items: fixture queue plus items created in this browser, minus anything resolved. */
export function openPending(s: State): Pending[] {
  const fixture = SIGN.pending.map((p) => ({ ...p, subject: { type: "fixture" as const, ref: p.id } })) as Pending[];
  return [...s.pending, ...fixture].filter((p) => !s.resolved[p.id]);
}

export function allLedger(s: State): LedgerEntry[] {
  return [...s.ledger, ...(SIGN.ledger as LedgerEntry[])];
}
