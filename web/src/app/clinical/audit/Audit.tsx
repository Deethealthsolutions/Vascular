"use client";

import { useState } from "react";
import { Guard, Top } from "@/components/cx/Shell";
import { Card, Disc, Kpis, Pill } from "@/components/cx/ui";
import { useStore, type AuditEntry } from "@/lib/cx/store";

const TONE: Record<AuditEntry["action"], string> = { read: "b", write: "g", sign: "v", deny: "r", export: "a", ai: "v", return: "a" };

export function Audit({ subject }: { subject: string }) {
  return (
    <Guard screen="audit">
      <Top title="Access audit" sub="Every read, write, signature, export, AI action and refusal · patient access report" />
      <div className="wrap"><Body initial={subject} /></div>
    </Guard>
  );
}

function Body({ initial }: { initial: string }) {
  const st = useStore();
  const [q, setQ] = useState(initial);
  const [act, setAct] = useState<string>("all");
  const rows = st.audit.filter((a) => (act === "all" || a.action === act) && (!q || `${a.subject} ${a.user} ${a.detail}`.toLowerCase().includes(q.toLowerCase())));
  const count = (k: AuditEntry["action"]) => st.audit.filter((a) => a.action === k).length;
  const people = q ? Array.from(new Set(rows.filter((r) => r.action === "read" || r.action === "ai").map((r) => r.user))) : [];

  function csv() {
    const lines = [["at", "user", "action", "subject", "detail"], ...rows.map((r) => [r.at, r.user, r.action, r.subject, r.detail])]
      .map((l) => l.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(","));
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = `access-audit${q ? "-" + q : ""}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <Disc>This log covers actions taken in this browser session of the prototype. In production the log is written server-side by the API gateway for every caller — UI, integration or AI agent — and retained under the medico-legal policy.</Disc>
      <Kpis cols={6} items={[
        { k: "Events", v: st.audit.length }, { k: "Reads", v: count("read") }, { k: "Writes", v: count("write") },
        { k: "Signatures", v: count("sign") }, { k: "AI actions", v: count("ai") }, { k: "Refused", v: count("deny"), tone: count("deny") ? "bad" : "" },
      ]} />
      <div className="filt">
        <div className="fg"><span className="fl">Search</span><input className="gsearch" style={{ minWidth: 260 }} placeholder="Patient ID, name, staff member…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="fg"><span className="fl">Action</span>
          <div className="seg">{["all", "read", "write", "sign", "ai", "export", "deny"].map((a) => <button key={a} className={act === a ? "on" : ""} onClick={() => setAct(a)}>{a}</button>)}</div>
        </div>
        <div style={{ flex: 1 }} />
        <button className="btn sm" onClick={csv} disabled={!rows.length}>Download CSV</button>
      </div>

      {q && (
        <Card title={`Patient access report — ${q}`} hint="who has looked at this record, including AI agents" className="mb14">
          {people.length ? <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>{people.map((p) => <Pill key={p} c="b">{p}</Pill>)}</div> : <div className="sm mut">No reads recorded for this search yet.</div>}
        </Card>
      )}

      <Card title="Event log" hint="most recent first" right={<Pill>{rows.length}</Pill>}>
        {rows.length === 0 ? <div className="sm mut">No events yet. Open a patient chart, save observations or sign something, then come back.</div> : (
          <table className="t">
            <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Subject</th><th>Detail</th></tr></thead>
            <tbody>
              {rows.slice(0, 300).map((r, i) => (
                <tr key={i}><td className="num xs mut">{r.at.replace("T", " ").slice(0, 19)}</td><td className="sm">{r.user}</td>
                  <td><Pill c={TONE[r.action]}>{r.action}</Pill></td><td className="sm">{r.subject}</td><td className="sm mut">{r.detail}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
