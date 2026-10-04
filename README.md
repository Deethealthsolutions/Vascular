<<<<<<< HEAD
# Wound & Vascular Center Platform

Public-facing platform for a wound care, vascular intervention, limb salvage, diabetic foot and HBOT practice.

- **[docs/SPEC.md](docs/SPEC.md)**: MVP specification covering roles, features, data model, integrations, HIPAA and FDA considerations, and phasing.
- **[docs/PATIENT_JOURNEY.md](docs/PATIENT_JOURNEY.md)**: step-by-step patient journey (registration, initial nursing assessment, doctor consultation, checkout, tests & procedures, admission), rules, statuses and data handed between steps.
- **[docs/GAP_ANALYSIS.md](docs/GAP_ANALYSIS.md)**: requirements vs the HTML mockup vs this build, with a demo script.
- **[web/](web/)**: Next.js 16 + TypeScript + Tailwind 4 app. Currently a clickable prototype running on mock data.

## Run the prototype

```bash
cd web
npm install
npm run dev        # http://localhost:3000
```

**Single-file version.** `npm run build:html` builds the whole prototype into one self-contained file, `dist/vascular-care-prototype.html`, which opens by double-click with no server. It seeds demo patients on first open, uses hash routes (`#/clinical/triage`), and keeps data in the browser's localStorage. The build script is `web/scripts/build-single-html.mjs`. It also writes `dist/vascular-care-prototype.artifact.html`, the variant used for the shared claude.ai page.

| Route | What it shows |
|---|---|
| `/` | Home: services, warning signs, outcomes, provider CTA |
| `/conditions`, `/treatments` | Patient education pages (content in `src/lib/content.ts`) |
| `/self-check` | "Should I see a specialist?" questionnaire with emergency routing |
| `/book` | Booking + intake wizard (HBOT safety screening, wound photo upload, insurance) |
| `/refer` | Referral form for providers (urgency triage, ABI hints, criteria helper) |
| `/portal`, `/portal/[id]` | Referring-provider dashboard, status timeline, consult summary |
| `/outcomes`, `/team` | Published results and care team |

### Clinical workspace (`/clinical`): the hospital system

Built from `Hospital_Development_Requirements.html` and `Hospital_Vascular_UI_Mockup.html` (its fixture data is in `web/src/data/`). Multi-centre (Chennai, Bengaluru, Hyderabad), role- and centre-scoped, and every governance action works: observations, escalation, visit notes, sign-off ledger, merges, extracts, consent-checked images and the access audit. Switch staff with **Signed in as**; demo signing PIN **1234**. `/clinical/requirements` shows coverage per requirement.

### Walk-in clinic flow (`/staff`)

Follows a patient who walks in to the clinic from the front desk to discharge. Use the **"Signed in as"** menu to switch between front desk, nurse, provider and vascular tech. Every action is logged under the selected person.

| Route | What it shows |
|---|---|
| `/staff` | Clinic board: every patient in the building with stage, acuity, room, wait timers and alerts |
| `/staff/check-in` | Front desk: patient lookup / new registration → red-flag safety screen → ID → visit reason → insurance eligibility → consents + signature → wristband |
| `/staff/visit/[id]` | Visit chart with tabs per role: triage & vitals, wound assessment, provider exam & orders (Wagner / WIfI), vascular lab (ABI/TBI calculator), checkout (tasks + after-visit summary) |

Demo data lives in `web/src/lib/clinic.ts`. **Reset demo** in the top bar restores the starting board.

## Where to change things
- Practice name, phone, locations, insurance: `web/src/lib/site.ts`
- Condition/treatment copy, outcome numbers: `web/src/lib/content.ts`
- Mock referrals: `web/src/lib/referrals.ts`
- Staff workflow data, thresholds and demo patients: `web/src/lib/clinic.ts`
- Brand colors: `web/src/app/globals.css` (`@theme` block)

## Prototype limitations
No authentication, backend or database. Referrals you submit are stored in your browser's localStorage. **Don't enter real patient data.** See SPEC §9 for the production architecture.
=======
# Wound & Vascular Center Platform

