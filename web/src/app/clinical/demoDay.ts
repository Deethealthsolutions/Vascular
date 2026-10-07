// Demo day: a full, realistic clinic day at all four locations, so every patient-journey screen
// has patients for a demo without pressing "Load demo …" buttons first.
//
// Built from the per-screen demo generators, then re-dated to "today", renamed per location (no
// duplicate patients across clinics), re-tokened per queue and given a history trail so the flow
// board's stage waits look real. One or two patients are deliberately over their stage limit so
// "Needs attention" has something to show.
//
// The store (lib/cx/store.ts) calls this the first time a browser opens the workspace, and again
// each new day (demo records have IDs starting "DEMO-" and are replaced; anything staff entered
// is kept). Sidebar → "Reset to demo day" rebuilds it on demand.

import { demoArrivals } from "./triage/Triage";
import { demoAssessed } from "./consult/Consult";
import { demoConsulted } from "./checkout/Checkout";
import { demoForAdmission } from "./admit/Admit";
import { demoAtTests, demoForProcedure } from "./services/Services";
import { occupancy, UNITS } from "@/lib/cx/admit";
import { clinicDates, clinicFor, FOLLOW_DAYS, SLOT_TIMES } from "@/lib/cx/checkout";
import { LOCATIONS } from "@/lib/cx/locations";
import { setDemoSeeder, type Appointment, type AuditEntry, type Registration, type State } from "@/lib/cx/store";

type Plan = { wait: number; assess: number; ready: number; doctor: number; tests: number; proc: number; checkout: number; bed: number; done: number; admitted: number; lwbs: number };

const PLAN: Record<string, Plan> = {
  "CHN-GR": { wait: 4, assess: 1, ready: 3, doctor: 1, tests: 2, proc: 2, checkout: 3, bed: 2, done: 4, admitted: 1, lwbs: 1 },
  "BLR-HSR": { wait: 2, assess: 1, ready: 2, doctor: 1, tests: 1, proc: 1, checkout: 2, bed: 1, done: 3, admitted: 1, lwbs: 0 },
  "BLR-RJN": { wait: 2, assess: 0, ready: 1, doctor: 1, tests: 1, proc: 1, checkout: 1, bed: 1, done: 2, admitted: 0, lwbs: 1 },
  "MYS-1": { wait: 1, assess: 1, ready: 1, doctor: 0, tests: 0, proc: 1, checkout: 1, bed: 0, done: 2, admitted: 1, lwbs: 0 },
};

const PLACE: Record<string, { city: string; state: string; pin: string; areas: string[]; langs: string[]; male: string[]; female: string[] }> = {
  "CHN-GR": {
    city: "Chennai", state: "Tamil Nadu", pin: "600006", areas: ["Mylapore", "T. Nagar", "Anna Nagar", "Adyar", "Royapettah", "Kodambakkam"], langs: ["Tamil", "Tamil", "Telugu", "English"],
    male: ["Ganesan Murthy", "Rajkumar Selvam", "Senthil Nathan", "Prakash Babu", "Arumugam Velu", "Dinesh Kumar", "Ramesh Chandran", "Balaji Srinivasan",
      "Kannan Iyer", "Mohammed Ismail", "Saravanan Pandian", "Thomas Varghese", "Murali Raman", "Sekar Natarajan", "Gopal Krishnan", "Anbu Selvan"],
    female: ["Kamala Devi", "Vasantha Kumari", "Padma Natarajan", "Shanthi Mohan", "Jayalakshmi Raman", "Fathima Begum", "Saroja Ammal", "Usha Rani",
      "Malathi Sekar", "Indira Gopal", "Rani Thomas", "Lalitha Iyer"],
  },
  "BLR-HSR": {
    city: "Bengaluru", state: "Karnataka", pin: "560102", areas: ["HSR Layout", "Koramangala", "BTM Layout", "Bellandur", "Sarjapur Road"], langs: ["Kannada", "Hindi", "Telugu", "English"],
    male: ["Manjunath Gowda", "Ravi Shankar", "Nagaraj Hegde", "Basavaraj Patil", "Suresh Shetty", "Imran Pasha", "Anand Kulkarni", "Harish Reddy", "Chandrashekar Rao", "Vinod Naik"],
    female: ["Shobha Rani", "Geetha Reddy", "Sumitra Bai", "Nirmala Hegde", "Asha Kulkarni", "Pushpa Latha", "Rukmini Rao", "Kavitha Shetty"],
  },
  "BLR-RJN": {
    city: "Bengaluru", state: "Karnataka", pin: "560010", areas: ["Rajajinagar", "Malleshwaram", "Basaveshwaranagar", "Vijayanagar", "Yeshwanthpur"], langs: ["Kannada", "Kannada", "Tamil", "Hindi"],
    male: ["Ramaiah Gowda", "Lokesh Kumar", "Girish Bhat", "Shivanna Swamy", "Mahesh Prasad", "Yogesh Murthy", "Krishnappa N.", "Ashok Rao"],
    female: ["Lakshmamma Gowda", "Sharada Bhat", "Vijaya Kumari", "Leela Prasad", "Meena Murthy", "Sunanda Rao"],
  },
  "MYS-1": {
    city: "Mysuru", state: "Karnataka", pin: "570001", areas: ["Kuvempunagar", "Vijayanagar", "Saraswathipuram", "Hebbal", "Nazarbad"], langs: ["Kannada", "Kannada", "English"],
    male: ["Mahadevappa M.", "Siddaraju S.", "Puttaswamy Gowda", "Nanjundaiah K.", "Shivakumar Urs", "Lingaraju B."],
    female: ["Gowramma S.", "Chikkamma M.", "Savitha Urs", "Kempamma K.", "Jayamma Gowda"],
  },
};

