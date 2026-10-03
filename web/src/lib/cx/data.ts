// Clinical workspace fixtures and pure helpers. Fixtures are the synthetic data
// embedded in Hospital_Vascular_UI_Mockup.html, extracted to src/data/*.json.
// Nothing here is real patient data.

import CLIN_ from "@/data/clin.json";
import NET_ from "@/data/net.json";
import WOUNDS_ from "@/data/wounds.json";
import RES_ from "@/data/res.json";
import GRAPH_ from "@/data/graph.json";
import PROF_ from "@/data/prof.json";
import OPD_ from "@/data/opd.json";
import SIGN_ from "@/data/sign.json";
import RULES_ from "@/data/rules.json";
import CATS_ from "@/data/cats.json";

export const CLIN = CLIN_;
export const NET = NET_;
export const WOUNDS = WOUNDS_;
export const RES = RES_;
export const GRAPH = GRAPH_;
export const PROF = PROF_;
export const OPD = OPD_;
export const SIGN = SIGN_;
export const RULES = RULES_;
export const CATS = CATS_ as [string, string, string][];

export type Patient = (typeof CLIN.patients)[number];
export type Vitals = Patient["v"];
export type RosterRow = (typeof NET.roster)[number];
export type Site = (typeof NET.sites)[number];
export type Profile = (typeof PROF.profiles)[number];
export type Centre = "CHN" | "BLR" | "HYD";

export const CENTRES: Centre[] = ["CHN", "BLR", "HYD"];
export const SITENAME: Record<string, string> = { CHN: "Chennai", BLR: "Bengaluru", HYD: "Hyderabad" };
export const SITEC: Record<string, string> = { CHN: "#0b6bcb", BLR: "#0d9488", HYD: "#b57314" };
export const ACU: Record<string, [string, string]> = {
  critical: ["r", "Critical"], deteriorating: ["o", "Deteriorating"],
  watch: ["a", "Watch"], stable: ["n", "Stable"], improving: ["g", "Improving"],
};

export const n1 = (v: number) => (Math.round(v * 10) / 10).toFixed(1);
export const pc = (v: number) => Math.round(v) + "%";
export const pat = (id: string) => CLIN.patients.find((p) => p.id === id);
export const profileOf = (id: string) => PROF.profiles.find((p) => p.pid === id);

export function newsClass(n: number) {
  return n >= 7 ? "s4" : n >= 5 ? "s3" : n >= 3 ? "s2" : n >= 1 ? "s1" : "s0";
}
export function newsBand(n: number): [string, string] {
  return n >= 7 ? ["high", "Emergency — critical care team"]
    : n >= 5 ? ["medium", "Urgent — clinician within 1 hour"]
      : n >= 1 ? ["low", "Nurse review, 4-6 hourly obs"]
        : ["routine", "Routine — 12 hourly obs"];
}

export type Obs = { rr: number; spo2: number; o2: number; sbp: number; pulse: number; temp: number; avpu: string };

/** NEWS2 (RCP 2017), SpO2 Scale 1. Mirrors the mockup exactly. */
export function news2(o: Obs) {
  const p: Record<string, number> = {};
  p.rr = o.rr <= 8 ? 3 : o.rr <= 11 ? 1 : o.rr <= 20 ? 0 : o.rr <= 24 ? 2 : 3;
  p.spo2 = o.spo2 <= 91 ? 3 : o.spo2 <= 93 ? 2 : o.spo2 <= 95 ? 1 : 0;
  p.o2 = o.o2 ? 2 : 0;
  p.sbp = o.sbp <= 90 ? 3 : o.sbp <= 100 ? 2 : o.sbp <= 110 ? 1 : o.sbp <= 219 ? 0 : 3;
  p.pulse = o.pulse <= 40 ? 3 : o.pulse <= 50 ? 1 : o.pulse <= 90 ? 0 : o.pulse <= 110 ? 1 : o.pulse <= 130 ? 2 : 3;
  p.avpu = o.avpu === "A" ? 0 : 3;
  p.temp = o.temp <= 35 ? 3 : o.temp <= 36 ? 1 : o.temp <= 38 ? 0 : o.temp <= 39 ? 1 : 2;
  const total = Object.values(p).reduce((a, b) => a + b, 0);
  return { total, p, three: Object.values(p).some((v) => v === 3) };
}

export function hoursAgo(h: number) {
  const d = CLIN.hours - 1 - h;
  return d === 0 ? "now" : d < 24 ? d + "h ago" : Math.floor(d / 24) + "d " + (d % 24) + "h ago";
}

// ---------------------------------------------------------- network rollups
type Series = Site["series"];
export type Agg = ReturnType<typeof winAgg>;

