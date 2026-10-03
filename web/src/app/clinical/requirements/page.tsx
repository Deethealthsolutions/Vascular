"use client";

import Link from "next/link";
import { useState } from "react";
import { Guard, Top } from "@/components/cx/Shell";
import { Card, Disc, Kpis, Pill } from "@/components/cx/ui";
import { REQS, STATUS_PILL, type Status } from "@/lib/cx/requirements";

export default function RequirementsPage() {
  const [only, setOnly] = useState<"all" | "gaps">("all");
  const count = (k: "mockup" | "build", s: Status) => REQS.filter((r) => r[k] === s).length;
  const areas = Array.from(new Set(REQS.map((r) => r.area)));
  const rows = REQS.filter((r) => only === "all" || r.mockup !== "met" || r.build !== "met");
  return (
    <Guard screen="requirements">
      <Top title="Requirements coverage" sub="Hospital_Development_Requirements.html compared with the HTML mockup and this build" />
      <div className="wrap">
        <Disc><b>How to read this.</b> &quot;Mockup&quot; is the single-file prototype you supplied; &quot;This build&quot; is the React workspace you are using. A requirement is <b>met</b> only when the behaviour works in the UI, not when it is described. Phase 5 items (data lake, MCP, RAG) are architecture only by design.</Disc>
        <div className="grid2 mb14">
          <Kpis cols={4} items={[
            { k: "Mockup · met", v: count("mockup", "met"), d: `of ${REQS.length}` }, { k: "Mockup · partial", v: count("mockup", "partial"), tone: "warn" },
            { k: "Mockup · missing", v: count("mockup", "missing"), tone: "bad" }, { k: "Future phase", v: count("mockup", "future") },
          ]} />
          <Kpis cols={4} items={[
            { k: "This build · met", v: count("build", "met"), d: `of ${REQS.length}`, tone: "good" }, { k: "This build · partial", v: count("build", "partial"), tone: "warn" },
            { k: "This build · missing", v: count("build", "missing"), tone: count("build", "missing") ? "bad" : "good" }, { k: "Future phase", v: count("build", "future") },
          ]} />
        </div>
        <div className="filt">
          <div className="fg"><span className="fl">Show</span><div className="seg"><button className={only === "all" ? "on" : ""} onClick={() => setOnly("all")}>All requirements</button><button className={only === "gaps" ? "on" : ""} onClick={() => setOnly("gaps")}>Only where either is not met</button></div></div>
        </div>
        {areas.map((a) => {
          const rs = rows.filter((r) => r.area === a);
          if (!rs.length) return null;
          return (
            <Card key={a} title={a} className="mb14">
              <table className="t">
                <thead><tr><th style={{ width: 120 }}>ID</th><th>Requirement</th><th style={{ width: "22%" }}>Mockup</th><th style={{ width: "30%" }}>This build</th></tr></thead>
                <tbody>
                  {rs.map((r) => (
                    <tr key={r.id}>
                      <td className="num xs"><b>{r.id}</b></td>
                      <td className="sm">{r.text}{r.href && <div><Link className="xs" href={r.href}>open ↗</Link></div>}</td>
                      <td><Pill c={STATUS_PILL[r.mockup][0]}>{STATUS_PILL[r.mockup][1]}</Pill>{r.mockupNote && <div className="xs mut" style={{ marginTop: 4 }}>{r.mockupNote}</div>}</td>
                      <td><Pill c={STATUS_PILL[r.build][0]}>{STATUS_PILL[r.build][1]}</Pill>{r.buildNote && <div className="xs mut" style={{ marginTop: 4 }}>{r.buildNote}</div>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          );
        })}
      </div>
    </Guard>
  );
}
