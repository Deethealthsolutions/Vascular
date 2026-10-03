// Step 4A (checkout): clinic sessions and slots, the demo tariff, payer rules and the letter
// to the referring doctor. Tariff and payer policy are demo values for the clinical and
// finance leads to replace (docs/PATIENT_JOURNEY.md, "Decisions for clinical sign-off").

import type { ConsultRecord, Registration } from "./store";

// ------------------------------------------------------------------ clinic sessions

export const CLINICS = [
  { id: "wound", name: "Wound clinic", days: [1, 3, 5], doctor: "Dr. Arun Nair", queue: /wound|dressing/i },
  { id: "dfoot", name: "Diabetic foot clinic", days: [2, 4, 6], doctor: "Dr. Meera Krishnan", queue: /diabetic/i },
  { id: "vascular", name: "Vascular OPD", days: [1, 2, 3, 4, 5, 6], doctor: "Dr. Meera Krishnan", queue: /vascular/i },
  { id: "hbot", name: "HBOT assessment clinic", days: [3, 5], doctor: "Dr. Arun Nair", queue: /hbot/i },
] as const;
export const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const SLOT_TIMES = Array.from({ length: 16 }, (_, i) => `${String(9 + Math.floor(i / 4)).padStart(2, "0")}:${String((i % 4) * 15).padStart(2, "0")}`);

export const FOLLOW_DAYS: Record<string, number> = { "3 days": 3, "1 week": 7, "2 weeks": 14, "4 weeks": 28, "After test results": 5 };

