import type { Metadata } from "next";
import { Signoff } from "./Signoff";

export const metadata: Metadata = { title: "Review & sign-off" };

export default function SignoffPage() {
  return <Signoff />;
}
