"use client";

import Link from "next/link";
import { useState } from "react";
import { StatusChip, UrgencyChip } from "@/components/StatusChip";
import { fmtDateTime, statusLabel, timelineSteps, useReferrals } from "@/lib/referrals";

export function ReferralDetail({ id }: { id: string }) {
  const referrals = useReferrals();
  const [reply, setReply] = useState("");
  const [sent, setSent] = useState<string[]>([]);

  if (referrals === null) return <div className="container-page py-12 text-muted">Loading…</div>;
  const r = referrals.find((x) => x.id === id);
  if (!r) {
    return (
      <div className="container-page py-12">
        <h1 className="text-2xl font-bold">Referral not found</h1>
        <Link href="/portal" className="btn-secondary mt-4">Back to my referrals</Link>
      </div>
    );
  }

  const reached = new Set(r.events.map((e) => e.status));
  const currentIdx = timelineSteps.findLastIndex((s) => reached.has(s));

  return (
    <div className="container-page py-12">
      <Link href="/portal" className="text-sm font-semibold text-brand">← My referrals</Link>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold text-brand-dark">{r.id}</h1>
        <StatusChip status={r.status} />
        <UrgencyChip urgency={r.urgency} />
      </div>
      <p className="mt-1 text-muted">{r.patientName} · DOB {r.patientDob}</p>

      {/* Progress tracker */}
      <ol className="mt-8 grid grid-cols-5 gap-2" aria-label="Referral progress">
        {timelineSteps.map((s, i) => (
          <li key={s} className="text-center text-xs sm:text-sm">
            <div className={`h-2 rounded-full ${i <= currentIdx ? "bg-brand" : "bg-brand-soft"}`} />
            <p className={`mt-2 ${i === currentIdx ? "font-semibold text-brand-dark" : i < currentIdx ? "text-ink" : "text-muted"}`}>{statusLabel[s]}</p>
          </li>
        ))}
      </ol>

      {r.status === "needs_info" && (
        <div className="mt-8 rounded-xl border-2 border-warn bg-warn-soft p-5">
          <p className="font-semibold text-warn">Action needed</p>
          <p className="mt-1">{r.events.findLast((e) => e.status === "needs_info")?.note}</p>
          {sent.map((m, i) => (
            <p key={i} className="mt-3 rounded-lg bg-white p-3 text-sm"><strong>You:</strong> {m}</p>
          ))}
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input className="input" placeholder="Reply or describe attached documents…" value={reply} onChange={(e) => setReply(e.target.value)} />
            <button className="btn-primary shrink-0" disabled={!reply.trim()} onClick={() => { setSent([...sent, reply]); setReply(""); }}>Send</button>
          </div>
          <p className="mt-2 text-xs text-muted">Messages are not monitored for emergencies.</p>
        </div>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          {r.appointment && (
            <section className="card">
              <h2 className="font-semibold text-brand-dark">Appointment</h2>
              <p className="mt-2 text-lg">{fmtDateTime(r.appointment.when)}</p>
              <p className="text-muted">{r.appointment.location} · {r.appointment.clinician}</p>
            </section>
          )}

          {r.consultSummary && (
            <section className="card border-ok">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-semibold text-brand-dark">Consult summary</h2>
                <button className="btn-secondary px-3 py-1.5 text-sm" onClick={() => alert("Prototype: the signed PDF would download here.")}>Download PDF</button>
              </div>
              <p className="mt-3 whitespace-pre-line leading-relaxed">{r.consultSummary}</p>
              <p className="mt-3 text-sm text-muted">Electronically signed by {r.appointment?.clinician}</p>
            </section>
          )}

          <section className="card">
            <h2 className="font-semibold text-brand-dark">Referral details</h2>
            <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[max-content_1fr]">
              <dt className="text-muted">Reasons</dt><dd>{r.reasons.join(", ")}</dd>
              {r.woundLocation && (<><dt className="text-muted">Wound</dt><dd>{r.woundLocation}{r.woundDurationWeeks ? ` · ${r.woundDurationWeeks} weeks` : ""}</dd></>)}
              {r.wagnerGrade && (<><dt className="text-muted">Wagner grade</dt><dd>{r.wagnerGrade}</dd></>)}
              {(r.abiLeft || r.abiRight) && (<><dt className="text-muted">ABI</dt><dd>L {r.abiLeft ?? "–"} · R {r.abiRight ?? "–"}</dd></>)}
              <dt className="text-muted">Infection signs</dt><dd>{r.infectionSigns ? "Yes" : "No"}</dd>
              {r.notes && (<><dt className="text-muted">Notes</dt><dd>{r.notes}</dd></>)}
              <dt className="text-muted">Attachments</dt><dd>{r.attachments.length ? r.attachments.join(", ") : "None"}</dd>
            </dl>
          </section>
        </div>

        <section className="card h-fit">
          <h2 className="font-semibold text-brand-dark">Activity</h2>
          <ol className="mt-4 space-y-4 border-l-2 border-line pl-4">
            {[...r.events].reverse().map((e, i) => (
              <li key={i} className="relative">
                <span className="absolute -left-[23px] top-1.5 size-3 rounded-full bg-brand" aria-hidden />
                <p className="font-medium">{statusLabel[e.status]}</p>
                <p className="text-sm text-muted">{fmtDateTime(e.at)}</p>
                {e.note && <p className="mt-1 text-sm">{e.note}</p>}
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
