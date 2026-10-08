"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { CLIN, NET, PROF, RES, GRAPH, RULES } from "@/lib/cx/data";
import { audit, clearStore, openPending, resetStore, setState, useStore } from "@/lib/cx/store";
// Registers the demo-day generator with the store (side-effect import).
import "@/app/clinical/demoDay";
import { canSee, LANDING, STAFF, staffById, type Screen } from "@/lib/cx/users";
import { currentLocation, hereRegs, myLocations } from "@/lib/cx/locations";
import { LogoutButton } from "@/components/auth/LogoutButton";
import type { Account } from "@/lib/auth/session";
import type { LoginStats } from "@/lib/auth/stats";
import { isAdmin, roleLabel } from "@/lib/auth/roles";
import { LocBadge } from "./LocBadge";
import { Denied, Toaster } from "./ui";

export function useMe() {
  const s = useStore();
  return staffById(s.user);
}

const NAV: { g: string; items: { s: Screen; href: string; ic: string; label: string; cnt?: (n: ReturnType<typeof useStore>) => number | null; hot?: boolean }[] }[] = [
  { g: "Patient journey", items: [
    { s: "flow", href: "/clinical/flow", ic: "⇶", label: "Today's patient flow", cnt: (st) => st.registrations.filter((r) => !["checked out", "admitted", "left without being seen", "sent to emergency"].includes(r.status)).length || null },
    { s: "register", href: "/clinical/register", ic: "✚", label: "1 · Registration", cnt: (st) => st.registrations.length || null },
    { s: "triage", href: "/clinical/triage", ic: "♡", label: "2 · Initial nursing assessment", cnt: (st) => st.registrations.filter((r) => r.status === "waiting for assessment" || r.status === "in assessment").length || null, hot: true },
    { s: "consult", href: "/clinical/consult", ic: "⚕", label: "3 · Doctor consultation", cnt: (st) => st.registrations.filter((r) => r.status === "ready for doctor" || r.status === "with doctor").length || null, hot: true },
    { s: "checkout", href: "/clinical/checkout", ic: "⎋", label: "4A · Checkout", cnt: (st) => st.registrations.filter((r) => r.status === "to checkout").length || null, hot: true },
    { s: "services", href: "/clinical/services", ic: "⚗", label: "4B · Tests & procedures", cnt: (st) => st.registrations.filter((r) => r.status === "at tests" || r.status === "for procedure").length || null, hot: true },
    { s: "admit", href: "/clinical/admit", ic: "⌂", label: "4C · Admission", cnt: (st) => st.registrations.filter((r) => r.status === "awaiting admission").length || null, hot: true },
  ] },
  { g: "Leadership", items: [{ s: "overview", href: "/clinical", ic: "▦", label: "Network overview" }] },
  { g: "Bedside", items: [
    { s: "round", href: "/clinical/round", ic: "☰", label: "Ward round & clinics", cnt: () => NET.roster.length },
    { s: "patient", href: "/clinical/patient/P-4412", ic: "⌗", label: "Patient chart" },
    { s: "visit", href: "/clinical/visit", ic: "✎", label: "Visit analysis" },
  ] },
  { g: "Nursing", items: [{ s: "nurse", href: "/clinical/nurse", ic: "◱", label: "Observation entry", cnt: (st) => st.obs.filter((o) => !o.synced).length || null }] },
  { g: "Governance", items: [
    { s: "profile", href: "/clinical/profile", ic: "⚯", label: "Patient master", cnt: () => PROF.totals.n },
    { s: "signoff", href: "/clinical/signoff", ic: "✓", label: "Review & sign-off", cnt: (st) => openPending(st).length, hot: true },
    { s: "audit", href: "/clinical/audit", ic: "⦿", label: "Access audit", cnt: (st) => st.audit.length || null },
  ] },
  { g: "Wound care", items: [{ s: "wound", href: "/clinical/wound", ic: "◎", label: "Wound & HBOT", cnt: () => 3 }] },
  { g: "Research", items: [
    { s: "research", href: "/clinical/research", ic: "⚗", label: "Research workspace", cnt: () => RES.studies.length },
    { s: "rdocs", href: "/clinical/research-docs", ic: "▤", label: "Research documents" },
    { s: "graph", href: "/clinical/graph", ic: "◈", label: "Knowledge graph", cnt: () => GRAPH.totals.nodes },
  ] },
  { g: "System", items: [
    { s: "arch", href: "/clinical/arch", ic: "⊞", label: "Architecture" },
    { s: "auto", href: "/clinical/auto", ic: "⚙", label: "Automations", cnt: () => RULES.length },
    { s: "requirements", href: "/clinical/requirements", ic: "☑", label: "Requirements coverage" },
  ] },
];