export const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const fmtDate = (s: string) => new Date(`${s}T00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

export function clinicFor(r: Registration) {
  return CLINICS.find((c) => c.queue.test(r.queueLabel)) ?? CLINICS[0];
}

/** The next dates this clinic runs, starting at the follow-up target. */
export function clinicDates(clinicId: string, from: Date, n = 6): string[] {
  const c = CLINICS.find((x) => x.id === clinicId) ?? CLINICS[0];
  const out: string[] = [];
  const d = new Date(from);
  for (let i = 0; out.length < n && i < 60; i++, d.setDate(d.getDate() + 1)) if ((c.days as readonly number[]).includes(d.getDay())) out.push(ymd(d));
  return out;
}

/** Demo availability: a stable pseudo-random ~40% of slots are already taken, plus real bookings. */
export function slotTaken(date: string, clinic: string, time: string, booked: { date: string; clinic: string; time: string }[]) {
  if (booked.some((b) => b.date === date && b.clinic === clinic && b.time === time)) return true;
  let h = 0;
  for (const ch of date + clinic + time) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % 10 < 4;
}

// ------------------------------------------------------------------ bill

export const TARIFF = {
  consultNew: 800, consultFollow: 500, abi: 600, debridement: 1500, dressing: 450, npwt: 3500,
  offload: { "Total contact cast": 4500, "Removable knee-high walker": 6000, "Removable ankle-high walker": 3200, "Forefoot offloading shoe": 1800, "Felted foam": 400, "Post-operative shoe": 1200, "Therapeutic footwear with insoles": 3800 } as Record<string, number>,
};

export const PAYMENT_MODES = ["UPI", "Cash", "Card", "Credit to payer (no payment today)", "Waived (scheme policy)"];

/** What each payer covers at an outpatient visit (demo policy). */
export function payerRule(scheme: string): { covers: (item: string) => boolean; note: string } {
  if (/PM-JAY|CMCHIS/i.test(scheme)) return {
    covers: (i) => /consultation|dressing|debridement|ABI/i.test(i),
    note: "PM-JAY and CMCHIS pay for hospital admissions, not outpatient visits. Hospital policy (demo): consultation, ABI, debridement and dressings are free for scheme beneficiaries; offloading devices are charged.",
  };
  if (/CGHS/i.test(scheme)) return { covers: () => true, note: "CGHS: billed to CGHS at CGHS rates (credit). The patient pays nothing today." };
  if (/ESI/i.test(scheme)) return { covers: () => true, note: "ESI: billed to ESIC against the referral (credit). Collect the ESI referral letter." };
  if (/insurance|corporate/i.test(scheme)) return { covers: (i) => /corporate/i.test(scheme) && !/offloading/i.test(i), note: /corporate/i.test(scheme) ? "Corporate panel: consultation and procedures billed to the company; devices self-pay." : "Private insurance rarely covers outpatient visits: the patient pays and claims later. Give an itemised bill and the visit summary." };
  return { covers: () => false, note: "Self-pay. Clinical services are exempt from GST." };
}

export function billItems(k: ConsultRecord, returning: boolean): { item: string; amount: number }[] {
  const items = [{ item: returning ? "Follow-up consultation" : "New patient consultation", amount: returning ? TARIFF.consultFollow : TARIFF.consultNew }];
  if (k.abi.r != null || k.abi.l != null) items.push({ item: "Bedside Doppler ABI", amount: TARIFF.abi });
  for (const d of k.treatment?.debridements ?? []) items.push({ item: `Sharp debridement — wound ${d.wound}`, amount: TARIFF.debridement });
  for (const d of k.treatment?.dressings ?? []) if (d.primary) items.push({ item: `${d.primary === "NPWT" ? "NPWT application" : "Dressing"} — wound ${d.wound}`, amount: d.primary === "NPWT" ? TARIFF.npwt : TARIFF.dressing });
  const off = k.treatment?.offload;
  if (off && TARIFF.offload[off]) items.push({ item: `Offloading device — ${off}`, amount: TARIFF.offload[off] });
  return items;
}

export const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

// ------------------------------------------------------------------ letter to the referring doctor

export function referralLetter(r: Registration, k: ConsultRecord, appt: { date: string; clinic: string } | null, to: string): string {
  const dx = k.diagnoses.map((d) => `${d.label}${d.side ? ` (${d.side})` : ""}`).join("; ") || "—";
  const wounds = (k.wounds ?? []).map((w) => `wound ${w.n}, ${w.side} ${w.site || w.location}: ${w.area} cm², IWGDF ${w.infection.grade}, Wagner ${w.wagner}`).join("; ");
  const limbs = (k.limbs ?? []).filter((l) => l.stage).map((l) => `${l.side} WIfI stage ${l.stage}`).join(", ");
  const rx = k.rx.map((x) => `${x.drug} ${x.dose} ${x.freq} × ${x.days}`).join("; ");
  const stopped = (k.medRec ?? []).filter((m) => m.action && m.action !== "Continue").map((m) => `${m.drug}: ${m.action.toLowerCase()}${m.reason ? ` (${m.reason})` : ""}`).join("; ");
  return [
    `Dear ${to || "Doctor"},`,
    ``,
    `Re: ${r.name}, ${r.age} ${r.sex}, MRN ${r.mrn}`,
    ``,
    `Thank you for referring ${r.name.split(" ")[0]}, seen today in our ${r.queueLabel} by ${k.by}.`,
    ``,
    `Diagnosis: ${dx}.`,
    `Findings: ABI right ${k.abi.r ?? "—"}, left ${k.abi.l ?? "—"}${limbs ? `; ${limbs}` : ""}${wounds ? `; ${wounds}` : ""}.`,
    k.treatment?.debridements.length ? `Treatment today: debridement of wound ${k.treatment.debridements.map((d) => d.wound).join(", ")}; ${k.treatment.dressings.map((d) => `${d.primary} ${d.freq.toLowerCase()}`).join(", ")}${k.treatment.offload ? `; ${k.treatment.offload.toLowerCase()}` : ""}.` : null,
    rx ? `New medicines: ${rx}.` : null,
    stopped ? `Medicine changes: ${stopped}.` : null,
    k.orders.length ? `Investigations requested: ${k.orders.join(", ")}.` : null,
    `Plan: ${k.plan}`,
    appt ? `Next review: ${fmtDate(appt.date)}, ${appt.clinic}.` : null,
    ``,
    `Please continue the patient's other medicines and contact us if the foot becomes red, swollen, cold or more painful.`,
    ``,
    `Yours sincerely,`,
    `${k.by}`,
  ].filter((x) => x !== null).join("\n");
}
