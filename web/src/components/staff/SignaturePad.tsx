"use client";

import { useRef } from "react";

/** Minimal signature capture for the prototype. Production: e-signature with audit trail. */
export function SignaturePad({ onChange }: { onChange: (signed: boolean) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  function point(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = ref.current!;
    const r = c.getBoundingClientRect();
    return [((e.clientX - r.left) * c.width) / r.width, ((e.clientY - r.top) * c.height) / r.height] as const;
  }

  return (
    <div>
      <canvas ref={ref} width={600} height={140} aria-label="Signature pad"
        className="h-[140px] w-full touch-none rounded-lg border-2 border-dashed border-line bg-white"
        onPointerDown={(e) => {
          const ctx = ref.current!.getContext("2d")!;
          ctx.lineWidth = 2.5;
          ctx.lineCap = "round";
          ctx.strokeStyle = "#13212b";
          ctx.beginPath();
          ctx.moveTo(...point(e));
          drawing.current = true;
          ref.current!.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const ctx = ref.current!.getContext("2d")!;
          ctx.lineTo(...point(e));
          ctx.stroke();
          onChange(true);
        }}
        onPointerUp={() => (drawing.current = false)}
      />
      <div className="mt-1 flex justify-between text-sm text-muted">
        <span>Patient or legal representative signs above</span>
        <button type="button" className="font-semibold text-brand" onClick={() => {
          const c = ref.current!;
          c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
          onChange(false);
        }}>Clear</button>
      </div>
    </div>
  );
}
