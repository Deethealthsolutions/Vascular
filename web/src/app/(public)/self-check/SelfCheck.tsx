"use client";

import Link from "next/link";
import { useState } from "react";
import { site } from "@/lib/site";

type Kind = "emergency" | "specialist";
type Question = { id: string; text: string; hint?: string; kind: Kind };

// Emergency questions first so red flags stop the flow immediately (SPEC §4.2, §7.5).
const questions: Question[] = [
  { id: "fever", kind: "emergency", text: "Do you have a wound AND a fever, chills, or redness that is spreading quickly?" },
  { id: "acute", kind: "emergency", text: "Has one leg or foot suddenly become cold, pale, numb or very painful?" },
  { id: "duration", kind: "specialist", text: "Do you have a wound on your foot or leg that hasn't improved in 2 weeks?" },
  { id: "diabetes", kind: "specialist", text: "Do you have diabetes AND any sore, blister, crack or color change on your foot?" },
  { id: "claudication", kind: "specialist", text: "Do you get pain, cramping or tiredness in your legs when walking that goes away with rest?" },
  { id: "rest", kind: "specialist", text: "Do you have foot pain at night that gets better when you hang your leg off the bed?", hint: "This can be a sign of severely reduced blood flow." },
  { id: "dark", kind: "specialist", text: "Is any skin on your toes or foot turning dark, purple or black?" },
  { id: "radiation", kind: "specialist", text: "Do you have a wound or exposed bone in an area that was treated with radiation?" },
];

type Result = "emergency" | "specialist" | "discuss";

export function SelfCheck() {
  const [step, setStep] = useState(0);
  const [yes, setYes] = useState<string[]>([]);
  const [result, setResult] = useState<Result | null>(null);

  function answer(isYes: boolean) {
    const q = questions[step];
    const nextYes = isYes ? [...yes, q.id] : yes;
    setYes(nextYes);
    if (isYes && q.kind === "emergency") return setResult("emergency");
    if (step + 1 < questions.length) return setStep(step + 1);
    setResult(nextYes.length > 0 ? "specialist" : "discuss");
  }

  function restart() {
    setStep(0);
    setYes([]);
    setResult(null);
  }

  if (result) return <ResultView result={result} yes={yes} onRestart={restart} />;

  const q = questions[step];
  return (
    <div className="card mt-8">
      <div className="flex items-center justify-between text-sm text-muted">
        <span>Question {step + 1} of {questions.length}</span>
        {step > 0 && (
          <button className="font-semibold text-brand" onClick={() => { setStep(step - 1); setYes(yes.filter((id) => id !== questions[step - 1].id)); }}>
            ← Back
          </button>
        )}
      </div>
      <div className="mt-2 h-2 rounded-full bg-brand-soft" role="progressbar" aria-valuenow={step + 1} aria-valuemin={1} aria-valuemax={questions.length}>
        <div className="h-2 rounded-full bg-brand transition-all" style={{ width: `${((step + 1) / questions.length) * 100}%` }} />
      </div>
      <p className="mt-6 text-xl font-semibold" aria-live="polite">{q.text}</p>
      {q.hint && <p className="mt-2 text-muted">{q.hint}</p>}
      <div className="mt-6 grid grid-cols-2 gap-3">
        <button className="btn-primary text-lg" onClick={() => answer(true)}>Yes</button>
        <button className="btn-secondary text-lg" onClick={() => answer(false)}>No</button>
      </div>
    </div>
  );
}

function ResultView({ result, yes, onRestart }: { result: Result; yes: string[]; onRestart: () => void }) {
  const wantsHbot = yes.includes("radiation");
  return (
    <div className="mt-8 space-y-4" aria-live="polite">
      {result === "emergency" && (
        <div className="rounded-xl border-2 border-alert bg-alert-soft p-6 text-alert">
          <p className="text-2xl font-bold">Get emergency care now</p>
          <p className="mt-2 text-ink">
            Your answer describes symptoms that can be an emergency, such as a serious infection or a sudden blockage of blood flow.
            <strong> Call 911 or go to the nearest emergency room.</strong> Don&apos;t wait for an appointment.
          </p>
          <a href="tel:911" className="btn mt-4 bg-alert text-white hover:opacity-90">Call 911</a>
        </div>
      )}
      {result === "specialist" && (
        <div className="rounded-xl border-2 border-brand bg-brand-soft p-6">
          <p className="text-2xl font-bold text-brand-dark">We recommend seeing a specialist</p>
          <p className="mt-2">
            Your answers include signs that often mean a wound or circulation problem that benefits from specialist care.
            Getting seen early makes healing more likely.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href={`/book?visit=${wantsHbot ? "hbot" : "wound"}`} className="btn-primary">Book a visit</Link>
            <a href={`tel:${site.phone}`} className="btn-secondary">Call {site.phone}</a>
          </div>
          <p className="mt-4 text-sm text-muted">If things get worse (fever, spreading redness, severe pain), seek emergency care.</p>
        </div>
      )}
      {result === "discuss" && (
        <div className="card">
          <p className="text-2xl font-bold text-brand-dark">No warning signs reported</p>
          <p className="mt-2">
            Keep up regular checkups. If you have diabetes, check your feet every day, and ask your doctor about a yearly foot exam
            and an ankle-brachial index (ABI) test if you have risk factors for PAD.
          </p>
          <Link href="/conditions" className="btn-secondary mt-4">Learn about warning signs</Link>
        </div>
      )}
      <p className="text-sm text-muted">This self-check gives general information and is not a medical diagnosis.</p>
      <button onClick={onRestart} className="font-semibold text-brand">Start over</button>
    </div>
  );
}
