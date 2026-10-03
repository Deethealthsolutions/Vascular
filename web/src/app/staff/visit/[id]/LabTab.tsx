"use client";

import { useState } from "react";
import { Section, Small } from "@/components/staff/ui";
import { by, computeAbi, interpretAbi, moveStage, updateVisit, type AbiResult, type StaffUser, type Visit } from "@/lib/clinic";
import type { Tab } from "./VisitChart";

const empty: AbiResult = { brachialL: "", brachialR: "", dpL: "", ptL: "", dpR: "", ptR: "", toeL: "", toeR: "" };
const toneClass = { ok: "text-ok", warn: "text-warn", alert: "text-alert", muted: "text-muted" };

export function LabTab({ v, me, go }: { v: Visit; me: StaffUser; go: (t: Tab) => void }) {
  const [r, setR] = useState<AbiResult>(v.abi ?? empty);
  const set = (k: keyof AbiResult) => (val: string) => setR({ ...r, [k]: val });
  const abi = computeAbi(r);
  const complete = abi.left !== undefined && abi.right !== undefined;
  const ordered = v.plan?.orders.includes("ABI / TBI");

  const summary = () =>
    `ABI R ${abi.right?.toFixed(2)} (${interpretAbi(abi.right).label}), L ${abi.left?.toFixed(2)} (${interpretAbi(abi.left).label})` +
    (abi.tbiRight || abi.tbiLeft ? `; TBI R ${abi.tbiRight?.toFixed(2) ?? "–"}, L ${abi.tbiLeft?.toFixed(2) ?? "–"}` : "");

  if (!ordered && !v.abi) {
    return <Section title="Vascular lab"><p className="text-muted">No vascular studies ordered for this visit.</p></Section>;
  }

  return (
    <div className="space-y-5">
      <Section title="Ankle-brachial index / toe-brachial index" aside={<span className="text-sm text-muted">Pressures in mmHg</span>}>
        <div className="grid gap-6 lg:grid-cols-2">
          {(["R", "L"] as const).map((side) => {
            const val = side === "L" ? abi.left : abi.right;
            const tbi = side === "L" ? abi.tbiLeft : abi.tbiRight;
            const i = interpretAbi(val);
            return (
              <div key={side} className="rounded-xl border border-line p-4">
                <p className="font-semibold">{side === "R" ? "Right" : "Left"}</p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <Small label="Brachial" value={side === "L" ? r.brachialL : r.brachialR} onChange={set(side === "L" ? "brachialL" : "brachialR")} />
                  <span />
                  <Small label="Dorsalis pedis" value={side === "L" ? r.dpL : r.dpR} onChange={set(side === "L" ? "dpL" : "dpR")} />
                  <Small label="Posterior tibial" value={side === "L" ? r.ptL : r.ptR} onChange={set(side === "L" ? "ptL" : "ptR")} />
                  <Small label="Great toe" value={side === "L" ? r.toeL : r.toeR} onChange={set(side === "L" ? "toeL" : "toeR")} />
                </div>
                <div className="mt-4 flex items-end justify-between rounded-lg bg-surface p-3">
                  <div>
                    <p className="text-xs text-muted">ABI</p>
                    <p className="text-3xl font-bold text-brand-dark">{val?.toFixed(2) ?? "–"}</p>
                  </div>
                  <p className={`text-lg font-semibold ${toneClass[i.tone]}`}>{i.label}</p>
                  <div className="text-right">
                    <p className="text-xs text-muted">TBI</p>
                    <p className={`text-xl font-bold ${tbi !== undefined && tbi < 0.7 ? "text-alert" : "text-brand-dark"}`}>{tbi?.toFixed(2) ?? "–"}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-sm text-muted">
          ABI = higher ankle pressure (DP or PT) ÷ higher brachial pressure of both arms. ≤ 0.90 PAD · &gt; 1.40 non-compressible (rely on TBI; TBI &lt; 0.70 abnormal).
        </p>
      </Section>

      <div className="flex flex-wrap justify-end gap-3">
        <button className="btn-secondary" onClick={() => updateVisit(v.id, (x) => ({ ...x, abi: r }))}>Save draft</button>
        {v.stage === "lab" ? (
          <button className="btn-primary" disabled={!complete}
            onClick={() => { moveStage(v.id, "provider", `Vascular lab resulted: ${summary()}. Returned to provider`, by(me), { abi: r }); go("provider"); }}>
            Result &amp; return to provider →
          </button>
        ) : (
          <button className="btn-primary" disabled={!complete} onClick={() => { updateVisit(v.id, (x) => ({ ...x, abi: r })); go("provider"); }}>
            Save results
          </button>
        )}
      </div>
    </div>
  );
}