export function winAgg(site: { beds: number; series: Series }, days: number) {
  const rs = site.series.slice(-days);
  const S = (k: keyof Series[number]) => rs.reduce((a, r) => a + (r[k] as number), 0);
  const rev = S("revasc"), amp = S("majorAmp"), sep = S("sepsis"), obs = S("obsTotal"), pd = S("census");
  return {
    days, beds: site.beds,
    census: S("census") / Math.max(1, rs.length), occ: (100 * S("census")) / Math.max(1, rs.length) / site.beds,
    adm: S("adm"), dis: S("dis"), angio: S("angio"), bypass: S("bypass"), debride: S("debride"),
    minorAmp: S("minorAmp"), majorAmp: amp, revasc: rev,
    ampRate: (100 * amp) / Math.max(1, amp + rev), salvage: (100 * rev) / Math.max(1, amp + rev),
    sepsis: sep, bundleMet: S("bundleMet"), bundlePct: (100 * S("bundleMet")) / Math.max(1, sep),
    aki: S("akiNew"), cin: S("cin"), hypo: S("hypo"), sevHypo: S("sevHypo"),
    hypoRate: (100 * S("hypo")) / Math.max(1, pd), esc: S("esc"),
    obsTotal: obs, obsDigital: S("obsDigital"), digitalPct: (100 * S("obsDigital")) / Math.max(1, obs),
    ack: rs.reduce((a, r) => a + r.ack, 0) / Math.max(1, rs.length), patientDays: pd,
  };
}

export function netAgg(sites: { beds: number; series: Series }[], days: number): Agg {
  const ws = sites.map((s) => winAgg(s, days));
  const sum = (k: keyof Agg) => ws.reduce((a, w) => a + (w[k] as number), 0);
  const o = {
    days, beds: sites.reduce((a, s) => a + s.beds, 0),
    adm: sum("adm"), dis: sum("dis"), angio: sum("angio"), bypass: sum("bypass"), debride: sum("debride"),
    minorAmp: sum("minorAmp"), majorAmp: sum("majorAmp"), revasc: sum("revasc"), sepsis: sum("sepsis"),
    bundleMet: sum("bundleMet"), aki: sum("aki"), cin: sum("cin"), hypo: sum("hypo"), sevHypo: sum("sevHypo"),
    esc: sum("esc"), obsTotal: sum("obsTotal"), obsDigital: sum("obsDigital"), patientDays: sum("patientDays"),
  };
  return {
    ...o,
    census: o.patientDays / Math.max(1, days),
    occ: (100 * o.patientDays) / Math.max(1, days) / Math.max(1, o.beds),
    ampRate: (100 * o.majorAmp) / Math.max(1, o.majorAmp + o.revasc),
    salvage: (100 * o.revasc) / Math.max(1, o.majorAmp + o.revasc),
    bundlePct: (100 * o.bundleMet) / Math.max(1, o.sepsis),
    digitalPct: (100 * o.obsDigital) / Math.max(1, o.obsTotal),
    hypoRate: (100 * o.hypo) / Math.max(1, o.patientDays),
    ack: ws.reduce((a, w) => a + w.ack * w.patientDays, 0) / Math.max(1, o.patientDays),
  };
}

// ------------------------------------------------------------------ alerts
export type Alert = { sev: "r" | "o" | "a" | "g"; short: string; rule: string; t: string; d: string };

/** Alerts raised by the rule engine for a patient. `latestNews` overrides the fixture value when a new obs was entered. */
export function alertsFor(p: Patient, latestNews?: number): Alert[] {
  const a: Alert[] = [];
  const n = latestNews ?? p.v.news2[71];
  const L = p.labs[3], L0 = p.labs[0];
  if (n >= 7) a.push({ sev: "r", short: "NEWS2 " + n, rule: "A01", t: `NEWS2 ${n} — high band`, d: newsBand(n)[1] });
  else if (n >= 5) a.push({ sev: "o", short: "NEWS2 " + n, rule: "A01", t: `NEWS2 ${n} — medium band`, d: newsBand(n)[1] });
  if (p.aki >= 1) {
    a.push({
      sev: p.aki >= 2 ? "r" : "a", short: "AKI " + p.aki, rule: "A02", t: "KDIGO AKI stage " + p.aki,
      d: `Creatinine ${L0.creat} → ${L.creat} mg/dL against a baseline of ${p.baselineCreat}. eGFR ${L.egfr}. Urine output ${p.uo6} mL/kg/h over 6 hours.` +
        (p.aki >= 2 ? " Nephrology referral prompted." : ""),
    });
  }
  if (p.sevHypoCount) {
    a.push({ sev: "r", short: "Severe hypo", rule: "A03", t: `${p.sevHypoCount}h below 54 mg/dL in the last 72 hours`,
      d: `Lowest recorded ${p.cbgMin} mg/dL. ${p.hypoCount} hours below 70. Insulin regimen review required.` });
  } else if (p.hypoCount) {
    a.push({ sev: "a", short: "Hypo x" + p.hypoCount, rule: "A03", t: `${p.hypoCount} hypoglycaemic hours`, d: `Lowest ${p.cbgMin} mg/dL.` });
  }
  if (L.lactate >= 4) a.push({ sev: "r", short: "Lactate " + L.lactate, rule: "A05", t: `Critical lactate ${L.lactate} mmol/L`, d: "Panic threshold is 4.0. Owner paged." });
  if (L.k >= 5.3) a.push({ sev: "a", short: "K+ " + L.k, rule: "A05", t: `Potassium ${L.k} mmol/L`, d: "Rising with falling eGFR. Recheck and review potassium-sparing agents." });
  if (n >= 5 && /cellulitis|gangrene|infection/i.test(p.dx)) {
    a.push({ sev: "r", short: "Sepsis bundle", rule: "A04", t: "Sepsis screen positive — bundle clock running",
      d: `NEWS2 ${n} with a documented infection source. Lactate ${L.lactate}, WBC ${L.wbc}.` });
  }
  p.meds.forEach((m) => {
    if (m.status !== "active") {
      a.push({ sev: "a", short: m.drug.split(" ")[0] + " " + m.status.split(" ")[0], rule: /contrast/i.test(m.status) ? "A08" : "A10",
        t: `${m.drug} — ${m.status}`, d: "Auto-flagged by medication safety rules." });
    }
  });
  if (/angiograph|contrast/i.test(p.sub) && L.egfr < 60) {
    a.push({ sev: "o", short: "CIN risk", rule: "A08", t: "Contrast nephropathy prevention bundle due",
      d: `eGFR ${L.egfr} with diabetes and a contrast study booked. Hydration, metformin hold and ACE-inhibitor review required before the patient goes down.` });
  }
  if (p.acuity === "improving" && p.tir >= 85) {
    a.push({ sev: "g", short: "Step-down", rule: "A23", t: "Meets step-down criteria",
      d: `NEWS2 stable, glucose time-in-range ${p.tir}%, wound improving, no outstanding referrals.` });
  }
  return a;
}

