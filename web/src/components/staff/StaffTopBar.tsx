"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { resetDemo, setStaff, staffUsers, useStaff } from "@/lib/clinic";
import { site } from "@/lib/site";

const links = [
  { href: "/staff", label: "Clinic board" },
  { href: "/staff/check-in", label: "Check in patient" },
];

export function StaffTopBar() {
  const pathname = usePathname();
  const me = useStaff();

  return (
    <header className="sticky top-0 z-40 bg-brand-dark text-white print:hidden">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5">
        <Link href="/staff" className="font-semibold">
          {site.shortName} <span className="font-normal text-white/70">· Staff workspace</span>
        </Link>
        <nav className="flex gap-1" aria-label="Staff">
          {links.map((l) => {
            const active = l.href === "/staff" ? pathname === "/staff" : pathname.startsWith(l.href);
            return (
              <Link key={l.href} href={l.href}
                className={`rounded-md px-3 py-1.5 text-sm ${active ? "bg-white/15 font-semibold" : "text-white/80 hover:bg-white/10"}`}>
                {l.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-sm">
          <label className="flex items-center gap-2">
            <span className="text-white/70">Signed in as</span>
            <select value={me.id} onChange={(e) => setStaff(e.target.value as typeof me.id)}
              className="rounded-md border border-white/30 bg-brand-dark px-2 py-1">
              {staffUsers.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
            </select>
          </label>
          <button className="rounded-md px-2 py-1 text-white/70 hover:bg-white/10"
            onClick={() => confirm("Reset the demo board to its starting patients?") && resetDemo()}>
            Reset demo
          </button>
          <Link href="/" className="text-white/70 hover:text-white">Public site ↗</Link>
        </div>
      </div>
    </header>
  );
}
