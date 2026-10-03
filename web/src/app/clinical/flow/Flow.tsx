"use client";

// Today's patient flow. Read at a glance: a journey pipeline (count per stage, coloured by the
// longest wait), a slim summary, one lane of compact patient chips per busy stage (wait bar
// fills towards the stage limit; edge colour = triage category), a "needs attention" list for
// anyone over or near their limit, and a stacked bar of how today's finished visits ended.

import Link from "next/link";
import { useState, type CSSProperties } from "react";
import { Guard, Top, useMe } from "@/components/cx/Shell";
import { useStore, type Registration } from "@/lib/cx/store";

const minsSince = (at?: string) => (at ? Math.max(0, Math.round((Date.now() - Date.parse(at)) / 60000)) : 0);
const minsBetween = (a?: string, b?: string) => (a && b ? Math.max(0, Math.round((Date.parse(b) - Date.parse(a)) / 60000)) : null);
const median = (xs: number[]) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const first = (name: string) => name.replace(/^(Dr|Sr)\.\s*/, "").split(" ")[0];

type Stage = { id: string; label: string; short: string; statuses: Registration["status"][]; href: string; warn: number; bad: number };
const STAGES: Stage[] = [
  { id: "wait", label: "Waiting for nurse", short: "Waiting", statuses: ["waiting for assessment"], href: "/clinical/triage", warn: 20, bad: 40 },
  { id: "assess", label: "Nursing assessment", short: "Nurse", statuses: ["in assessment"], href: "/clinical/triage", warn: 20, bad: 35 },
  { id: "ready", label: "Waiting for doctor", short: "For doctor", statuses: ["ready for doctor"], href: "/clinical/consult", warn: 30, bad: 60 },
  { id: "doctor", label: "With doctor", short: "Doctor", statuses: ["with doctor"], href: "/clinical/consult", warn: 25, bad: 45 },
  { id: "tests", label: "At tests", short: "Tests", statuses: ["at tests"], href: "/clinical/services", warn: 60, bad: 120 },
  { id: "proc", label: "Dressing room / procedure", short: "Procedure", statuses: ["for procedure"], href: "/clinical/services", warn: 45, bad: 90 },
  { id: "bed", label: "Waiting for a bed", short: "Bed", statuses: ["awaiting admission"], href: "/clinical/admit", warn: 60, bad: 120 },
  { id: "checkout", label: "Checkout", short: "Checkout", statuses: ["to checkout"], href: "/clinical/checkout", warn: 15, bad: 30 },
];
const OUTCOMES: { status: Registration["status"]; label: string; color: string }[] = [
  { status: "checked out", label: "Home", color: "var(--green)" },
  { status: "admitted", label: "Admitted", color: "var(--orange)" },
  { status: "sent to emergency", label: "Emergency", color: "var(--red)" },
  { status: "left without being seen", label: "Left", color: "var(--ink4)" },
];
const DONE = OUTCOMES.map((o) => o.status);
const CAT_COLOR: Record<string, string> = { Emergency: "var(--red)", Urgent: "var(--orange)", Standard: "var(--amber)", Routine: "var(--green)" };

/** When the patient entered the current stage: the last history event, or arrival. */
const stageSince = (r: Registration) => (r.history?.length ? r.history[r.history.length - 1].at : r.at);
type Tone = "ok" | "warn" | "bad";
const toneOf = (m: number, s: Stage): Tone => (m > s.bad ? "bad" : m > s.warn ? "warn" : "ok");

export function Flow() {
  return (
    <Guard screen="flow">
      <Top title="Today's patient flow" sub="Where every patient is, and who has waited too long" />
      <Body />
    </Guard>
  );
}

