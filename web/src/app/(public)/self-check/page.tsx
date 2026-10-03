import type { Metadata } from "next";
import { SelfCheck } from "./SelfCheck";

export const metadata: Metadata = { title: "Should I see a specialist?" };

export default function SelfCheckPage() {
  return (
    <div className="container-page max-w-2xl py-12">
      <p className="eyebrow">2-minute self-check</p>
      <h1 className="mt-2 text-3xl font-bold text-brand-dark">Should I see a wound or vascular specialist?</h1>
      <p className="mt-3 text-muted">
        Answer a few yes/no questions. This is general guidance to help you decide on next steps. It is not a diagnosis.
        Your answers are not saved.
      </p>
      <SelfCheck />
    </div>
  );
}
