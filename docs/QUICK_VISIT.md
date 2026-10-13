# Quick visit (one screen)

**Screen:** sidebar → Patient journey → **Quick visit (one screen)** (`/clinical/quick-visit`)
**Code:**
- Screen: `web/src/app/clinical/quick-visit/QuickVisit.tsx`
- Form, scoring and save payload: `web/src/lib/qv/model.ts`
- API: `web/src/app/api/quick-visit/route.ts`

**Database:** `supabase/migrations/20261013000000_quick_visits.sql`

This is a simple alternative to the step-by-step patient journey (registration → nursing assessment → doctor → checkout) for when the hospital doesn't want every step. The whole outpatient visit goes on one screen with one **Save**. It keeps what the hospital needs when the patient comes back, and records it in a form ready for research. Later these records will feed the **Research documents** register.

## The screen

| Panel | What's in it |
|---|---|
| 1 · Find the patient | Search by mobile, name, patient no. (`PT-000123`) or hospital ID. Picking a result fills in the patient's details and background, sets the visit to *Follow-up* and lists earlier visits. No match means a new patient. |
| 2 · Patient details | Name, sex, age or date of birth, mobile, area, city, hospital ID / UHID, ABHA |
| 3 · Background | Diabetes (type, years, HbA1c, insulin), high BP, kidney disease, smoking, previous amputation, previous angioplasty / bypass, blood thinners, allergies, medicines. **Kept with the patient**, so it's filled in next time. |
| 4 · Today's visit | Date, type (new / follow-up / emergency), reason, referred by, blood sugar, BP, the patient's own words |
| 5 · Wound | Side, site, length × width (area worked out), depth, duration, Wagner grade, IWGDF infection grade, probe-to-bone, gangrene. **Healing trend:** on a follow-up it shows the change in area since the first measured visit, and flags under 40% improvement. |
| 6 · Circulation | Four foot pulses, ABI each side (with its band: normal / PAD / severe / incompressible), rest pain, claudication distance |
| 7 · Diagnosis, treatment, outcome | Diagnosis and "done today" as tick-chips, outcome, next review date, notes |
| 8 · Research | The patient's consent to research use, and an optional study tag |

**Right-hand side:**
- **Research readiness:** the share of 15 core research variables recorded, listing what's missing. Wound items count only when there is a wound, and HbA1c only for people with diabetes.
- **Save:** to save you need name, sex, age or date of birth, reason for visit and outcome; everything else is optional.
- **Earlier visits:** click one to open it for correction.
- **Today at this location:** every quick visit saved there today.

## Who can use it

| Role | Access |
|---|---|
| Admin, Director | Sidebar link (they see every screen) |
| Doctor, Nurse, Front office, Medical record executive | Allowed by the database, but **not in their sidebar yet**: each of these roles currently shows only its one journey screen. To add it, put `"quick"` in that role's list in `web/src/lib/auth/access.ts`. |
| Research scientist | Not allowed. The records identify patients; research will get a de-identified extract. |

## Storage and security

- **Two tables:** `qv_patients`, with a running patient number `PT-000001` and the background as JSON, and `qv_visits`. Research-friendly columns are kept separately (diagnoses, wound site and area, Wagner, infection, ABI, outcome, consent, research score), and the full form is kept in `data`.
- **No public access:** both tables have row-level security and no public grants. All reads and writes go through `qv_search`, `qv_patient`, `qv_recent` and `qv_save`. Each one checks the caller's log-in session and role in the database, so the public key alone can't read patients.
- **Who saved it:** every row records who created and last updated it.

## Setup

Run `supabase/migrations/20261013000000_quick_visits.sql` in the Supabase SQL editor, after the user-admin migration.

## Next steps

- **Research documents:** send consented, de-identified quick-visit data into the register, for example as a dataset attached to a study.
- **Photos:** wound photos per visit.
- **Patient journey:** link a quick-visit patient to the full journey if they later go through it.
