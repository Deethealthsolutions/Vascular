import type { Metadata } from "next";
import { Triage } from "./Triage";

export const metadata: Metadata = { title: "Initial nursing assessment" };

export default function TriagePage() {
  return <Triage />;
}
