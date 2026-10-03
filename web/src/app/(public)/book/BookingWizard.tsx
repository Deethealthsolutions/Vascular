"use client";

import Link from "next/link";
import { useState } from "react";
import { site } from "@/lib/site";
import { Check, Field, Stepper, YesNo } from "@/components/form";

export type VisitType = "wound" | "vascular" | "hbot" | "diabetic-foot";

const visitOptions: { id: VisitType; title: string; text: string }[] = [
  { id: "wound", title: "Wound clinic: new patient", text: "A wound that won't heal, pressure injury or surgical wound" },
  { id: "vascular", title: "Vascular consultation", text: "Leg pain when walking, PAD, poor circulation, abnormal ABI" },
  { id: "hbot", title: "Hyperbaric oxygen (HBOT) evaluation", text: "Diabetic wound, radiation injury, bone infection" },
  { id: "diabetic-foot", title: "Diabetic foot screening", text: "Yearly foot exam, prevention and custom footwear" },
];

const hbotQuestions = [
  { id: "claustrophobia", text: "Do you feel very anxious in small, enclosed spaces?" },
  { id: "seizure", text: "Have you ever had a seizure?" },
  { id: "lung", text: "Do you have lung disease (COPD, emphysema) or have you ever had a collapsed lung?" },
  { id: "ear", text: "Have you had ear or sinus surgery, or do you have a cold or sinus infection now?" },
  { id: "chemo", text: "Are you receiving chemotherapy now, or have you in the past year?" },
  { id: "device", text: "Do you have a pacemaker, defibrillator, insulin pump or other implanted device?" },
  { id: "pregnant", text: "Are you or could you be pregnant?" },
];

type Data = {
  visit?: VisitType;
  location?: string;
  slot?: string;
  first: string; last: string; dob: string; phone: string; email: string; language: string;
  diabetes: string; a1c: string; smoking: string; kidney: boolean; dialysis: boolean; amputation: boolean;
  priorVascular: boolean; anticoagulant: boolean; allergies: string;
  woundLocation: string; woundWeeks: string;
  hbot: Record<string, boolean | undefined>;
  photos: { name: string; url: string }[];
  payer: string; memberId: string; cardUploaded: boolean;
  consent: boolean;
};

const empty: Data = {
  first: "", last: "", dob: "", phone: "", email: "", language: "English",
  diabetes: "none", a1c: "", smoking: "never", kidney: false, dialysis: false, amputation: false,
  priorVascular: false, anticoagulant: false, allergies: "", woundLocation: "", woundWeeks: "",
  hbot: {}, photos: [], payer: "", memberId: "", cardUploaded: false, consent: false,
};

function upcomingSlots() {
  const out: { day: string; iso: string; times: string[] }[] = [];
  const d = new Date();
  while (out.length < 5) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    out.push({
      day: d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
      iso: d.toISOString().slice(0, 10),
      times: ["8:30 AM", "10:00 AM", "1:30 PM", "3:00 PM"].filter((_, i) => (d.getDate() + i) % 3 !== 0),
    });
  }
  return out;
}

