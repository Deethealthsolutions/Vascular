import type { Metadata } from "next";
import { site, team } from "@/lib/site";

export const metadata: Metadata = { title: "Our team" };

export default function TeamPage() {
  return (
    <div className="container-page py-12">
      <p className="eyebrow">Our team</p>
      <h1 className="mt-2 text-3xl font-bold text-brand-dark">One team for every part of your care</h1>
      <p className="mt-3 max-w-2xl text-muted">
        Vascular surgeons, podiatrists, and wound and hyperbaric specialists review complex cases together each week.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {team.map((p) => (
          <div key={p.name} className="card">
            <div aria-hidden className="grid h-16 w-16 place-items-center rounded-full bg-brand-soft text-xl font-bold text-brand">
              {p.name.replace(/^Dr\. /, "").split(" ").map((w) => w[0]).slice(0, 2).join("")}
            </div>
            <p className="mt-4 font-semibold">{p.name}</p>
            <p className="text-sm text-brand">{p.role}</p>
            <p className="mt-2 text-sm text-muted">{p.focus}</p>
          </div>
        ))}
      </div>
      <h2 className="mt-12 text-xl font-semibold text-brand-dark">Insurance accepted</h2>
      <ul className="mt-3 flex flex-wrap gap-2">
        {site.insurance.map((i) => <li key={i} className="chip bg-surface border border-line">{i}</li>)}
      </ul>
    </div>
  );
}
