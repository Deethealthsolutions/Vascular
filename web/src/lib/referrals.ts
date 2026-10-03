// Referral types, mock data and a browser-only store for the prototype.
// Production: PostgreSQL + audited API (SPEC §5, §7.1). Never put real PHI here.

import { useMemo, useSyncExternalStore } from "react";

export const referralStatuses = ["received", "under_review", "needs_info", "scheduled", "seen", "summary_sent", "declined"] as const;
export type ReferralStatus = (typeof referralStatuses)[number];

export const statusLabel: Record<ReferralStatus, string> = {
  received: "Received",
  under_review: "Under review",
  needs_info: "Needs info",
  scheduled: "Scheduled",
  seen: "Seen",
  summary_sent: "Consult summary sent",
  declined: "Declined",
};

export const timelineSteps: ReferralStatus[] = ["received", "under_review", "scheduled", "seen", "summary_sent"];

export const referralReasons = [
  "Non-healing wound",
  "Diabetic foot ulcer",
  "PAD / CLTI evaluation",
  "HBOT evaluation",
  "Venous leg ulcer",
  "Osteomyelitis",
  "Post-amputation wound",
  "Radiation tissue injury",
] as const;

export type Urgency = "routine" | "urgent";

export type ReferralEvent = { status: ReferralStatus; at: string; note?: string };

export type Referral = {
  id: string;
  patientName: string;
  patientDob: string;
  reasons: string[];
  urgency: Urgency;
  woundLocation?: string;
  woundDurationWeeks?: number;
  wagnerGrade?: string;
  abiLeft?: string;
  abiRight?: string;
  infectionSigns?: boolean;
  notes?: string;
  attachments: string[];
  status: ReferralStatus;
  events: ReferralEvent[];
  appointment?: { when: string; location: string; clinician: string };
  consultSummary?: string;
};

export const mockReferrals: Referral[] = [
  {
    id: "R-10482",
    patientName: "Test Patient A",
    patientDob: "1958-03-14",
    reasons: ["Diabetic foot ulcer", "PAD / CLTI evaluation"],
    urgency: "urgent",
    woundLocation: "Right plantar 1st metatarsal head",
    woundDurationWeeks: 9,
    wagnerGrade: "2",
    abiLeft: "0.88",
    abiRight: "0.62",
    infectionSigns: false,
    attachments: ["wound_photo_0912.jpg", "abi_report.pdf"],
    status: "summary_sent",
    events: [
      { status: "received", at: "2026-09-08T09:12:00" },
      { status: "under_review", at: "2026-09-08T10:40:00", note: "Triaged by Dr. Rivera — urgent vascular + wound." },
      { status: "scheduled", at: "2026-09-08T14:05:00", note: "Booked Sep 10, 8:30am, Main Campus." },
      { status: "seen", at: "2026-09-10T09:30:00" },
      { status: "summary_sent", at: "2026-09-10T16:20:00" },
    ],
    appointment: { when: "2026-09-10T08:30:00", location: "Main Campus", clinician: "Dr. A. Rivera, MD" },
    consultSummary:
      "Assessment: Right plantar DFU, Wagner 2, 2.1 × 1.4 cm, no probe-to-bone. Right ABI 0.62, TBI 0.31 — significant inflow/tibial disease. Plan: 1) Right lower-extremity angiogram with possible intervention scheduled 9/15. 2) Sharp debridement performed; total contact cast applied. 3) Weekly wound clinic. 4) HbA1c 8.9% — recommend PCP optimize glycemic control. Will update after angiography.",
  },
  {
    id: "R-10497",
    patientName: "Test Patient B",
    patientDob: "1949-11-02",
    reasons: ["Radiation tissue injury", "HBOT evaluation"],
    urgency: "routine",
    woundLocation: "Left mandible — exposed bone post-extraction",
    woundDurationWeeks: 12,
    attachments: ["panorex.pdf"],
    status: "scheduled",
    events: [
      { status: "received", at: "2026-09-15T11:00:00" },
      { status: "under_review", at: "2026-09-16T08:15:00" },
      { status: "scheduled", at: "2026-09-16T13:30:00", note: "HBOT evaluation Sep 29, 10:00am." },
    ],
    appointment: { when: "2026-09-29T10:00:00", location: "Main Campus", clinician: "Dr. M. Chen, MD" },
  },
  {
    id: "R-10503",
    patientName: "Test Patient C",
    patientDob: "1967-06-21",
    reasons: ["Venous leg ulcer"],
    urgency: "routine",
    woundLocation: "Left medial malleolus",
    woundDurationWeeks: 16,
    attachments: [],
    status: "needs_info",
    events: [
      { status: "received", at: "2026-09-22T15:45:00" },
      { status: "needs_info", at: "2026-09-23T09:10:00", note: "Please send current medication list and any prior venous duplex results." },
    ],
  },
  {
    id: "R-10511",
    patientName: "Test Patient D",
    patientDob: "1972-01-30",
    reasons: ["Non-healing wound", "Osteomyelitis"],
    urgency: "urgent",
    woundLocation: "Left 2nd toe",
    woundDurationWeeks: 5,
    wagnerGrade: "3",
    infectionSigns: true,
    attachments: ["xray_foot.pdf"],
    status: "under_review",
    events: [
      { status: "received", at: "2026-09-24T17:20:00" },
      { status: "under_review", at: "2026-09-25T07:50:00" },
    ],
  },
];

const KEY = "prototype.referrals.v1";

function readRaw(): string {
  try {
    return localStorage.getItem(KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

function readLocal(): Referral[] {
  try {
    return JSON.parse(readRaw()) as Referral[];
  } catch {
    return [];
  }
}

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
}

/** All referrals (browser-saved + mock). `null` until hydrated on the client. */
export function useReferrals(): Referral[] | null {
  const raw = useSyncExternalStore(subscribe, readRaw, () => null);
  return useMemo(() => {
    if (raw === null) return null;
    try {
      return [...(JSON.parse(raw) as Referral[]), ...mockReferrals];
    } catch {
      return mockReferrals;
    }
  }, [raw]);
}

export function saveReferral(r: Omit<Referral, "id" | "status" | "events">): Referral {
  const referral: Referral = {
    ...r,
    id: `R-${Math.floor(20000 + Math.random() * 9000)}`,
    status: "received",
    events: [{ status: "received", at: new Date().toISOString() }],
  };
  try {
    localStorage.setItem(KEY, JSON.stringify([referral, ...readLocal()]));
  } catch {
    // Storage unavailable (private mode): the confirmation screen still shows the referral ID.
  }
  return referral;
}

export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
export const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
