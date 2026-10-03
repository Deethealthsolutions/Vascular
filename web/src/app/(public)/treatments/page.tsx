import type { Metadata } from "next";
import Link from "next/link";
import { treatments } from "@/lib/content";

export const metadata: Metadata = { title: "Treatments" };

export default function TreatmentsPage() {
  return (
    <div className="container-page py-12">
      <p className="eyebrow">Treatments</p>
      <h1 className="mt-2 text-3xl font-bold text-brand-dark">Treatments we offer</h1>
      <p className="mt-3 max-w-2xl text-muted">
        Most patients need more than one therapy. Your team builds one plan that brings together restoring blood flow, wound care and prevention.
      </p>
      <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {treatments.map((t) => (
          <Link key={t.slug} href={`/treatments/${t.slug}`} className="card transition hover:border-brand hover:shadow-sm">
            <h2 className="text-lg font-semibold text-brand-dark">{t.name}</h2>
            <p className="mt-2 text-muted">{t.summary}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
