// Demo staff directory and role-based, centre-scoped access (NFR security; REQ-RES-002).
// Production: identities and roles come from the hospital IdP (open decision #1).

import type { Centre } from "./data";

export type Cls = "consultant" | "trainee" | "nurse" | "custodian" | "research" | "frontdesk";

export type Staff = {
  id: string;
  name: string;
  role: string;
  cls: Cls;
  centres: Centre[];
  head?: boolean;
  /** Doctors: qualifications and State Medical Council registration (printed on prescriptions; demo numbers). */
  quals?: string; reg?: string;
};

export const STAFF: Staff[] = [
  { id: "fd", name: "Kavya R.", role: "Registration desk · front office", cls: "frontdesk", centres: ["CHN", "BLR"] },
  { id: "mk", name: "Dr. Meera Krishnan", role: "Consultant vascular surgeon · Head of service", cls: "consultant", centres: ["CHN", "BLR", "HYD"], head: true, quals: "MS, MCh (Vascular Surgery)", reg: "TNMC 64218 (demo)" },
  { id: "an", name: "Dr. Arun Nair", role: "Consultant vascular surgeon", cls: "consultant", centres: ["CHN", "BLR", "HYD"], quals: "MS, DNB (Vascular Surgery)", reg: "TCMC 51377 (demo)" },
  { id: "nb", name: "Dr. Neha Bose", role: "Senior house officer", cls: "trainee", centres: ["CHN", "BLR"], quals: "MBBS", reg: "TNMC 99802 (demo)" },
  { id: "rv", name: "Sr. Revathi S.", role: "OPD assessment nurse", cls: "nurse", centres: ["CHN", "BLR"] },
  { id: "ak", name: "Sr. Anandhi K.", role: "Senior staff nurse", cls: "nurse", centres: ["CHN"] },
  { id: "jm", name: "Sr. Josephine M.", role: "Nurse practitioner", cls: "nurse", centres: ["HYD"] },
  { id: "rs", name: "R. Subramanian", role: "Data custodian", cls: "custodian", centres: ["CHN", "BLR", "HYD"] },
  { id: "pm", name: "Dr. Priya Menon", role: "Clinical research monitor", cls: "research", centres: ["CHN", "BLR", "HYD"] },
  { id: "sh", name: "S. Hariharan", role: "Research fellow", cls: "research", centres: ["CHN", "BLR", "HYD"] },
];

export const staffById = (id: string) => STAFF.find((s) => s.id === id) ?? STAFF[0];

export type Screen =
  | "register" | "triage" | "consult" | "checkout" | "flow" | "admit" | "services" | "rdocs" | "overview" | "round" | "patient" | "visit" | "nurse" | "profile" | "signoff" | "wound"
  | "research" | "graph" | "audit" | "auto" | "arch" | "requirements";

const ALLOW: Record<Screen, Cls[] | "all"> = {
  register: ["frontdesk", "nurse", "consultant"],
  triage: ["nurse", "consultant", "trainee"],
  consult: ["consultant", "trainee"],
  checkout: ["frontdesk", "nurse", "consultant", "trainee"],
  flow: ["frontdesk", "nurse", "consultant", "trainee"],
  admit: ["frontdesk", "nurse", "consultant", "trainee"],
  services: ["nurse", "consultant", "trainee"],
  rdocs: ["consultant", "trainee", "research", "custodian"],
  overview: ["consultant"],
  round: ["consultant", "trainee", "nurse"],
  patient: ["consultant", "trainee", "nurse"],
  visit: ["consultant", "trainee"],
  nurse: ["consultant", "trainee", "nurse"],
  profile: ["consultant", "trainee", "nurse", "frontdesk"],
  signoff: "all",
  wound: ["consultant", "trainee", "nurse"],
  research: ["consultant", "research", "custodian"],
  graph: ["consultant", "research", "custodian"],
  audit: ["consultant", "custodian"],
  auto: "all",
  arch: "all",
  requirements: "all",
};

export function canSee(u: Staff, s: Screen) {
  const a = ALLOW[s];
  // Screens outside the demo role table (e.g. Users, gated by the log-in role) are not limited here.
  if (!a) return true;
  if (s === "overview" || s === "audit") return a === "all" || (a.includes(u.cls) && (u.head || u.cls === "custodian"));
  return a === "all" || a.includes(u.cls);
}

/** Clinical access needs a care relationship: a clinical role and the patient's centre in scope. */
export function careRelationship(u: Staff, centre: string) {
  return (u.cls === "consultant" || u.cls === "trainee" || u.cls === "nurse") && u.centres.includes(centre as Centre);
}

/** Which signature types a staff class may give. Separation of duties is checked separately. */
export const CAN_SIGN: Record<string, Cls[]> = {
  counter: ["consultant"],
  discharge: ["consultant"],
  merge: ["consultant"],
  author: ["consultant", "trainee", "nurse", "research", "custodian"],
  "nurse-obs": ["nurse"],
  custodian: ["custodian"],
  monitor: ["research"],
  abstract2: ["research", "consultant"],
  "author-ms": ["consultant", "research"],
};

/** Actions that must be given by someone other than the person who entered the record. */
export const SECOND_PERSON = new Set(["counter", "discharge", "merge", "custodian", "monitor", "abstract2"]);

export const LANDING: Record<Cls, string> = {
  consultant: "/clinical/round",
  trainee: "/clinical/round",
  nurse: "/clinical/triage",
  custodian: "/clinical/research",
  research: "/clinical/research",
  frontdesk: "/clinical/register",
};
