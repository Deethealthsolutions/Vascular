import type { Metadata } from "next";
import { outcomes } from "@/lib/content";

export const metadata: Metadata = { title: "Our results" };

export default function OutcomesPage() {
  return (
    <div className="container-page py-12">
      <p className="eyebrow">Our results</p>
      <h1 className="mt-2 text-3xl font-bold text-brand-dark">Outcomes you can check</h1>
      <p className="mt-3 max-w-2xl text-muted">
        We publish our results every quarter. {outcomes.period}.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {outcomes.metrics.map((m) => (
          <div key={m.label} className="card">
            <p className="text-muted">{m.label}</p>
            <p className="mt-1 text-4xl font-bold text-brand">{m.value}{m.unit}</p>
            <div className="mt-3 h-2.5 rounded-full bg-brand-soft" role="presentation">
              <div className="h-2.5 rounded-full bg-brand" style={{ width: `${m.value}%` }} />
            </div>
          </div>
        ))}
        <div className="card">
          <p className="text-muted">Median days to heal</p>
          <p className="mt-1 text-4xl font-bold text-brand">{outcomes.medianDaysToHeal}</p>
        </div>
        <div className="card">
          <p className="text-muted">Median time from urgent referral to first visit</p>
          <p className="mt-1 text-4xl font-bold text-brand">{outcomes.urgentReferralToVisitHours} hours</p>
        </div>
      </div>

      <section className="mt-10 max-w-3xl rounded-xl bg-surface p-6 text-sm text-muted">
        <h2 className="text-base font-semibold text-ink">How we measure</h2>
        <p className="mt-2">
          Figures include all patients who started treatment during the period, not only those who completed it.
          &quot;Healed&quot; means the wound fully closed and stayed closed for 2 weeks. Major amputation means amputation above the ankle.
          We don&apos;t report any metric based on fewer than 11 patients, to protect privacy.
        </p>
        <p className="mt-2 font-semibold text-warn">Prototype: these numbers are illustrative placeholders, not real results.</p>
      </section>
    </div>
  );
}
