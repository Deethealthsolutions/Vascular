import Link from "next/link";
import { site } from "@/lib/site";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-line bg-surface">
      <div className="container-page grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="font-semibold text-brand-dark">{site.name}</p>
          <p className="mt-2 text-sm text-muted">{site.tagline}</p>
          <p className="mt-3 text-sm">
            Phone: <a className="font-semibold text-brand" href={`tel:${site.phone}`}>{site.phone}</a>
            <br />
            Referral fax: {site.referralFax}
          </p>
        </div>
        {site.locations.map((l) => (
          <div key={l.id} className="text-sm">
            <p className="font-semibold">{l.name}</p>
            <p className="text-muted">
              {l.address}
              <br />
              {l.city}
              <br />
              {l.hours}
            </p>
          </div>
        ))}
        <div className="text-sm">
          <p className="font-semibold">Quick links</p>
          <ul className="mt-1 space-y-1 text-brand">
            <li><Link href="/book">Book a visit</Link></li>
            <li><Link href="/refer">Refer a patient</Link></li>
            <li><Link href="/portal">Referral portal</Link></li>
            <li><Link href="/team">Our team</Link></li>
            <li><Link href="/staff">Staff workspace</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line py-4">
        <p className="container-page text-sm text-muted">
          <strong>In an emergency, call 911.</strong> Information on this site is for education and does not replace advice from your doctor.
        </p>
      </div>
    </footer>
  );
}