// --------------------------------------------------------------- channels
export type Channel = {
  k: keyof Vitals | "creat"; name: string; shortName: string; unit: string; c: string;
  lo: number | null; hi: number | null; crit: number | null; fmt: 0 | 1; inv?: boolean; norm: string;
};

export const CHANNELS: Channel[] = [
  { k: "hr", name: "Heart rate", shortName: "HR", unit: "bpm", c: "#c32b45", lo: 51, hi: 90, crit: 131, fmt: 0,
    norm: "NEWS2 scores 0 for 51–90 bpm; 3 points at ≥131." },
  { k: "sbp", name: "Systolic blood pressure", shortName: "BP", unit: "mmHg", c: "#0b6bcb", lo: 111, hi: 219, crit: 90, fmt: 0, inv: true,
    norm: "NEWS2 scores 3 at ≤90 mmHg. Below 90 with a rising lactate is shock until proven otherwise." },
  { k: "spo2", name: "Oxygen saturation", shortName: "SpO₂", unit: "%", c: "#0d9488", lo: 96, hi: 100, crit: 92, fmt: 0, inv: true,
    norm: "Target 96–100% on the Scale 1 chart. 3 points at ≤91%." },
  { k: "cbg", name: "Capillary blood glucose", shortName: "Glucose", unit: "mg/dL", c: "#6d4aff", lo: 70, hi: 180, crit: 54, fmt: 0, inv: true,
    norm: "Time in range is 70–180 mg/dL. Level 2 hypoglycaemia is <54 and is a reportable event." },
  { k: "temp", name: "Temperature", shortName: "Temp", unit: "°C", c: "#d2541a", lo: 36.1, hi: 38.0, crit: 39.1, fmt: 1,
    norm: "NEWS2 scores 0 for 36.1–38.0°C." },
  { k: "rr", name: "Respiratory rate", shortName: "RR", unit: "/min", c: "#b57314", lo: 12, hi: 20, crit: 25, fmt: 0,
    norm: "The most sensitive single deterioration sign and the most often estimated rather than counted." },
  { k: "uo", name: "Urine output", shortName: "Urine", unit: "mL/h", c: "#0b6bcb", lo: null, hi: null, crit: null, fmt: 0,
    norm: "KDIGO oliguria is <0.5 mL/kg/h for 6 hours or more." },
  { k: "news2", name: "NEWS2", shortName: "NEWS2", unit: "points", c: "#10151c", lo: 0, hi: 4, crit: 7, fmt: 0,
    norm: "5 triggers urgent review, 7 triggers the critical care team." },
  { k: "creat", name: "Serum creatinine", shortName: "Creatinine", unit: "mg/dL", c: "#7c3aed", lo: 0.6, hi: 1.3, crit: null, fmt: 1,
    norm: "Four laboratory draws over 72 hours, plotted at their draw time. KDIGO stages by rise against the rolling 7-day baseline." },
];

export const SO_DOC: Record<string, [string, string]> = {
  visit: ["v", "Visit"], obs: ["b", "Observation"], discharge: ["o", "Discharge"], wound: ["n", "Wound"],
  hbot: ["n", "HBOT"], crf: ["v", "CRF"], abstraction: ["n", "Abstraction"], extract: ["b", "Extract"],
  manuscript: ["v", "Manuscript"], merge: ["r", "Patient merge"],
};