export function BookingWizard({ initialVisit }: { initialVisit?: VisitType }) {
  const [d, setD] = useState<Data>({ ...empty, visit: initialVisit });
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [slots] = useState(upcomingSlots);
  const set = <K extends keyof Data>(k: K, v: Data[K]) => setD((p) => ({ ...p, [k]: v }));

  const steps = ["Visit", "Time", "About you", "Health", ...(d.visit === "hbot" ? ["HBOT safety"] : []), "Photos", "Insurance", "Review"];
  const current = steps[step];

  const canNext: Record<string, boolean> = {
    Visit: !!d.visit,
    Time: !!d.location && !!d.slot,
    "About you": !!(d.first && d.last && d.dob && d.phone),
    Health: true,
    "HBOT safety": hbotQuestions.every((q) => d.hbot[q.id] !== undefined),
    Photos: true,
    Insurance: !!(d.payer && d.memberId),
    Review: d.consent,
  };

  const hbotFlags = hbotQuestions.filter((q) => d.hbot[q.id]);
  const visitTitle = visitOptions.find((v) => v.id === d.visit)?.title;
  const locationName = site.locations.find((l) => l.id === d.location)?.name;

  if (done) {
    return (
      <div className="card mt-8 border-2 border-ok">
        <p className="text-2xl font-bold text-ok">You&apos;re booked</p>
        <p className="mt-2 text-lg">{visitTitle}<br />{d.slot} · {locationName}</p>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-muted">
          <li>We&apos;ll text a confirmation link to {d.phone}. Messages never include health details.</li>
          <li>Bring your insurance card, photo ID and a list of your medications.</li>
          {d.visit === "hbot" && <li>A hyperbaric nurse will call you to go over your safety answers before your first visit.</li>}
          <li>Wear shoes and socks that are easy to take off.</li>
        </ul>
        <p className="mt-4 rounded-lg bg-surface p-3 text-sm">Confirmation #: DEMO-{Math.abs(d.first.length * 7919 + d.phone.length * 104729) % 100000}</p>
        <Link href="/" className="btn-secondary mt-6">Back to home</Link>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <Stepper steps={steps} current={step} />
      <div className="card mt-6">
        {current === "Visit" && (
          <fieldset>
            <legend className="text-xl font-semibold">What kind of visit do you need?</legend>
            <div className="mt-4 grid gap-3">
              {visitOptions.map((v) => (
                <label key={v.id} className={`flex cursor-pointer gap-3 rounded-lg border-2 p-4 ${d.visit === v.id ? "border-brand bg-brand-soft" : "border-line"}`}>
                  <input type="radio" name="visit" className="mt-1.5 size-4 accent-brand" checked={d.visit === v.id} onChange={() => set("visit", v.id)} />
                  <span>
                    <span className="block font-semibold">{v.title}</span>
                    <span className="text-muted">{v.text}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {current === "Time" && (
          <div>
            <h2 className="text-xl font-semibold">Choose a location and time</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {site.locations.map((l) => (
                <button key={l.id} type="button" onClick={() => set("location", l.id)}
                  className={`rounded-lg border-2 p-4 text-left ${d.location === l.id ? "border-brand bg-brand-soft" : "border-line"}`}>
                  <span className="block font-semibold">{l.name}</span>
                  <span className="text-sm text-muted">{l.address}</span>
                </button>
              ))}
            </div>
            {d.location && (
              <div className="mt-6 space-y-4">
                {slots.map((s) => (
                  <div key={s.iso}>
                    <p className="font-medium">{s.day}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {s.times.map((t) => {
                        const label = `${s.day}, ${t}`;
                        return (
                          <button key={t} type="button" onClick={() => set("slot", label)}
                            className={`rounded-lg border-2 px-4 py-2 ${d.slot === label ? "border-brand bg-brand text-white" : "border-line hover:border-brand"}`}>
                            {t}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {current === "About you" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <h2 className="text-xl font-semibold sm:col-span-2">About you</h2>
            <Field label="First name" value={d.first} onChange={(v) => set("first", v)} required />
            <Field label="Last name" value={d.last} onChange={(v) => set("last", v)} required />
            <Field label="Date of birth" type="date" value={d.dob} onChange={(v) => set("dob", v)} required />
            <Field label="Mobile phone" type="tel" value={d.phone} onChange={(v) => set("phone", v)} required />
            <Field label="Email (optional)" type="email" value={d.email} onChange={(v) => set("email", v)} />
            <div>
              <label className="label" htmlFor="lang">Preferred language</label>
              <select id="lang" className="input" value={d.language} onChange={(e) => set("language", e.target.value)}>
                {["English", "Español", "Other (interpreter needed)"].map((l) => <option key={l}>{l}</option>)}
              </select>
            </div>
          </div>
        )}

        {current === "Health" && (
          <div className="space-y-5">
            <h2 className="text-xl font-semibold">Your health</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="dm">Diabetes</label>
                <select id="dm" className="input" value={d.diabetes} onChange={(e) => set("diabetes", e.target.value)}>
                  <option value="none">No diabetes</option>
                  <option value="type1">Type 1</option>
                  <option value="type2">Type 2</option>
                  <option value="unsure">Not sure</option>
                </select>
              </div>
              {d.diabetes !== "none" && <Field label="Last A1c, if known" value={d.a1c} onChange={(v) => set("a1c", v)} placeholder="e.g. 7.8" />}
              <div>
                <label className="label" htmlFor="smk">Smoking / tobacco</label>
                <select id="smk" className="input" value={d.smoking} onChange={(e) => set("smoking", e.target.value)}>
                  <option value="never">Never</option>
                  <option value="former">Former</option>
                  <option value="current">Current</option>
                </select>
              </div>
              <Field label="Where is your wound? (optional)" value={d.woundLocation} onChange={(v) => set("woundLocation", v)} placeholder="e.g. bottom of right foot" />
              <Field label="How many weeks has it been open?" type="number" value={d.woundWeeks} onChange={(v) => set("woundWeeks", v)} />
            </div>
            <fieldset className="grid gap-2 sm:grid-cols-2">
              <legend className="label">Check any that apply</legend>
              <Check label="Kidney disease" checked={d.kidney} onChange={(v) => set("kidney", v)} />
              <Check label="On dialysis" checked={d.dialysis} onChange={(v) => set("dialysis", v)} />
              <Check label="Past amputation (any level)" checked={d.amputation} onChange={(v) => set("amputation", v)} />
              <Check label="Past leg artery procedure or bypass" checked={d.priorVascular} onChange={(v) => set("priorVascular", v)} />
              <Check label="Take a blood thinner" checked={d.anticoagulant} onChange={(v) => set("anticoagulant", v)} />
            </fieldset>
            <Field label="Allergies (medications, latex, adhesives)" value={d.allergies} onChange={(v) => set("allergies", v)} />
          </div>
        )}

        {current === "HBOT safety" && (
          <div>
            <h2 className="text-xl font-semibold">Hyperbaric safety questions</h2>
            <p className="mt-1 text-muted">Answering &quot;yes&quot; won&apos;t stop you from booking. It helps our doctor plan your care safely.</p>
            <div className="mt-4 divide-y divide-line">
              {hbotQuestions.map((q) => (
                <YesNo key={q.id} label={q.text} value={d.hbot[q.id]} onChange={(v) => set("hbot", { ...d.hbot, [q.id]: v })} />
              ))}
            </div>
          </div>
        )}

        {current === "Photos" && (
          <div>
            <h2 className="text-xl font-semibold">Wound photos (optional)</h2>
            <p className="mt-1 text-muted">Photos help our team prepare before your visit. Up to 5.</p>
            <ul className="mt-3 list-disc pl-5 text-sm text-muted">
              <li>Use good light and hold the camera about 12 inches (30 cm) away</li>
              <li>Take one close-up and one showing the whole foot or leg</li>
              <li>Remove the dressing only if your care team has said it&apos;s OK</li>
            </ul>
            <label className="mt-4 flex cursor-pointer flex-col items-center rounded-lg border-2 border-dashed border-line p-8 text-center hover:border-brand">
              <span className="font-semibold text-brand">Choose photos or take a picture</span>
              <span className="text-sm text-muted">JPG, PNG or HEIC</span>
              <input type="file" accept="image/*" multiple className="sr-only"
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []).slice(0, 5 - d.photos.length);
                  set("photos", [...d.photos, ...files.map((f) => ({ name: f.name, url: URL.createObjectURL(f) }))]);
                }} />
            </label>
            {d.photos.length > 0 && (
              <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-5">
                {d.photos.map((p, i) => (
                  <div key={p.url} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
                    <img src={p.url} alt={`Wound photo ${i + 1}`} className="aspect-square w-full rounded-lg object-cover" />
                    <button type="button" aria-label={`Remove photo ${i + 1}`} onClick={() => set("photos", d.photos.filter((x) => x !== p))}
                      className="absolute right-1 top-1 grid size-7 place-items-center rounded-full bg-white/90 text-sm shadow">✕</button>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-4 text-xs text-muted">In production, photos are encrypted and location data is removed before upload.</p>
          </div>
        )}

        {current === "Insurance" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <h2 className="text-xl font-semibold sm:col-span-2">Insurance</h2>
            <div>
              <label className="label" htmlFor="payer">Insurance plan</label>
              <select id="payer" className="input" value={d.payer} onChange={(e) => set("payer", e.target.value)}>
                <option value="">Select…</option>
                {site.insurance.map((i) => <option key={i}>{i}</option>)}
                <option>Other</option>
                <option>Self-pay</option>
              </select>
            </div>
            <Field label="Member ID" value={d.memberId} onChange={(v) => set("memberId", v)} required />
            <label className="flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-line p-5 text-center hover:border-brand sm:col-span-2">
              <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => set("cardUploaded", !!e.target.files?.length)} />
              <span className="font-semibold text-brand">{d.cardUploaded ? "✓ Card photos added" : "Add photos of the front and back of your card"}</span>
            </label>
            {(d.visit === "hbot") && (
              <p className="rounded-lg bg-warn-soft p-3 text-sm text-warn sm:col-span-2">
                HBOT usually needs prior authorization from your insurance. Our team handles this for you after your evaluation.
              </p>
            )}
          </div>
        )}

        {current === "Review" && (
          <div>
            <h2 className="text-xl font-semibold">Review and confirm</h2>
            <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-[max-content_1fr]">
              <dt className="text-muted">Visit</dt><dd className="font-medium">{visitTitle}</dd>
              <dt className="text-muted">When</dt><dd className="font-medium">{d.slot} · {locationName}</dd>
              <dt className="text-muted">Patient</dt><dd className="font-medium">{d.first} {d.last} · {d.dob}</dd>
              <dt className="text-muted">Insurance</dt><dd className="font-medium">{d.payer} · {d.memberId}</dd>
              <dt className="text-muted">Photos</dt><dd className="font-medium">{d.photos.length}</dd>
            </dl>
            {hbotFlags.length > 0 && (
              <div className="mt-4 rounded-lg bg-warn-soft p-3 text-sm text-warn">
                <strong>For clinician review:</strong> {hbotFlags.map((f) => f.id).join(", ")}. A nurse will call you before your visit.
              </div>
            )}
            <div className="mt-5">
              <Check label="I confirm this information is correct and agree to the privacy notice and consent to be contacted by text." checked={d.consent} onChange={(v) => set("consent", v)} />
            </div>
          </div>
        )}

        <div className="mt-8 flex justify-between gap-3">
          <button type="button" className="btn-ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>← Back</button>
          {current === "Review" ? (
            <button type="button" className="btn-primary" disabled={!canNext.Review} onClick={() => setDone(true)}>Confirm booking</button>
          ) : (
            <button type="button" className="btn-primary" disabled={!canNext[current]} onClick={() => setStep(step + 1)}>Continue →</button>
          )}
        </div>
      </div>
      <p className="mt-4 text-center text-sm text-muted">
        Need help? Call <a href={`tel:${site.phone}`} className="font-semibold text-brand">{site.phone}</a>
      </p>
    </div>
  );
}
