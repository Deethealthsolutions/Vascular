import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { conditions, getCondition, getTreatment } from "@/lib/content";

export function generateStaticParams() {
  return conditions.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata(props: PageProps<"/conditions/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  return { title: getCondition(slug)?.name ?? "Condition" };
}

export default async function ConditionPage(props: PageProps<"/conditions/[slug]">) {
  const { slug } = await props.params;
  const c = getCondition(slug);
  if (!c) notFound();

  return (
    <article className="container-page py-12">
      <Link href="/conditions" className="text-sm font-semibold text-brand">← All conditions</Link>
      <h1 className="mt-3 text-3xl font-bold text-brand-dark sm:text-4xl">{c.name}</h1>
      <p className="mt-4 max-w-3xl text-lg">{c.overview}</p>

      <div role="alert" className="mt-6 max-w-3xl rounded-lg border-l-4 border-alert bg-alert-soft p-4 text-alert">
        <strong>When to get help now:</strong> {c.urgent}
      </div>

      <div className="mt-10 grid gap-6 md:grid-cols-2">
        <section className="card">
          <h2 className="text-xl font-semibold text-brand-dark">Warning signs</h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-5">
            {c.warningSigns.map((s) => <li key={s}>{s}</li>)}
          </ul>
        </section>
        <section className="card">
          <h2 className="text-xl font-semibold text-brand-dark">Who is at risk</h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-5">
            {c.atRisk.map((s) => <li key={s}>{s}</li>)}
          </ul>
        </section>
      </div>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-brand-dark">How we treat it</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {c.treatments.map((slug) => {
            const t = getTreatment(slug);
            return t ? (
              <Link key={slug} href={`/treatments/${slug}`} className="card hover:border-brand">
                <p className="font-semibold">{t.name}</p>
                <p className="mt-1 text-sm text-muted">{t.summary}</p>
              </Link>
            ) : null;
          })}
        </div>
      </section>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/book" className="btn-primary">Book a visit</Link>
        <Link href="/self-check" className="btn-secondary">Take the self-check</Link>
      </div>
      <p className="mt-8 text-sm text-muted">Medically reviewed by: [Clinician name, credentials] · Last reviewed: [date]</p>
    </article>
  );
}
