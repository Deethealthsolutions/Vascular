import type { Metadata } from "next";
import { ReferralDashboard } from "./ReferralDashboard";

export const metadata: Metadata = { title: "Referral portal" };

export default function PortalPage() {
  return <ReferralDashboard />;
}
