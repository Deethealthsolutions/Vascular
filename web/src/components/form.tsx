"use client";

import { useId } from "react";

export function Field({
  label, value, onChange, type = "text", required, placeholder, hint,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; required?: boolean; placeholder?: string; hint?: string;
}) {
  const id = useId();
  return (
    <div>
      <label className="label" htmlFor={id}>
        {label} {required && <span className="text-alert" aria-hidden>*</span>}
      </label>
      <input id={id} className="input" type={type} value={value} required={required} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)} />
      {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
    </div>
  );
}

export function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5">
      <input type="checkbox" className="mt-1 size-4 shrink-0 accent-brand" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

export function YesNo({ label, value, onChange }: { label: string; value?: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
      <span>{label}</span>
      <div className="flex shrink-0 gap-2" role="radiogroup" aria-label={label}>
        {[true, false].map((v) => (
          <button key={String(v)} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)}
            className={`w-16 rounded-lg border-2 py-1.5 font-medium ${value === v ? "border-brand bg-brand text-white" : "border-line hover:border-brand"}`}>
            {v ? "Yes" : "No"}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex flex-wrap gap-x-1 gap-y-2 text-sm" aria-label="Progress">
      {steps.map((s, i) => (
        <li key={s} className="flex items-center gap-1" aria-current={i === current ? "step" : undefined}>
          <span className={`grid size-6 place-items-center rounded-full text-xs font-bold ${
            i < current ? "bg-ok text-white" : i === current ? "bg-brand text-white" : "bg-surface text-muted border border-line"}`}>
            {i < current ? "✓" : i + 1}
          </span>
          <span className={i === current ? "font-semibold" : "text-muted"}>{s}</span>
          {i < steps.length - 1 && <span aria-hidden className="mx-1 text-line">—</span>}
        </li>
      ))}
    </ol>
  );
}