const NURSE = "Sr. Revathi S.", DESK = "Kavya R.";
const DOCTORS = ["Dr. Meera Krishnan", "Dr. Arun Nair"];

function build(): { registrations: Registration[]; appointments: Appointment[]; audit: AuditEntry[] } {
  const now = Date.now();
  const ago = (m: number) => new Date(now - m * 60000).toISOString();
  const regs: Registration[] = [];
  const appts: Appointment[] = [];

  LOCATIONS.forEach((loc, li) => {
    const p = PLAN[loc.id], place = PLACE[loc.id];
    const c = loc.centre;
    const tpl = {
      arr: demoArrivals(c, DESK), ass: demoAssessed(c), tests: demoAtTests(c), proc: demoForProcedure(c),
      con: demoConsulted(c), adm: demoForAdmission(c),
    };
    const take = <T,>(pool: T[], i: number) => pool[i % pool.length];
    let n = 0, mi = 0, fi = 0;
    const tokens: Record<string, number> = {};

    // Common re-identification: name, address, numbers, location; history trail; times.
    const person = (r: Registration, arriveAgo: number, extra: Partial<Registration>, trail: [number, string, string][]): Registration => {
      const female = /^f/i.test(r.sex);
      const name = female ? place.female[fi++ % place.female.length] : place.male[mi++ % place.male.length];
      const k = n++;
      const q = r.queue;
      tokens[q] = (tokens[q] ?? 0) + 1;
      const at = ago(arriveAgo);
      return {
        ...r, ...extra,
        id: `DEMO-${loc.abbr}-${String(k + 1).padStart(2, "0")}`,
        name, age: Math.max(38, Math.min(86, r.age + ((k * 7) % 9) - 4)),
        epi: `EPI-${loc.abbr}-${String(4100 + k)}`, mrn: `${c}-${loc.abbr}${String(52000 + li * 1000 + k * 37)}`,
        token: `${q}-${String(tokens[q]).padStart(2, "0")}`,
        phone: `9${String(8000 + li * 300 + k * 41).padStart(4, "0")} ${String(10000 + k * 1237).slice(-5)}`,
        language: place.langs[k % place.langs.length], area: place.areas[k % place.areas.length], city: place.city, state: place.state, pin: place.pin,
        centre: c, location: loc.id, at,
        history: [{ at, by: DESK, text: `Registered · ${r.queueLabel}` }, ...trail.map(([m, by, text]) => ({ at: ago(m), by, text }))],
      };
    };

    // Finished visits first (earliest arrivals), then the people still in the building.
    for (let i = 0; i < p.done; i++) {
      const t = take(tpl.con, i + li), arr = 245 - i * 22, seen = arr - 32, done = arr - 95;
      const r = person(t, arr, { status: "checked out", seenAt: ago(seen), doctor: t.consult!.by, consult: { ...t.consult!, at: ago(done + 12) } },
        [[arr - 18, NURSE, "Initial nursing assessment complete"], [seen, t.consult!.by, "Seen by doctor"], [done + 12, t.consult!.by, "Consultation signed · to checkout"]]);
      const clinic = clinicFor(r);
      const days = FOLLOW_DAYS[r.consult?.followUp ?? "1 week"] ?? 7;
      const date = clinicDates(clinic.id, new Date(now + days * 864e5), 1)[0];
      const time = SLOT_TIMES[(li * 5 + i * 3) % SLOT_TIMES.length];
      const fee = 800 + (i % 3) * 350, covered = /PM-JAY|CMCHIS|CGHS/.test(r.scheme);
      const receipt = `RCPT-${c}-DEMO-${loc.abbr}${i + 1}`;
      r.checkout = {
        at: ago(done), by: DESK, appointment: { date, time, clinic: clinic.name, doctor: clinic.doctor },
        documents: ["Visit summary (printed)", "Prescription"], homeCare: r.consult?.treatment?.offload ? [`${r.consult.treatment.offload} fitted and checked`] : [],
        letter: r.referredBy ? { to: r.referredBy, via: "WhatsApp (PDF)", text: `Seen today in ${clinic.name}. Plan: ${r.consult?.plan ?? ""}` } : null,
        bill: { payer: r.scheme, items: [{ item: "Consultation", amount: fee, covered }, { item: "Dressing", amount: 450, covered }], total: fee + 450, payable: covered ? 0 : fee + 450, mode: covered ? "Scheme" : "UPI", receipt, note: "" },
      };
      r.history!.push({ at: ago(done), by: DESK, text: `Checked out · next ${date} ${time} ${clinic.name} · ${receipt}` });
      appts.push({ id: `DEMO-APT-${loc.abbr}${i + 1}`, regId: r.id, name: r.name, mrn: r.mrn, date, time, clinic: clinic.name, doctor: clinic.doctor, at: ago(done), by: DESK });
      regs.push(r);
    }

    for (let i = 0; i < p.admitted; i++) {
      const t = take(tpl.adm, i + li), arr = 225, cons = 165, adm = 120;
      const r = person(t, arr, { status: "admitted", seenAt: ago(arr - 30), consult: { ...t.consult!, at: ago(cons) } },
        [[arr - 20, NURSE, "Initial nursing assessment complete"], [cons, t.consult!.by, "Consultation signed · admission requested"]]);
      const unit = UNITS[0];
      const taken = occupancy({ adt: {}, registrations: regs }, loc.id);
      const bed = unit.beds.find((b) => !taken[b] && !(unit.side as readonly string[]).includes(b))!;
      const ipNo = `IP-${c}-${new Date(now).getFullYear().toString().slice(2)}-D${li}${i}${String(n).padStart(3, "0")}`;
      r.admission = {
        at: ago(adm), by: DESK, ipNo, unit: unit.name, bed, urgency: "Urgent — today", indication: r.consult?.plan ?? "", procedures: ["Angiography ± angioplasty", "IV antibiotics"],
        consultant: r.consult!.by, expectedDays: 4, isolation: false, diet: "Diabetic", risks: ["Falls", "Pressure injury"],
        payer: { scheme: r.scheme, kind: "scheme", packages: [], estimate: 68000, preauth: { status: "Approved", ref: `PA-DEMO-${loc.abbr}` }, deposit: 0, mode: "", note: "" },
        documents: ["General consent for admission signed", "IP wristband"], handover: "Admitted from OPD for workup and procedure; observations 4-hourly, CBG before meals.",
      };
      r.history!.push({ at: ago(adm), by: DESK, text: `Admitted to ${bed} (${unit.name}) · ${ipNo}` });
      regs.push(r);
    }

    for (let i = 0; i < p.lwbs; i++) {
      const t = take(tpl.arr, i + 2);
      regs.push(person(t, 150, { status: "left without being seen" }, [[95, DESK, "Left without being seen — not answering when called (3 calls)"]]));
    }

    for (let i = 0; i < p.bed; i++) {
      const t = take(tpl.adm, i + li + 1), arr = [168, 140][i] ?? 130, cons = [72, 46][i] ?? 40;
      regs.push(person(t, arr, { seenAt: ago(arr - 35), consult: { ...t.consult!, at: ago(cons) } },
        [[arr - 22, NURSE, "Initial nursing assessment complete"], [cons, t.consult!.by, "Consultation signed · admission requested"]]));
    }

    for (let i = 0; i < p.checkout; i++) {
      const t = take(tpl.con, i + li + 1), arr = [116, 94, 81][i] ?? 75, cons = [9, 6, 3][i] ?? 4;
      regs.push(person(t, arr, { seenAt: ago(arr - 40), consult: { ...t.consult!, at: ago(cons) } },
        [[arr - 20, NURSE, "Initial nursing assessment complete"], [arr - 40, t.consult!.by, "Seen by doctor"], [cons, t.consult!.by, "Consultation signed · to checkout"]]));
    }

    for (let i = 0; i < p.proc; i++) {
      const t = take(tpl.proc, i + li), arr = [104, 88][i] ?? 80, cons = [26, 14][i] ?? 12;
      regs.push(person(t, arr, { seenAt: ago(arr - 38), consult: { ...t.consult!, at: ago(cons) } },
        [[arr - 20, NURSE, "Initial nursing assessment complete"], [cons, t.consult!.by, "Consultation signed · to dressing room"]]));
    }

    for (let i = 0; i < p.tests; i++) {
      const t = take(tpl.tests, i + li), arr = [122, 97][i] ?? 90, seen = arr - 36, sent = [seen - 12, 48][i] ?? 40;
      // The first Greams Road patient has waited at tests longer than the warning limit.
      const testsAt = loc.id === "CHN-GR" && i === 0 ? 74 : sent;
      regs.push(person(t, arr, { seenAt: ago(seen), testsAt: ago(testsAt) },
        [[arr - 20, NURSE, "Initial nursing assessment complete"], [seen, t.doctor ?? DOCTORS[i % 2], "Seen by doctor"], [testsAt, t.doctor ?? DOCTORS[i % 2], "Sent for tests"]]));
    }

    for (let i = 0; i < p.doctor; i++) {
      const t = take(tpl.ass, i + li), arr = 66, seen = 14, doc = DOCTORS[(i + li) % 2];
      regs.push(person(t, arr, { status: "with doctor", room: `Consult room ${1 + ((i + li) % 3)}`, doctor: doc, seenAt: ago(seen), triage: { ...t.triage!, at: ago(arr - 22) } },
        [[arr - 22, NURSE, "Initial nursing assessment complete"], [seen, doc, `Called to Consult room ${1 + ((i + li) % 3)}`]]));
    }

    for (let i = 0; i < p.ready; i++) {
      const t = take(tpl.ass, i + li + 1);
      // The third Greams Road patient has waited for a doctor past the 60-minute limit.
      const arr = [38, 54, 88][i] ?? 40, done = [20, 31, 68][i] ?? 20;
      regs.push(person(t, arr, { status: "ready for doctor", triage: { ...t.triage!, at: ago(done) } }, [[done, NURSE, `Initial nursing assessment complete · ${t.triage!.category}`]]));
    }

    for (let i = 0; i < p.assess; i++) {
      const t = take(tpl.arr, i + li + 1), arr = 30;
      regs.push(person(t, arr, { status: "in assessment", bay: "Assessment bay 1", calledAt: ago(8) }, [[8, NURSE, "Called to Assessment bay 1"]]));
    }

    for (let i = 0; i < p.wait; i++) {
      const t = take(tpl.arr, i + li);
      regs.push(person(t, [3, 11, 19, 27][i] ?? 5, { status: "waiting for assessment" }, []));
    }
  });

  const audit: AuditEntry[] = [
    [4, DESK, "write", "Registration", "New patient registered at Greams Road"],
    [9, NURSE, "sign", "Initial nursing assessment", "Assessment signed · Urgent"],
    [14, "Dr. Meera Krishnan", "read", "Patient chart", "Opened chart from the consultation queue"],
    [22, "Dr. Arun Nair", "sign", "Consultation", "Consultation signed · to checkout"],
    [31, "Dr. Neha Bose", "ai", "Visit analysis", "AI draft of the visit note generated — awaiting doctor review"],
    [38, "Vascular lab", "write", "Results desk", "Arterial duplex result entered"],
    [47, DESK, "write", "Checkout", "Checkout complete · follow-up booked"],
    [55, "R. Subramanian", "export", "Patient master", "Monthly audit extract exported (de-identified)"],
    [63, "S. Hariharan", "deny", "Patient chart", "Refused: research fellow has no access to identifiable charts"],
    [78, "Sr. Anandhi K.", "write", "Observation entry", "Ward observations recorded · VW-07"],
    [96, "Dr. Meera Krishnan", "sign", "Review & sign-off", "Discharge summary countersigned"],
    [120, DESK, "write", "Admission", "Admitted to Vascular ward from OPD"],
  ].map(([m, user, action, subject, detail]) => ({ at: ago(m as number), user: user as string, action: action as AuditEntry["action"], subject: subject as string, detail: `${detail} (demo)` }));

  return { registrations: regs, appointments: appts, audit };
}

setDemoSeeder((s: State) => {
  const keep = <T extends { id?: string; regId?: string }>(xs: T[]) => xs.filter((x) => !(x.id ?? "").startsWith("DEMO-") && !(x.regId ?? "").startsWith("DEMO-"));
  const d = build();
  return {
    registrations: [...d.registrations, ...keep(s.registrations)],
    appointments: [...d.appointments, ...keep(s.appointments)],
    audit: [...s.audit.filter((a) => !a.detail.endsWith("(demo)")), ...d.audit].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 500),
  };
});
