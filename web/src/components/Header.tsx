import Link from "next/link";
import { nav, site } from "@/lib/site";

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
      <div className="container-page flex items-center justify-between gap-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold text-brand-dark">
          <Logo />
          <span className="leading-tight">
            {site.shortName}
            <span className="block text-xs font-normal text-muted">Wound &amp; Vascular Center</span>
          </span>
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className="rounded-md px-3 py-2 text-ink hover:bg-brand-soft">
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <a href={`tel:${site.phone}`} className="hidden text-sm font-semibold text-brand md:block">
            {site.phone}
          </a>
          <Link href="/book" className="btn-primary px-4 py-2">
            Book a visit
          </Link>
          <details className="relative lg:hidden">
            <summary className="btn-ghost cursor-pointer list-none px-3 py-2" aria-label="Menu">
              ☰
            </summary>
            <div className="absolute right-0 mt-2 w-56 rounded-lg border border-line bg-white p-2 shadow-lg">
              {nav.map((n) => (
                <Link key={n.href} href={n.href} className="block rounded-md px-3 py-2 hover:bg-brand-soft">
                  {n.label}
                </Link>
              ))}
              <Link href="/portal" className="block rounded-md px-3 py-2 hover:bg-brand-soft">
                Referral portal
              </Link>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}

function Logo() {
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true">
      <rect width="34" height="34" rx="8" fill="var(--color-brand)" />
      <path d="M8 18h5l2.5-6 4 11 2.5-5H26" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
