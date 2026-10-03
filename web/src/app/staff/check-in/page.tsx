import type { Metadata } from "next";
import { CheckInWizard } from "./CheckInWizard";

export const metadata: Metadata = { title: "Check in patient" };

export default function CheckInPage() {
  return <CheckInWizard />;
}
