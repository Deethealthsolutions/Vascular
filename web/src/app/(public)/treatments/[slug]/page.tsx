import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCondition, getTreatment, treatments } from "@/lib/content";

export function generateStaticParams() {
  return treatments.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata(props: PageProps<"/treatments/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  return { title: getTreatment(slug)?.name ?? "Treatment" };
}

export default async function TreatmentPage(props: PageProps<"/treatments/[slug]">) {
  const { slug } = await props.params;
  const t = getTreatment(slug);
  if (!t) notFound();

  return (
    <article className="container-page py-12">
      <Link href="/treatments" className="text-sm font-semibold text-brand">← All treatments</Link>
      <h1 className="mt-3 text-3xl font-bold text-brand-dark sm:text-4xl">{t.name}</h1>
      <p className="mt-2 text-lg text-muted">{t.summary}</p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <section>
          <h2 className="text-xl font-semibold text-brand-dark">What it is</h2>
          <p className="mt-3 text-lg">{t.what}</p>
          <h2 className="mt-8 text-xl font-semibold text-brand-dark">What to expect</h2>
          <ul className="mt-3 space-y-2">
            {t.expect.map((e) => (
              <li key={e} className="flex gap-2"><span aria-hidden className="text-brand">✓</span>{e}</li>
            ))}
          </ul>
        </section>
        <aside className="card h-fit bg-surface">
          <h2 className="font-semibold">Often used for</h2>
          <ul className="mt-2 space-y-1">
            {t.goodFor.map((s) => {
              const c = getCondition(s);
              return c ? (
                <li key={s}><Link className="text-brand hover:underline" href={`/conditions/${s}`}>{c.name}</Link></li>
              ) : null;
            })}
          </ul>
          <Link href={`/book?visit=${t.slug === "hbot" ? "hbot" : "wound"}`} className="btn-primary mt-6 w-full">
            {t.slug === "hbot" ? "Request an HBOT evaluation" : "Book a visit"}
          </Link>
        </aside>
      </div>
      <p className="mt-10 text-sm text-muted">Medically reviewed by: [Clinician name, credentials] · Last reviewed: [date]</p>
    </article>
  );
}
