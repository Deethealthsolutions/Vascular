"use client";

import Link from "next/link";
import { Guard, Top } from "@/components/cx/Shell";
import { Card, Disc, Kpis, Pill } from "@/components/cx/ui";
import { CATS, RULES } from "@/lib/cx/data";

const PID2WID: Record<string, string> = { "P-4408": "W-2201", "P-4412": "W-2318", "P-4425": "W-2340" };

export default function AutoPage() {
  const st = { live: 0, pilot: 0, roadmap: 0 } as Record<string, number>;
  RULES.forEach((r) => st[r.status]++);
  return (
    <Guard screen="auto">
      <Top title="Automation catalogue" sub="What the system does without being asked" />
      <div className="wrap">
        <Kpis items={[
          { k: "Rules catalogued", v: RULES.length, d: `across ${CATS.length} categories` }, { k: "Modelled end to end", v: st.live, d: "demonstrated in this prototype", tone: "good" },
          { k: "Designed, pilot", v: st.pilot, d: "shown as stubs", tone: "warn" }, { k: "Specified only", v: st.roadmap, d: "roadmap" },
        ]} />
        <Disc>Every rule replaces a judgement that currently depends on who is on shift. None replaces the clinician: each raises something for a human to act on, and the ones that touch prescribing require an explicit override reason rather than silently changing an order.</Disc>
        {CATS.map(([cat, name, hint]) => {
          const rs = RULES.filter((r) => r.cat === cat);
          return (
            <Card key={cat} title={name} hint={hint} right={<Pill>{rs.length}</Pill>} className="mb14" bodyClass={null}>
              {rs.map((r) => (
                <div key={r.id} className="rule">
                  <div className="rule-h">
                    <span className="id">{r.id}</span><span className="nm">{r.name}</span>
                    <Pill c={({ live: "g", pilot: "v", roadmap: "n" } as Record<string, string>)[r.status]}>{r.status}</Pill><Pill>value {r.value}</Pill>
                    {"demo" in r && r.demo && (r.cat === "wound" && PID2WID[r.demo]
                      ? <Link className="btn sm" href={`/clinical/wound?wid=${PID2WID[r.demo]}`}>See {PID2WID[r.demo]}</Link>
                      : <Link className="btn sm" href={`/clinical/patient/${r.demo}`}>See {r.demo}</Link>)}
                  </div>
                  <div className="rule-g">
                    {"trigger" in r && r.trigger && <><span className="k">Trigger</span><span className="v">{r.trigger}</span></>}
                    {"logic" in r && r.logic && <><span className="k">Logic</span><span className="v">{r.logic}</span></>}
                    {r.action && <><span className="k">Action</span><span className="v">{r.action}</span></>}
                    {r.today && <><span className="k">Today</span><span className="v now">{r.today}</span></>}
                  </div>
                </div>
              ))}
            </Card>
          );
        })}
      </div>
    </Guard>
  );
}
