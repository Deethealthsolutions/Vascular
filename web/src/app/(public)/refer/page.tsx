import type { Metadata } from "next";
import Link from "next/link";
import { site } from "@/lib/site";
import { ReferralForm } from "./ReferralForm";

export const metadata: Metadata = { title: "Refer a patient" };

export default function ReferPage() {
  return (
    <div className="container-page py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">For referring providers</p>
          <h1 className="mt-2 text-3xl font-bold text-brand-dark">Refer a patient</h1>
          <p className="mt-2 max-w-2xl text-muted">
            Urgent referrals are reviewed within 4 business hours and routine ones within 2 business days. You&apos;ll see every
            status change in the portal and get the consult summary back automatically.
          </p>
        </div>
        <Link href="/portal" className="btn-secondary">My referrals →</Link>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
        <ReferralForm />
        <aside className="space-y-4">
          <div className="card bg-surface">
            <h2 className="font-semibold text-brand-dark">When to refer for PAD / CLTI</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              <li>ABI &lt; 0.90, or &gt; 1.40 / non-compressible (check TBI)</li>
              <li>Walking pain (claudication) that limits daily life</li>
              <li>Pain at rest, tissue loss or gangrene: <strong>refer urgently</strong></li>
              <li>A diabetic foot ulcer with weak or absent pedal pulses</li>
            </ul>
          </div>
          <div className="card bg-surface">
            <h2 className="font-semibold text-brand-dark">Common HBOT indications</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              <li>Diabetic foot ulcer, Wagner grade 3 or higher, not improving after 30 days of standard care</li>
              <li>Delayed radiation injury (soft tissue or bone)</li>
              <li>Chronic refractory osteomyelitis</li>
              <li>Compromised skin grafts or flaps</li>
              <li>Crush injury, necrotizing soft-tissue infection (acute: call us)</li>
            </ul>
            <p className="mt-2 text-xs text-muted">Coverage criteria vary by payer. We verify and handle prior authorization.</p>
          </div>
          <div className="card text-sm">
            <p className="font-semibold">Prefer to call or fax?</p>
            <p className="mt-1 text-muted">Referral line {site.phone}<br />Fax {site.referralFax}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
