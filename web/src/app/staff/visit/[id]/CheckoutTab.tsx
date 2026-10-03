"use client";

import { useState } from "react";
import { Section, Select } from "@/components/staff/ui";
import { by, checkoutTasks, computeAbi, interpretAbi, updateVisit, woundArea, type StaffUser, type Visit } from "@/lib/clinic";
import { site } from "@/lib/site";

const followUps = [
  "Wound clinic in 1 week",
  "Wound clinic in 2 weeks",
  "Vascular surgery in 2 weeks",
  "Angiography: date to be confirmed by phone",
  "HBOT series: start after insurance approval",
  "Diabetic foot check in 3 months",
] as const;

// Plain-language wording for the patient's after-visit summary.
const plain: Record<string, string> = {
  "ABI / TBI": "Blood pressure test of your legs and toes to check circulation",
  "Arterial duplex": "Ultrasound of the arteries in your leg",
  "Venous duplex": "Ultrasound of the veins in your leg",
  "TcPO₂": "Skin oxygen test to see how well your wound can heal",
  "X-ray foot": "X-ray of your foot",
  "MRI foot": "MRI scan of your foot to check for bone infection",
  "Wound culture": "Wound sample sent to the lab to check for infection",
  "Labs: CBC, CRP, ESR, A1c, BMP": "Blood tests",
  "Angiography ± intervention": "Angiogram: a procedure to look at, and if needed open, blocked leg arteries",
  "HBOT evaluation / series": "Hyperbaric oxygen therapy (daily oxygen treatments)",
  "Custom footwear / offloading referral": "Special shoes or inserts to take pressure off your foot",
  "Infectious disease consult": "Visit with an infection specialist",
  "Diabetes education": "Diabetes education class",
  "Sharp debridement": "We cleaned the wound and removed unhealthy tissue",
  "Total contact cast": "We put a special cast on your foot to take pressure off the wound",
  "Compression wrap": "We applied a compression wrap to reduce swelling",
  "NPWT placement": "We placed a wound vacuum (negative pressure) dressing",
  "Skin substitute application": "We applied a skin substitute to help the wound close",
  "Advanced dressing": "We applied a special wound dressing",
};

const plainAbi: Record<string, string> = {
  Normal: "normal blood flow",
  Borderline: "borderline, slightly reduced blood flow",
  "Mild PAD": "mildly reduced blood flow",
  "Moderate PAD": "moderately reduced blood flow",
  "Severe PAD": "severely reduced blood flow",
  "Non-compressible": "stiff arteries, so we rely on the toe test",
};

