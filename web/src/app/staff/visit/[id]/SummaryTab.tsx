"use client";

import { Section } from "@/components/staff/ui";
import { fmtTime, visitTypeLabel, woundArea, type Visit } from "@/lib/clinic";

const consentName: Record<string, string> = {
  treat: "Consent to treat", hipaa: "Privacy notice", financial: "Financial responsibility", photo: "Wound photography", hbot: "HBOT consent",
};

export function SummaryTab({ v }: { v: Visit }) {
  const p = v.patient;
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
      <div className="space-y-5">
        <Section title="Registration">
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[max-content_1fr]">
            <dt className="text-muted">Visit</dt><dd>{visitTypeLabel[v.visitType]} · {v.arrivalMode} · {v.mobility}</dd>
            <dt className="text-muted">Chief complaint</dt><dd className="font-medium">{v.chiefComplaint}</dd>
            {p.referralId && (<><dt className="text-muted">Referral</dt><dd>{p.referralId} from {p.referredBy}</dd></>)}
            <dt className="text-muted">Contact</dt><dd>{p.phone} · {p.address || "–"}</dd>
            <dt className="text-muted">Insurance</dt>
            <dd>
              {p.payer} · {p.memberId} · <span className={v.eligibility.status === "verified" ? "text-ok" : "text-warn"}>{v.eligibility.status}</span>
              {v.eligibility.copay && ` · copay ${v.eligibility.copay}`}
              {v.eligibility.priorAuth && <span className="block font-semibold text-warn">⚠ {v.eligibility.priorAuth}</span>}
            </dd>
            <dt className="text-muted">Consents signed</dt>
            <dd className="flex flex-wrap gap-1">{v.consents.map((c) => <span key={c} className="chip bg-ok-soft text-xs text-ok">✓ {consentName[c] ?? c}</span>)}</dd>
          </dl>
        </Section>

        <Section title="Clinical snapshot">
          {!v.vitals && v.wounds.length === 0 && !v.plan ? (
            <p className="text-muted">Nothing documented yet. Triage has not started.</p>
          ) : (
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[max-content_1fr]">
              {v.vitals && (<><dt className="text-muted">Vitals</dt><dd>BP {v.vitals.bp} · HR {v.vitals.hr} · T {v.vitals.temp}°C · SpO₂ {v.vitals.spo2}%{v.vitals.glucose && ` · BG ${v.vitals.glucose}`} · Pain {v.vitals.pain}/10</dd></>)}
              {v.pulses && (<><dt className="text-muted">Pedal pulses</dt><dd>L DP {v.pulses.dpL || "–"} / PT {v.pulses.ptL || "–"} · R DP {v.pulses.dpR || "–"} / PT {v.pulses.ptR || "–"}</dd></>)}
              {v.wounds.map((w, i) => (
                <div key={w.id} className="contents"><dt className="text-muted">Wound {i + 1}</dt><dd>{w.location}: {w.lengthCm}×{w.widthCm}×{w.depthCm} cm ({woundArea(w)} cm²), {w.etiology}</dd></div>
              ))}
              {v.plan?.assessment && (<><dt className="text-muted">Assessment</dt><dd>{v.plan.assessment}</dd></>)}
              {!!v.plan?.orders.length && (<><dt className="text-muted">Orders</dt><dd>{v.plan.orders.join(", ")}</dd></>)}
            </dl>
          )}
        </Section>
      </div>

      <Section title="Visit timeline">
        <ol className="space-y-4 border-l-2 border-line pl-4">
          {[...v.log].reverse().map((e, i) => (
            <li key={i} className="relative">
              <span className="absolute -left-[23px] top-1.5 size-3 rounded-full bg-brand" aria-hidden />
              <p className="text-sm font-medium">{e.text}</p>
              <p className="text-xs text-muted">{fmtTime(e.at)} · {e.by}</p>
            </li>
          ))}
        </ol>
      </Section>
    </div>
  );
}
