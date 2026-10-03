import type { Metadata } from "next";
import Link from "next/link";
import { conditions } from "@/lib/content";

export const metadata: Metadata = { title: "Conditions we treat" };

export default function ConditionsPage() {
  return (
    <div className="container-page py-12">
      <p className="eyebrow">Conditions</p>
      <h1 className="mt-2 text-3xl font-bold text-brand-dark">Conditions we treat</h1>
      <p className="mt-3 max-w-2xl text-muted">
        Learn the warning signs, who is at risk and how our team can help. Early care makes the biggest difference.
      </p>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {conditions.map((c) => (
          <Link key={c.slug} href={`/conditions/${c.slug}`} className="card transition hover:border-brand hover:shadow-sm">
            <h2 className="text-lg font-semibold text-brand-dark">{c.name}</h2>
            <p className="mt-2 text-muted">{c.summary}</p>
            <p className="mt-3 font-semibold text-brand">Learn more →</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