Public-facing platform for a wound care, vascular intervention, limb salvage, diabetic foot and HBOT practice.

- **[docs/SPEC.md](docs/SPEC.md)**: MVP specification covering roles, features, data model, integrations, HIPAA and FDA considerations, and phasing.
- **[docs/PATIENT_JOURNEY.md](docs/PATIENT_JOURNEY.md)**: step-by-step patient journey (registration, initial nursing assessment, doctor consultation, checkout, tests & procedures, admission), rules, statuses and data handed between steps.
- **[docs/GAP_ANALYSIS.md](docs/GAP_ANALYSIS.md)**: requirements vs the HTML mockup vs this build, with a demo script.
- **[web/](web/)**: Next.js 16 + TypeScript + Tailwind 4 app. Currently a clickable prototype running on mock data.

## Run the prototype

```bash
cd web
npm install
npm run dev        # http://localhost:3000
```

**Single-file version.** `npm run build:html` builds the whole prototype into one self-contained file, `dist/vascular-care-prototype.html`, which opens by double-click with no server. It seeds demo patients on first open, uses hash routes (`#/clinical/triage`), and keeps data in the browser's localStorage. The build script is `web/scripts/build-single-html.mjs`. It also writes `dist/vascular-care-prototype.artifact.html`, the variant used for the shared claude.ai page.

| Route | What it shows |
|---|---|
| `/` | Home: services, warning signs, outcomes, provider CTA |
| `/conditions`, `/treatments` | Patient education pages (content in `src/lib/content.ts`) |
| `/self-check` | "Should I see a specialist?" questionnaire with emergency routing |
| `/book` | Booking + intake wizard (HBOT safety screening, wound photo upload, insurance) |
| `/refer` | Referral form for providers (urgency triage, ABI hints, criteria helper) |
| `/portal`, `/portal/[id]` | Referring-provider dashboard, status timeline, consult summary |
| `/outcomes`, `/team` | Published results and care team |

### Clinical workspace (`/clinical`): the hospital system

Built from `Hospital_Development_Requirements.html` and `Hospital_Vascular_UI_Mockup.html` (its fixture data is in `web/src/data/`). Multi-centre (Chennai, Bengaluru, Hyderabad), role- and centre-scoped, and every governance action works: observations, escalation, visit notes, sign-off ledger, merges, extracts, consent-checked images and the access audit. Switch staff with **Signed in as**; demo signing PIN **1234**. `/clinical/requirements` shows coverage per requirement.

### Walk-in clinic flow (`/staff`)

Follows a patient who walks in to the clinic from the front desk to discharge. Use the **"Signed in as"** menu to switch between front desk, nurse, provider and vascular tech. Every action is logged under the selected person.

| Route | What it shows |
|---|---|
| `/staff` | Clinic board: every patient in the building with stage, acuity, room, wait timers and alerts |
| `/staff/check-in` | Front desk: patient lookup / new registration → red-flag safety screen → ID → visit reason → insurance eligibility → consents + signature → wristband |
| `/staff/visit/[id]` | Visit chart with tabs per role: triage & vitals, wound assessment, provider exam & orders (Wagner / WIfI), vascular lab (ABI/TBI calculator), checkout (tasks + after-visit summary) |

Demo data lives in `web/src/lib/clinic.ts`. **Reset demo** in the top bar restores the starting board.

## Where to change things
- Practice name, phone, locations, insurance: `web/src/lib/site.ts`
- Condition/treatment copy, outcome numbers: `web/src/lib/content.ts`
- Mock referrals: `web/src/lib/referrals.ts`
- Staff workflow data, thresholds and demo patients: `web/src/lib/clinic.ts`
- Brand colors: `web/src/app/globals.css` (`@theme` block)

## Prototype limitations
No authentication, backend or database. Referrals you submit are stored in your browser's localStorage. **Don't enter real patient data.** See SPEC §9 for the production architecture.
>>>>>>> 0869aa010f3d2ca96b896c9a790e34174f190de8
