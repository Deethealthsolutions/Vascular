# Quick visit (one screen)

**Screen:** sidebar → Patient journey → **Quick visit (one screen)** (`/clinical/quick-visit`)
**Code:**
- Screen: `web/src/app/clinical/quick-visit/QuickVisit.tsx`
- Wound photos: `web/src/app/clinical/quick-visit/Photos.tsx`, API `web/src/app/api/quick-visit/photo/route.ts`
- Form, scoring and save payload: `web/src/lib/qv/model.ts`
- API: `web/src/app/api/quick-visit/route.ts`

**Database:** `supabase/migrations/20261013000000_quick_visits.sql`, and `20261014000000_quick_visit_photos.sql` for wound photos

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
| 8 · Research | The patient's consent to research use, what wound photos may be used for (care only / care + research), and an optional study tag |

**Right-hand side:**
- **Research readiness:** the share of 15 core research variables recorded, listing what's missing. Wound items count only when there is a wound, and HbA1c only for people with diabetes.
- **Save:** to save you need name, sex, age or date of birth, reason for visit and outcome; everything else is optional.
- **Earlier visits:** click one to open it for correction.
- **Today at this location:** every quick visit saved there today.

## Wound photos

**Taking them:** **📷 Take / add photo** sits in the Wound panel. On a phone or tablet it opens the rear camera; on a computer it opens a file picker. Up to **6 photos per visit**.

**In the browser:**
- **Shrunk:** to 1600 px on the longest side, as JPEG.
- **Location data removed:** re-encoding removes EXIF data such as GPS and device details.
- **Size:** each photo ends up typically 100–400 KB.

**Per photo:** tick **Ruler / scale in shot**, which is needed to measure the wound from the photo later, and add an optional note. On-screen tips explain how to take a usable photo.

**When they upload:** photos stay in the browser until **Save**, then upload one by one to the saved visit. If any fail, the screen says so and stays on the visit.

**What's saved with each photo:**
- the wound label (side and site)
- the note
- the scale flag
- the consent level (from the Research panel)
- width and height
- a **SHA-256 fingerprint**
- who took it and when

**On a follow-up:**
- **Last visit's photo:** it shows beside today's.
- **Compare with last visit:** opens them side by side.
- **Earlier visits:** each shows 📷 with its photo count.

**Removing:** **Remove** asks for a reason. The photo is hidden from the screen but **kept in the database** with who removed it and why, for audit.

**Storage and access:**
- **Table:** photos are stored in `qv_photos` in the same protected database, with row-level security and no public grants.
- **Viewing:** photos are only served through `/api/quick-visit/photo` to a logged-in Admin, Director or Medical record executive. Anyone else gets "not allowed"; without a log-in the answer is 401.
- **Capacity:** at roughly 300 KB a photo, Supabase's free 500 MB database holds about 1,500 photos. For larger volumes, move the image bytes to Supabase Storage and keep the details in the table.
- **Analysis:** with "Care + research" consent and a scale in the shot, photos are ready for wound-area measurement, and later for automated analysis.

## Who can use it

| Role | Access |
|---|---|
| Admin | Sidebar link (sees every screen) |
| Director | Sidebar link (sees every screen) |
| Medical record executive | Sidebar link, alongside Registration and Patient master |
| Everyone else (doctor, nurse, front office, research scientist) | No access. The link is hidden, typing the address goes back to their own screen, and the database refuses their calls. |

To change who can use it, update both `web/src/lib/auth/access.ts` (sidebar and address) and the role list in `qv_caller()` in the migration (database).

## Storage and security

- **Two tables:** `qv_patients`, with a running patient number `PT-000001` and the background as JSON, and `qv_visits`. Research-friendly columns are kept separately (diagnoses, wound site and area, Wagner, infection, ABI, outcome, consent, research score), and the full form is kept in `data`.
- **No public access:** both tables have row-level security and no public grants. All reads and writes go through `qv_search`, `qv_patient`, `qv_recent` and `qv_save`. Each one checks the caller's log-in session and role in the database, so the public key alone can't read patients.
- **Who saved it:** every row records who created and last updated it.

## Setup

Run `supabase/migrations/20261013000000_quick_visits.sql` in the Supabase SQL editor, after the user-admin migration.

## Next steps

- **Research documents:** send consented, de-identified quick-visit data into the register, for example as a dataset attached to a study.
- **Photo measurement:** trace the wound on a photo with a scale in the shot to measure its area.
- **Patient journey:** link a quick-visit patient to the full journey if they later go through it.