function Body() {
  const me = useMe();
  const st = useStore();
  const [focus, setFocus] = useState<string | null>(null);
  const regs = st.registrations.filter((r) => me.centres.includes(r.centre as never));
  const active = regs.filter((r) => !DONE.includes(r.status));
  const done = regs.filter((r) => DONE.includes(r.status));

  const lanes = STAGES.map((s) => {
    const people = active.filter((r) => s.statuses.includes(r.status))
      .map((r) => ({ r, m: minsSince(stageSince(r)) }))
      .sort((a, b) => b.m - a.m);
    const worst: Tone | "empty" = people.length ? toneOf(people[0].m, s) : "empty";
    return { s, people, worst };
  });
  const attention = lanes.flatMap((l) => l.people.filter((p) => toneOf(p.m, l.s) !== "ok").map((p) => ({ ...p, s: l.s, tone: toneOf(p.m, l.s) })))
    .sort((a, b) => (b.m - b.s.bad) - (a.m - a.s.bad));

  const doorToDoctor = median(regs.map((r) => minsBetween(r.at, r.seenAt)).filter((x): x is number => x != null));
  const stay = median(done.filter((r) => r.checkout).map((r) => minsBetween(r.at, r.checkout!.at)).filter((x): x is number => x != null));
  const over = attention.filter((a) => a.tone === "bad"), near = attention.filter((a) => a.tone === "warn");
  const stuck = over.length;

  function jump(id: string) {
    setFocus(id);
    setTimeout(() => document.getElementById(`lane-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 30);
  }

  return (
    <>
      {/* summary strip */}
      <div className="fl-sum mb14">
        <Stat label="In the building" value={active.length} note={`${regs.length} registered today`} />
        <Stat label="Door to doctor" value={doorToDoctor != null ? `${doorToDoctor}′` : "—"} note="median · target 60′" gauge={doorToDoctor != null ? { v: doorToDoctor, max: 90, mark: 60 } : undefined} />
        <Stat label="Length of visit" value={stay != null ? `${stay}′` : "—"} note="median, arrival → checkout" />
        <Stat label="Over the limit" value={stuck} note={stuck ? "need action now" : "nobody stuck"} tone={stuck ? "bad" : "ok"} />
      </div>

      {/* journey pipeline */}
      <div className="card mb14">
        <div className="fl-pipe" role="list" aria-label="Patients by stage">
          {lanes.map(({ s, people, worst }) => (
            <button key={s.id} role="listitem" className={`fl-node ${worst}${focus === s.id ? " on" : ""}`} onClick={() => jump(s.id)} disabled={!people.length}
              aria-label={`${s.label}: ${people.length} patient${people.length === 1 ? "" : "s"}${people.length ? `, longest ${people[0].m} minutes` : ""}`}>
              <span className="fl-dot">{people.length}</span>
              <span className="fl-lab">{s.short}</span>
              <span className="fl-sub">{people.length ? `${people[0].m}′ longest` : "—"}</span>
            </button>
          ))}
          <div className="fl-node end" role="listitem" aria-label={`${done.length} finished`}>
            <span className="fl-dot">✓</span><span className="fl-lab">Finished</span><span className="fl-sub">{done.length} today</span>
          </div>
        </div>
        <div className="fl-legend">
          <span><i className="lg ok" /> within limit</span><span><i className="lg warn" /> getting long</span><span><i className="lg bad" /> over the limit</span>
          <span className="sp" />
          <span><i className="lg edge" /> chip edge = triage category</span>
        </div>
      </div>

      <div className="fl-main">
        {/* lanes */}
        <div>
          {active.length === 0 && <div className="card card-b sm mut mb14">Nobody is in the building. Patients appear here from registration onwards.</div>}
          {lanes.filter((l) => l.people.length).map(({ s, people, worst }) => (
            <section key={s.id} id={`lane-${s.id}`} className={`card fl-lane mb14${focus === s.id ? " on" : ""}`}>
              <div className="fl-lane-h">
                <span className={`fl-dot sm ${worst}`}>{people.length}</span>
                <h3>{s.label}</h3>
                <span className="xs mut">limit {s.bad}′</span>
                <Link href={s.href} className="fl-open">Open screen →</Link>
              </div>
              <div className="fl-chips">
                {people.map(({ r, m }) => {
                  const tone = toneOf(m, s);
                  const cat = r.triage?.category;
                  return (
                    <Link key={r.id} href={s.href} className={`fl-chip ${tone}`} style={{ "--cat": cat ? CAT_COLOR[cat] : "var(--line2)" } as CSSProperties}
                      title={`${r.token} ${r.name} · ${r.age}${r.sex[0]} · ${r.queueLabel}${cat ? ` · ${cat}` : ""}${r.room ?? r.bay ? ` · ${r.room ?? r.bay}` : ""} · ${m} min in this stage · ${minsSince(r.at)} min since arrival`}>
                      <span className="tok">{r.token}</span>
                      <span className="nm">{first(r.name)}</span>
                      <span className="min">{m}′</span>
                      <span className="bar" aria-hidden><i style={{ width: `${Math.min(100, (m / s.bad) * 100)}%` }} /><b style={{ left: `${(s.warn / s.bad) * 100}%` }} /></span>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        {/* attention + finished */}
        <div className="fl-side">
          <section className="card mb14">
            <div className="card-h"><h3>Needs attention</h3><div className="sp" />{attention.length > 0 && <span className={`fl-dot sm ${stuck ? "bad" : "warn"}`} title={stuck ? "over the limit" : "getting long"}>{stuck || near.length}</span>}</div>
            <div className="card-b">
              {attention.length === 0 ? (
                <div className="fl-allgood"><span className="fl-dot sm ok">✓</span> Everyone is within their stage limit.</div>
              ) : (
                <>
                  {over.map(({ r, m, s }) => (
                    <Link key={r.id} href={s.href} className="fl-att">
                      <span className="fl-who"><b className="num">{r.token}</b> {first(r.name)}</span>
                      <span className="fl-what">{s.label}</span>
                      <span className="fl-when">{m}′<small>+{m - s.bad}′ over</small></span>
                    </Link>
                  ))}
                  {near.length > 0 && (
                    <>
                      <div className="fl-near-h"><span className="lg warn" />Getting long · {near.length}</div>
                      <div className="fl-near">
                        {near.map(({ r, m, s }) => (
                          <Link key={r.id} href={s.href} title={`${r.name} · ${s.label} · ${m} min (limit ${s.bad})`}><b className="num">{r.token}</b> {m}′</Link>
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </section>

          <section className="card">
            <div className="card-h"><h3>Finished today</h3><div className="sp" /><b className="num">{done.length}</b></div>
            <div className="card-b">
              {done.length === 0 ? <div className="sm mut">Nobody yet.</div> : (
                <>
                  <div className="fl-stack" role="img" aria-label={OUTCOMES.map((o) => `${done.filter((r) => r.status === o.status).length} ${o.label.toLowerCase()}`).join(", ")}>
                    {OUTCOMES.map((o) => { const n = done.filter((r) => r.status === o.status).length; return n ? <i key={o.status} style={{ flex: n, background: o.color }} title={`${o.label}: ${n}`} /> : null; })}
                  </div>
                  <div className="fl-stack-l">
                    {OUTCOMES.map((o) => <span key={o.status}><i style={{ background: o.color }} />{o.label} <b>{done.filter((r) => r.status === o.status).length}</b></span>)}
                  </div>
                  <details className="fl-det">
                    <summary>Show patients</summary>
                    {done.map((r) => {
                      const o = OUTCOMES.find((x) => x.status === r.status)!;
                      return <div key={r.id} className="fl-done"><i style={{ background: o.color }} /><b className="num">{r.token}</b> {r.name}<span className="mut">{minsBetween(r.at, stageSince(r)) ?? "—"}′</span></div>;
                    })}
                  </details>
                </>
              )}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

function Stat({ label, value, note, tone, gauge }: { label: string; value: string | number; note: string; tone?: Tone; gauge?: { v: number; max: number; mark: number } }) {
  return (
    <div className={`fl-stat${tone ? ` ${tone}` : ""}`}>
      <div className="k">{label}</div>
      <div className="v">{value}</div>
      {gauge && (
        <div className="fl-gauge" aria-hidden>
          <i style={{ width: `${Math.min(100, (gauge.v / gauge.max) * 100)}%`, background: gauge.v > gauge.mark ? "var(--amber)" : "var(--teal)" }} />
          <b style={{ left: `${(gauge.mark / gauge.max) * 100}%` }} />
        </div>
      )}
      <div className="n">{note}</div>
    </div>
  );
}