export function CheckoutTab({ v, me }: { v: Visit; me: StaffUser }) {
  const [followUp, setFollowUp] = useState(v.checkout?.followUp ?? followUps[0]);
  const [tasks, setTasks] = useState(v.checkout?.tasks ?? checkoutTasks(v));

  if (!["checkout", "done"].includes(v.stage)) {
    return <Section title="Checkout"><p className="text-muted">Checkout opens once the provider signs the visit.</p></Section>;
  }

  const persist = (patch: Partial<NonNullable<Visit["checkout"]>>) =>
    updateVisit(v.id, (x) => ({ ...x, checkout: { followUp, tasks, avsPrinted: false, ...x.checkout, ...patch } }));

  const abi = v.abi ? computeAbi(v.abi) : undefined;
  const plan = v.plan;
  const diabetic = v.history?.diabetes && v.history.diabetes !== "none";
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  function complete() {
    const now = new Date().toISOString();
    updateVisit(v.id, (x) => ({
      ...x,
      stage: "done",
      stageSince: now,
      disposition: "discharged",
      checkout: { followUp, tasks, avsPrinted: true },
      log: [
        ...x.log,
        { at: now, text: `Checked out. Follow-up: ${followUp}. ${tasks.filter((t) => !t.done).length} open task(s) sent to work queues`, by: by(me) },
        ...(x.patient.referralId ? [{ at: now, text: `Referral ${x.patient.referralId} → "Seen"; consult summary queued to referring provider`, by: "System" }] : []),
      ],
    }));
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
      <div className="space-y-5 print:hidden">
        <Section title="Schedule follow-up">
          <Select label="Next appointment" value={followUp} options={followUps} onChange={(f) => { setFollowUp(f); persist({ followUp: f }); }} />
        </Section>

        <Section title="Tasks generated from orders" aside={<span className="text-sm text-muted">{tasks.filter((t) => t.done).length}/{tasks.length} done</span>}>
          <ul className="space-y-2">
            {tasks.map((t, i) => (
              <li key={t.label}>
                <label className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-sm ${t.done ? "border-ok bg-ok-soft" : "border-line"}`}>
                  <input type="checkbox" className="mt-0.5 size-4 accent-brand" checked={t.done}
                    onChange={(e) => {
                      const next = tasks.map((x, j) => (j === i ? { ...x, done: e.target.checked } : x));
                      setTasks(next);
                      persist({ tasks: next });
                    }} />
                  <span className={t.done ? "line-through text-muted" : ""}>{t.label}</span>
                </label>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">Unchecked tasks go to the prior-auth, scheduling and referral work queues when the visit closes.</p>
        </Section>

        {v.stage === "checkout" ? (
          <div className="flex flex-wrap justify-end gap-3">
            <button className="btn-secondary" onClick={() => window.print()}>Print visit summary</button>
            <button className="btn-primary" onClick={complete}>Complete visit &amp; discharge</button>
          </div>
        ) : (
          <p className="rounded-lg bg-ok-soft p-3 font-semibold text-ok">✓ Visit complete: {v.disposition?.replace("-", " to ")}</p>
        )}
      </div>

      {/* Patient-facing after-visit summary */}
      <article className="rounded-xl border border-line bg-white p-6 text-[15px] leading-relaxed print:border-0 print:p-0">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand">After-visit summary</p>
        <h2 className="mt-1 text-xl font-bold text-brand-dark">{v.patient.first} {v.patient.last}</h2>
        <p className="text-sm text-muted">{today} · {site.name}</p>

        {v.wounds.length > 0 || abi ? (
          <>
            <h3 className="mt-5 font-semibold">What we found</h3>
            <ul className="mt-1 list-disc pl-5">
              {v.wounds.map((w) => <li key={w.id}>Wound on your {w.location || "foot"}: about {woundArea(w)} cm² in size.</li>)}
              {abi?.right !== undefined && <li>Circulation test, right leg: {abi.right.toFixed(2)} ({plainAbi[interpretAbi(abi.right).label]}).</li>}
              {abi?.left !== undefined && <li>Circulation test, left leg: {abi.left.toFixed(2)} ({plainAbi[interpretAbi(abi.left).label]}).</li>}
            </ul>
          </>
        ) : null}

        {!!plan?.procedures.length && (
          <>
            <h3 className="mt-5 font-semibold">What we did today</h3>
            <ul className="mt-1 list-disc pl-5">{plan.procedures.map((p) => <li key={p}>{plain[p] ?? p}</li>)}</ul>
          </>
        )}

        {!!plan?.orders.filter((o) => o !== "ABI / TBI" || !abi).length && (
          <>
            <h3 className="mt-5 font-semibold">Tests and next steps</h3>
            <ul className="mt-1 list-disc pl-5">
              {plan.orders.filter((o) => o !== "ABI / TBI" || !abi).map((o) => <li key={o}>{plain[o] ?? o}</li>)}
            </ul>
            {plan.orders.includes("HBOT evaluation / series") && <p className="mt-1 text-sm text-muted">We will ask your insurance for approval and call you with a start date.</p>}
          </>
        )}

        <h3 className="mt-5 font-semibold">Your next appointment</h3>
        <p>{followUp}</p>

        <h3 className="mt-5 font-semibold">Taking care of yourself at home</h3>
        <ul className="mt-1 list-disc pl-5">
          {plan?.procedures.includes("Total contact cast") && <li>Keep the cast dry and walk as little as possible. Don&apos;t remove it.</li>}
          {diabetic && <li>Check your blood sugar as directed. High sugar slows healing.</li>}
          {diabetic && <li>Look at both feet every day, including between your toes.</li>}
          {v.history?.smoking === "current" && <li>Stopping smoking is one of the best things you can do for your circulation. Ask us for help.</li>}
          <li>Keep your dressing clean and dry. Change it only as your care team showed you.</li>
        </ul>

        <div className="mt-5 rounded-lg border-2 border-alert p-4">
          <p className="font-semibold text-alert">Call us right away at {site.phone} if you have:</p>
          <p>Fever or chills · redness spreading from the wound · new or worse pain · a bad smell or more drainage · a foot that turns cold, pale or blue.</p>
          <p className="mt-2 font-semibold">For chest pain or trouble breathing, call 911.</p>
        </div>
      </article>
    </div>
  );
}
