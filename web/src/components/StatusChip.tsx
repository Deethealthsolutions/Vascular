import { statusLabel, type ReferralStatus } from "@/lib/referrals";

const styles: Record<ReferralStatus, string> = {
  received: "bg-surface text-ink border border-line",
  under_review: "bg-brand-soft text-brand-dark",
  needs_info: "bg-warn-soft text-warn",
  scheduled: "bg-brand text-white",
  seen: "bg-ok-soft text-ok",
  summary_sent: "bg-ok text-white",
  declined: "bg-alert-soft text-alert",
};

export function StatusChip({ status }: { status: ReferralStatus }) {
  return <span className={`chip whitespace-nowrap ${styles[status]}`}>{statusLabel[status]}</span>;
}

export function UrgencyChip({ urgency }: { urgency: "routine" | "urgent" }) {
  return urgency === "urgent" ? (
    <span className="chip bg-alert-soft text-alert">Urgent</span>
  ) : (
    <span className="chip bg-surface text-muted">Routine</span>
  );
}
