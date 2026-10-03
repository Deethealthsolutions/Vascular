import Link from "next/link";
import { conditions, outcomes, treatments } from "@/lib/content";
import { site } from "@/lib/site";

const services = [
  { title: "Wound care", text: "Specialized care for wounds that haven't healed in 2+ weeks.", href: "/treatments/advanced-wound-care" },
  { title: "Vascular intervention", text: "Minimally invasive procedures to restore blood flow to the legs.", href: "/treatments/revascularization" },
  { title: "Limb salvage", text: "A team approach to avoiding amputation, even in severe cases.", href: "/treatments/limb-salvage-surgery" },
  { title: "Diabetic foot care", text: "Ulcer treatment, offloading and prevention for people with diabetes.", href: "/conditions/diabetic-foot-ulcers" },
  { title: "Hyperbaric oxygen", text: "HBOT for diabetic wounds, radiation injury and bone infection.", href: "/treatments/hbot" },
];

export default function Home() {
  return (
    <>
      <section className="bg-gradient-to-b from-brand-soft to-white">
        <div className="container-page grid items-center gap-10 py-14 lg:grid-cols-[1.3fr_1fr] lg:py-20">
          <div>
            <p className="eyebrow">Wound · Vascular · Limb Salvage · HBOT</p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-brand-dark sm:text-5xl">
              A wound that won&apos;t heal is a warning. We can help.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted">
              Vascular surgeons, podiatrists and wound and hyperbaric specialists working as one team to heal
              wounds, restore circulation and save limbs.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/book" className="btn-primary">Book a visit</Link>
              <Link href="/self-check" className="btn-secondary">Take the 2-minute self-check</Link>
            </div>
            <p className="mt-4 text-sm text-muted">
              Book directly or ask your doctor to refer you. Call <a href={`tel:${site.phone}`} className="font-semibold text-brand">{site.phone}</a>
            </p>
          </div>
          <div className="card bg-white shadow-sm">
            <p className="font-semibold text-brand-dark">See a specialist if you have:</p>
            <ul className="mt-3 space-y-2.5">
              {[
                "A foot or leg wound that hasn't improved in 2 weeks",
                "Diabetes and any sore, blister or color change on your foot",
                "Leg pain when walking that eases with rest",
                "Foot pain at night or cold, pale toes",
                "A wound in an area treated with radiation",
              ].map((s) => (
                <li key={s} className="flex gap-2">
                  <span aria-hidden className="mt-1 text-brand">●</span>
                  {s}
                </li>
              ))}
            </ul>
            <p className="mt-4 rounded-lg bg-alert-soft p-3 text-sm text-alert">
              <strong>Emergency:</strong> fever with a foot wound, spreading redness, or a suddenly cold, numb leg. Call 911.
            </p>
          </div>
        </div>
      </section>

      <section className="container-page py-14">
        <h2 className="text-2xl font-bold text-brand-dark">What we do</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {services.map((s) => (
            <Link key={s.title} href={s.href} className="card transition hover:border-brand hover:shadow-sm">
              <p className="font-semibold text-brand-dark">{s.title}</p>
              <p className="mt-2 text-sm text-muted">{s.text}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="bg-surface">
        <div className="container-page grid gap-6 py-14 sm:grid-cols-2 lg:grid-cols-4">
          <Stat value={`${outcomes.metrics[0].value}%`} label="of wounds healed by 20 weeks" />
          <Stat value={`${outcomes.metrics[1].value}%`} label="limb salvage rate at 1 year" />
          <Stat value={`${outcomes.medianDaysToHeal}`} label="median days to heal" />
          <Stat value={`${outcomes.urgentReferralToVisitHours}h`} label="urgent referral to first visit" />
          <p className="text-sm text-muted sm:col-span-2 lg:col-span-4">
            {outcomes.period}. <Link href="/outcomes" className="font-semibold text-brand">How we measure →</Link>
          </p>
        </div>
      </section>

      <section className="container-page grid gap-10 py-14 lg:grid-cols-2">
        <div>
          <h2 className="text-2xl font-bold text-brand-dark">Conditions we treat</h2>
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {conditions.map((c) => (
              <li key={c.slug}>
                <Link href={`/conditions/${c.slug}`} className="flex justify-between py-3 hover:text-brand">
                  {c.name} <span aria-hidden>→</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-brand-dark">Treatments</h2>
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {treatments.map((t) => (
              <li key={t.slug}>
                <Link href={`/treatments/${t.slug}`} className="flex justify-between py-3 hover:text-brand">
                  {t.name} <span aria-hidden>→</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="container-page">
        <div className="flex flex-col items-start justify-between gap-6 rounded-2xl bg-brand-dark p-8 text-white md:flex-row md:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-white/70">For physicians &amp; podiatrists</p>
            <h2 className="mt-1 text-2xl font-bold">Refer a patient in 2 minutes and track every step.</h2>
            <p className="mt-2 text-white/80">Urgent referrals are reviewed the same business day. Consult summaries go back to you automatically.</p>
          </div>
          <div className="flex shrink-0 gap-3">
            <Link href="/refer" className="btn bg-white text-brand-dark hover:bg-brand-soft">Refer a patient</Link>
            <Link href="/portal" className="btn border-2 border-white/60 text-white hover:bg-white/10">Referral portal</Link>
          </div>
        </div>
      </section>
    </>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="text-4xl font-bold text-brand">{value}</p>
      <p className="mt-1 text-muted">{label}</p>
    </div>
  );
}
