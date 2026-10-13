import type { Metadata } from "next";
import { QuickVisit } from "./QuickVisit";

export const metadata: Metadata = { title: "Quick visit" };

// Access is enforced by the proxy (lib/auth/access.ts) and again by the database on every call.
export default function QuickVisitPage() {
  return <QuickVisit />;
}
