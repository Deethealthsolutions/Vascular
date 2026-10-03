"use client";

import { useState } from "react";
import { Section, Select, Small, Toggle } from "@/components/staff/ui";
import { by, newWound, updateVisit, woundArea, type StaffUser, type Visit, type Wound } from "@/lib/clinic";
import type { Tab } from "./VisitChart";

const infectionSigns = ["Erythema > 2 cm", "Purulence", "Warmth", "Induration", "Malodor", "Crepitus"];
const etiologies = ["diabetic", "arterial", "venous", "pressure", "surgical", "radiation", "other"] as const;

export function WoundsTab({ v, me, go }: { v: Visit; me: StaffUser; go: (t: Tab) => void }) {
  const [wounds, setWounds] = useState<Wound[]>(v.wounds.length ? v.wounds : [newWound()]);
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  const edit = (id: string, patch: Partial<Wound>) => {
    setWounds(wounds.map((w) => (w.id === id ? { ...w, ...patch } : w)));
    setSaved(false);
  };

  function save() {
    const valid = wounds.filter((w) => w.location.trim());
    updateVisit(v.id, (x) => ({
      ...x,
      wounds: valid,
      log: [...x.log, { at: new Date().toISOString(), text: `Wound assessment documented (${valid.length} wound${valid.length === 1 ? "" : "s"})`, by: by(me) }],
    }));
    setSaved(true);
  }

  return (
    <div className="space-y-5">
      {wounds.map((w, i) => {
        const tissue = w.granulation + w.slough + w.eschar;
        return (
          <Section key={w.id} title={`Wound ${i + 1}${w.location ? `: ${w.location}` : ""}`}
            aside={wounds.length > 1 && <button className="text-sm text-alert" onClick={() => setWounds(wounds.filter((x) => x.id !== w.id))}>Remove</button>}>
            <div className="grid gap-5 lg:grid-cols-[1fr_240px]">
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <Small label="Location" value={w.location} onChange={(location) => edit(w.id, { location })} placeholder="e.g. R plantar 1st MTH" wide />
                  <Select label="Etiology" value={w.etiology} options={etiologies} onChange={(etiology) => edit(w.id, { etiology })} />
                  <Small label="Length" value={w.lengthCm} onChange={(lengthCm) => edit(w.id, { lengthCm })} suffix="cm" />
                  <Small label="Width" value={w.widthCm} onChange={(widthCm) => edit(w.id, { widthCm })} suffix="cm" />
                  <Small label="Depth" value={w.depthCm} onChange={(depthCm) => edit(w.id, { depthCm })} suffix="cm" />
                  <div className="rounded-lg bg-brand-soft p-3">
                    <p className="text-xs text-muted">Area (L × W)</p>
                    <p className="text-xl font-bold text-brand-dark">{woundArea(w)} cm²</p>
                  </div>
                  <Small label="Weeks open" value={w.weeksOpen} onChange={(weeksOpen) => edit(w.id, { weeksOpen })} />
                  <Select label="Exudate" value={w.exudate} options={["none", "light", "moderate", "heavy"] as const} onChange={(exudate) => edit(w.id, { exudate })} />
                </div>

                <div>
                  <p className="label text-sm">Wound bed tissue (%)</p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {(["granulation", "slough", "eschar"] as const).map((k) => (
                      <label key={k} className="block text-sm capitalize">
                        {k}: <strong>{w[k]}%</strong>
                        <input type="range" min={0} max={100} step={5} value={w[k]} className="w-full accent-brand"
                          onChange={(e) => edit(w.id, { [k]: Number(e.target.value) })} />
                      </label>
                    ))}
                  </div>
                  {tissue !== 100 && tissue > 0 && <p className="text-sm text-warn">Tissue types add up to {tissue}% (should be 100%).</p>}
                </div>

                <div>
                  <p className="label text-sm">Signs of infection (IWGDF/IDSA)</p>
                  <div className="flex flex-wrap gap-2">
                    {infectionSigns.map((s) => (
                      <Toggle key={s} label={s} checked={w.infection.includes(s)}
                        onChange={(on) => edit(w.id, { infection: on ? [...w.infection, s] : w.infection.filter((x) => x !== s) })} />
                    ))}
                  </div>
                </div>

                <Toggle label="Probe-to-bone positive" checked={w.probeToBone} onChange={(probeToBone) => edit(w.id, { probeToBone })} />
                {(w.probeToBone || w.infection.length >= 2) && (
                  <p className="rounded-lg bg-alert-soft p-3 text-sm text-alert">
                    {w.probeToBone && "Positive probe-to-bone: high suspicion for osteomyelitis. Provider to consider X-ray / MRI and bone biopsy. "}
                    {w.infection.length >= 2 && "Two or more infection signs: flag for provider, consider culture and antibiotics."}
                  </p>
                )}
              </div>

              <div>
                <p className="label text-sm">Clinical photo</p>
                <label className="flex aspect-square cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-line bg-surface text-center text-sm hover:border-brand">
                  {photos[w.id]
                    // eslint-disable-next-line @next/next/no-img-element -- local blob preview
                    ? <img src={photos[w.id]} alt={`Wound ${i + 1}`} className="h-full w-full object-cover" />
                    : <span className="px-4 text-muted">📷 Take / upload photo<br /><span className="text-xs">with measuring guide in frame</span></span>}
                  <input type="file" accept="image/*" capture="environment" className="sr-only"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) setPhotos({ ...photos, [w.id]: URL.createObjectURL(f) }); }} />
                </label>
                {!v.consents.includes("photo") && <p className="mt-2 text-xs font-semibold text-warn">No photo consent on file</p>}
              </div>
            </div>
          </Section>
        );
      })}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button className="btn-ghost" onClick={() => setWounds([...wounds, newWound()])}>+ Add another wound</button>
        <div className="flex items-center gap-3">
          {saved && <span className="text-sm text-ok">✓ Saved</span>}
          <button className="btn-secondary" onClick={save}>Save</button>
          <button className="btn-primary" onClick={() => { save(); go(v.stage === "triage" ? "triage" : "provider"); }}>
            Save &amp; {v.stage === "triage" ? "back to triage" : "go to provider exam"} →
          </button>
        </div>
      </div>
    </div>
  );
}