function screenOf(path: string): Screen {
  const seg = path.split("/")[2] ?? "";
  return (seg === "" ? "overview" : seg) as Screen;
}

/** `account` is the logged-in user (absent in the single-file HTML export, which has no server). */
export function Shell({ children, account, loginStats }: { children: ReactNode; account?: Account | null; loginStats?: LoginStats | null }) {
  const st = useStore();
  const me = staffById(st.user);
  const path = usePathname();
  const router = useRouter();
  const cur = screenOf(path);
  const here = currentLocation(st, me);
  // Journey counts in the nav are for the location the staff member is working at.
  const stHere = { ...st, registrations: hereRegs(st, me) };

  function switchUser(id: string) {
    const u = staffById(id);
    setState(() => ({ user: id }));
    audit(u.name, "read", "session", `Signed in as ${u.role}`);
    if (!canSee(u, cur)) router.push(LANDING[u.cls]);
  }

  return (
    <div className="cx-shell">
      <aside className="side">
        <div className="brand">
          <div className="h"><span className="logo">V</span><span>Vascular &amp; Diabetic Foot</span></div>
          <div className="s">{NET.org}</div>
        </div>
        {account && (
          <div className="role acct">
            <div className="role-l">Logged in</div>
            <div className="acct-b">
              <span className="acct-av" aria-hidden>{account.display_name.slice(0, 1).toUpperCase()}</span>
              <span className="acct-n"><b>{account.display_name}</b><br />{account.username} · {roleLabel(account.role)}</span>
              <LogoutButton className="acct-out" />
            </div>
            {loginStats && (
              <div className="acct-stats" title={`${loginStats.users_logged_in} of ${loginStats.total_users} active users have logged in at least once · ${loginStats.logins_total} log-ins in total · ${loginStats.logins_today} today (India time)`}>
                <span><b>{loginStats.users_logged_in}</b>/{loginStats.total_users} users logged in</span>
                <span><b>{loginStats.logins_total}</b> log-ins · <b>{loginStats.logins_today}</b> today</span>
              </div>
            )}
          </div>
        )}
        <div className="role">
          <div className="role-l" title="Prototype: pick a staff member to see the screens as their role">Acting as (demo role)</div>
          <div className="role-b">
            <select aria-label="Signed-in staff member" value={st.user} onChange={(e) => switchUser(e.target.value)}>
              {STAFF.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>
        <div className="role" style={{ paddingTop: 10 }}>
          <div className="role-l" style={{ display: "flex", alignItems: "center", gap: 6 }}>Working at <LocBadge id={here.id} size="xs" /></div>
          <div className="role-b">
            <select aria-label="Working at location" value={here.id} onChange={(e) => { setState(() => ({ location: e.target.value })); audit(me.name, "read", "session", `Working at ${myLocations(me).find((l) => l.id === e.target.value)?.name}`); }}>
              {myLocations(me).map((l) => <option key={l.id} value={l.id}>{l.name} · {l.city}</option>)}
            </select>
          </div>
        </div>
        <div className="who" style={{ paddingTop: 10 }}>
          <b>{me.role}</b><br />
          {me.centres.length === 3 ? "All centres" : me.centres.join(", ")} · {me.cls}
        </div>
        <nav className="nav">
          {NAV.map((g) => (
            <div key={g.g}>
              <div className="nav-g">{g.g}</div>
              {g.items.map((it) => {
                const allowed = canSee(me, it.s);
                const n = st.hydrated && it.cnt ? it.cnt(stHere) : it.cnt && !it.hot ? it.cnt(stHere) : null;
                return (
                  <Link key={it.s} href={it.href} className={`${cur === it.s ? "on" : ""}${allowed ? "" : " dis"}`}
                    aria-disabled={!allowed} title={allowed ? undefined : "Not available to your role"}>
                    <span className="ic">{it.ic}</span><span>{it.label}</span>
                    {n != null && <span className={`cnt${it.hot && n > 0 ? " hot" : ""}`}>{n}</span>}
                  </Link>
                );
              })}
            </div>
          ))}
          {isAdmin(account) && (
            <div>
              <div className="nav-g">Administration</div>
              <Link href="/clinical/users" className={path.startsWith("/clinical/users") ? "on" : ""}>
                <span className="ic">⚿</span><span>Users</span>
              </Link>
            </div>
          )}
        </nav>
        <div className="side-f">
          Prototype · synthetic data · not a medical device<br />
          <button onClick={() => confirm("Start a fresh demo day? Everything entered in this browser (patients, observations, signatures, audit) is replaced by the demo patients.") && resetStore()}
            style={{ background: "none", border: 0, color: "#8895a4", padding: 0, marginTop: 6, textDecoration: "underline" }}>
            Reset to demo day
          </button>
          {" · "}
          <button onClick={() => confirm("Clear all data in this browser and start with an empty clinic (no demo patients)?") && clearStore()}
            style={{ background: "none", border: 0, color: "#8895a4", padding: 0, textDecoration: "underline" }}>
            Clear all
          </button>
          {" · "}<Link href="/" style={{ color: "#8895a4" }}>Public site</Link>
        </div>
      </aside>
      <div className="main">{children}</div>
      <Toaster />
    </div>
  );
}

export function Top({ title, sub, right }: { title: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  const st = useStore();
  const pending = st.hydrated ? openPending(st).length : null;
  const ref = useRef<HTMLDivElement>(null);
  // Publish the header's real height so sticky tab bars sit just below it (the subtitle can wrap).
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => document.documentElement.style.setProperty("--cx-top", `${el.offsetHeight}px`));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div className="top" ref={ref}>
      <div><h1>{title}</h1>{sub && <div className="sub">{sub}</div>}</div>
      <div className="sp" />
      {right}
      <span className="pill n">as at {CLIN.now.replace("T", " ")}</span>
      {pending != null && <Link href="/clinical/signoff" className="pill b" style={{ textDecoration: "none" }}>{pending} need review</Link>}
    </div>
  );
}

/** Blocks screens the signed-in role may not open, and records the attempt. */
export function Guard({ screen, children }: { screen: Screen; children: ReactNode }) {
  const st = useStore();
  const me = staffById(st.user);
  const ok = canSee(me, screen);
  const logged = useRef<string>("");
  useEffect(() => {
    if (!st.hydrated || ok) return;
    const key = me.id + screen;
    if (logged.current === key) return;
    logged.current = key;
    audit(me.name, "deny", screen, `Role ${me.cls} is not permitted to open this screen`);
  }, [st.hydrated, ok, me, screen]);
  if (!st.hydrated) return <div className="wrap mut">Loading…</div>;
  if (!ok) {
    return (
      <div className="wrap">
        <Denied why={`${me.name} (${me.role}) does not have access to this screen. Clinical and research data are separated by role.`} />
      </div>
    );
  }
  return <>{children}</>;
}
