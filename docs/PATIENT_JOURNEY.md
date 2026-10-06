# Patient journey — outpatient wound & vascular care

**Status:** living reference · last updated 2026-09-26
**Built so far:** Step 1 Registration · Step 2 Initial nursing assessment · Step 3 Doctor consultation · Step 4 after the doctor (4A checkout, 4B tests & procedures, 4C admission) · Today's patient flow board
**Where:** clinical workspace, `http://localhost:3000/clinical` (run `cd web && npm run dev`)

This document records how a patient moves through the hospital in the prototype: what each step does, the rules it applies, what it hands to the next step, and which decisions still need a clinician's sign-off. Update it whenever a step is added or a rule changes.

---

## 1. The journey at a glance

```
 Walk-in / referral / ambulance / appointment
                 │
                 ▼
 ┌─────────────────────────────┐   red flag   ┌──────────────┐
 │ 1. REGISTRATION (front desk)│─────────────▶│  EMERGENCY   │
 │  find or create record,     │              └──────────────┘
 │  red-flag screen, route,    │                     ▲
 │  token, consent             │                     │ escalate
 └──────────────┬──────────────┘                     │
                │ waiting for assessment                 │
                ▼                                    │
 ┌─────────────────────────────┐                     │
 │ 2. NURSING ASSESSMENT (bays)│─────────────────────┘
 │  identity, vitals + NEWS2,  │
 │  glucose, foot & limb check,│───▶ left without being seen (follow-up call)
 │  first wound look, category │
 └──────────────┬──────────────┘
                │ ready for doctor
                ▼
 ┌─────────────────────────────┐  orders   ┌──────────────┐
 │ 3. DOCTOR CONSULTATION      │──────────▶│   AT TESTS   │
 │  (consult rooms) history,   │◀──────────│ results back │
 │  exam + ABI, WIfI / Wagner, │           └──────────────┘
 │  diagnosis, orders, Rx, sign│──▶ Emergency
 └──────┬───────────┬──────────┘
        │           │ for procedure          awaiting admission
        │           ▼                               │
        │   ┌──────────────────────┐                ▼
        │   │ 4B. TESTS &          │     ┌──────────────────────┐
        │   │  PROCEDURES          │     │ 4C. ADMISSION        │
        │   │  results desk ───────┼──▶  │  details, clearance, │
        │   │  (back to doctor)    │     │  bed, consent, SBAR  │──▶ admitted (ward round)
        │   │  dressing room, HBOT │     └──────────────────────┘
        │   └──────────┬───────────┘
        │ to checkout  │ to checkout
        ▼              ▼
 ┌─────────────────────────────┐
 │ 4A. CHECKOUT (front desk)   │
 │  next appointment, visit    │──▶ checked out
 │  summary & Rx, letter, bill │
 └─────────────────────────────┘

 Today's patient flow board shows every patient in one of these stages, with minutes in stage.
```

### Patient status (one value at a time)

| Status | Set by | Meaning | Next |
|---|---|---|---|
| `waiting for assessment` | Registration desk; assessment screen (release / re-queue / returned) | Registered, in the waiting area | Called to a bay |
| `in assessment` | Assessment nurse (call to bay) | In a named bay | Ready for doctor, Emergency, released |
| `ready for doctor` | Assessment nurse (complete) | Assessment record signed off by the nurse | Doctor consultation (step 3) |
| `sent to emergency` | Desk (red flag) or nursing assessment (escalate / send) | Handed to Emergency | Emergency pathway |
| `left without being seen` | Assessment nurse, with reason | Left before assessment | Follow-up call; can be re-queued if they return |
| `with doctor` | Doctor (call to consult room) | In a named consult room | Signed outcome, at tests, back to queue |
| `at tests` | Doctor (send for tests) | Orders placed, consultation left open | 4B results desk → `ready for doctor` again |
| `to checkout` | Doctor (sign), or the dressing room when done | Going home with a follow-up | 4A Checkout |
| `for procedure` | Doctor (sign) | Dressing room / HBOT assessment today | 4B Tests & procedures |
| `awaiting admission` | Doctor (sign, "Admit to ward") | Decision to admit made | 4C Admission |
| `admitted` | Admission desk | In a ward bed with an IP number | Ward round (in-patients) |
| `checked out` | Checkout desk | Left with appointment, documents and bill settled | — |

Every change of status is written to the registration's **history** and to the **Access audit** log with the staff member's name and time.

### Locations

The network runs several clinic locations, listed in `web/src/lib/cx/locations.ts`:

| Location | City | Centre |
|---|---|---|
| Greams Road | Chennai | CHN (holds the ward fixture and bed board) |
| HSR Layout | Bengaluru | BLR |
| Rajajinagar | Bengaluru | BLR |
| Mysuru | Mysuru | BLR |

Choosing a location:
- Staff pick where they are working with **Working at** in the sidebar. Only locations whose centre is in their scope are offered.
- Every journey screen (registration, nursing assessment, consultation, checkout, tests & procedures, admission) and its sidebar counts show **that location only**.
- **Tokens are numbered per location**: each clinic starts at E-001, W-001 and so on.

On **Today's patient flow**:
- A location switcher opens on the working location.
- **All locations** shows a comparison tile per clinic: in the building, over the limit, door-to-doctor, and a bar split by stage. The lanes then tag each patient with their location, and clicking a tile opens that clinic.

**Data rules:**
- Each registration stores `location`. Records created before locations existed fall back to their centre's first location.
- Admission bed boards are per location. Only Greams Road starts with the ward fixture's in-patients.

### Roles

| Person (demo) | Role | Screens |
|---|---|---|
| Kavya R. | Registration desk · front office (Chennai) | Registration, Checkout, Admission, Patient flow, Patient master |
| Sr. Revathi S. | OPD assessment nurse (Chennai) | Initial nursing assessment (landing screen), Tests & procedures (results desk, dressing room), Admission, Patient flow, ward screens |
| Dr. Meera Krishnan, Dr. Arun Nair | Consultant vascular surgeons | Doctor consultation (sign); countersign trainees in *Review & sign-off*; can view registration and nursing assessment |
| Dr. Neha Bose | Senior house officer (trainee) | Doctor consultation; her signed consultations go to a consultant for countersignature |

Switch person with **Signed in as** in the sidebar. Access is scoped by role and centre.

---

## 2. Step 1 — Registration

**Screen:** `/clinical/register` · **Code:** `web/src/app/clinical/register/Register.tsx`

One page, designed for desk speed. Left: eight sections. Right (sticky): route, token preview, flags and a checklist of what is still missing.

### 2.1 Sections

| # | Section | What is captured | Notes |
|---|---|---|---|
| 1 | Find the patient first | Search by mobile, name, MRN or enterprise ID across the patient master and today's registrations | Selecting a match pre-fills everything and switches to *returning patient*; fields missing on file are listed for collection |
| 2 | Red-flag screen | Six yes/no questions (below) | Asked **before** paperwork. Any "yes" → emergency mode |
| 3 | Who is the patient | Name, date of birth *or* approximate age, sex, language, ABHA (optional), ID document seen | Aadhaar number is **not** stored — only that it was seen. Duplicate warning appears as details are typed |
| 4 | Contact and next of kin | Mobile + OTP verification (or reason), address with PIN, next of kin | Demo OTP **4829** |
| 5 | Why they have come | Arrival mode, referral source, service, main complaint | Service decides the queue |
| 6 | Quick health background | Diabetes (years, insulin), kidney disease, dialysis, previous amputation, previous angioplasty/bypass, blood thinners, tobacco, allergies (or none known), wound site and duration, mobility | Patient-reported; the nurse confirms in triage |
| 7 | Payment | Self-pay, PM-JAY, CMCHIS/state scheme, ESI, CGHS, private insurance, corporate panel + card/policy number | Warns when pre-authorisation will be needed (angiography, angioplasty, HBOT) |
| 8 | Consent | Treatment (required), share across centres, research contact, wound-photo scope (care / +research / +publication), signature | Photo scope is enforced later every time a photo is used |

### 2.2 Red-flag questions (desk)

| Question | Tag |
|---|---|
| Fever, shivering or very unwell with a foot or leg wound | Possible sepsis |
| Redness, swelling or black skin spreading quickly, or foul smell | Spreading infection / wet gangrene |
| Leg or foot suddenly cold, pale, numb or very painful | Possible acute limb ischaemia |
| Chest pain, breathlessness or collapse | Cardio-respiratory emergency |
| Drowsy, confused, sweating or shaking | Glycaemic emergency |
| Bleeding that will not stop | Active bleeding |

**Emergency mode:** only name, approximate age and sex are required. Everything else is listed as *deferred to bedside*. The button becomes **Register & send to Emergency**, token prefix `E`.

### 2.3 Routing, tokens and priority

| Service | Queue letter |
|---|---|
| Wound clinic | W |
| Diabetic foot clinic | D |
| Vascular OPD | V |
| HBOT assessment | H |
| Follow-up / dressing | R |
| Scheduled procedure | P |
| Emergency (any red flag) | E |

- **Token** = queue letter + running number per centre, e.g. `D-001`.
- **Priority** if any of: age ≥ 75 · wheelchair or stretcher · on dialysis · vascular complaint of rest/night pain · diabetic-foot complaint of toe discolouration.
- **Fall-risk band** if not walking unaided, or age ≥ 80.

### 2.4 Required to register (normal mode)

Red-flag screen answered · name · age or DOB · sex · mobile verified *or* reason · city and 6-digit PIN · next of kin with 10-digit mobile · ID document recorded · service and complaint · allergies or "no known allergies" · payment with card number where applicable · consent to treatment ticked **and** signed.

### 2.5 What registration produces

- **Enterprise ID** (reused for returning patients) and a **centre MRN**.
- **Registration record** (see §6) with status `waiting for assessment` or `sent to emergency`.
- **Slip and wristband** (printable): name, age/sex, MRN, enterprise ID, token, queue, arrival, payment, language; wristband flags ALLERGY, FALL RISK, DIABETIC, DIALYSIS, ANTICOAGULATED.
- **Today at the desk** list: emergencies first, waiting minutes, *Hand to nursing assessment*.
- Audit entries for every record opened and every registration.

---

## 3. Step 2 — Initial nursing assessment

> **Naming.** This step was called *Triage* in earlier drafts. It is now **Initial nursing assessment**, in line with NABH's requirement for a documented initial assessment of every patient. "Triage" is kept only for the **triage category** (Emergency / Urgent / Standard / Routine) that the assessment ends with. The URL `/clinical/triage` and code names such as `TriageRecord` are unchanged. Browser data saved under the old status names is migrated when it loads.

**Screen:** `/clinical/triage` · **Code:** `web/src/app/clinical/triage/Triage.tsx`

### 3.1 Layout

1. **Bays board** — Assessment bay 1–3 and Dressing room. Each bay shows the occupant, minutes in bay, and how complete the assessment form is (%). Empty bay: **Call next** (calls the top of the queue). Occupied bay: **Open**, **Actions**, **Release**. One patient per bay.
2. **Waiting for assessment** — cards in queue order. Card shows token, *next* / *priority* / *re-queued* badges, complaint, flags (diabetic, dialysis, anticoagulated, allergy, mobility, notes) and waiting time (red after 30 min). **Click a card** for the patient panel; the card's button calls the patient to the first free bay.
3. **Assessment form** for the patient being assessed, with a sticky **Assessment summary**.
4. **Ready for doctor** (click a row for the assessment record) and **In Emergency · left without being seen**.

**Queue order:** priority band first (emergency → priority → routine), then time of arrival; a re-queued patient takes their re-queue time.

### 3.2 Patient panel (card / bay actions)

| Action | Available when | Effect |
|---|---|---|
| Call to bay / Move to bay | waiting / in bay | Occupied bays are disabled; an announcement toast is shown |
| Open assessment form | in bay | Loads the saved draft |
| Recall (announce again) | in bay | Counts calls ("called 3×") |
| Not responding → re-queue | in bay, after 3 calls | Back to waiting, behind patients of the same priority |
| Release bay | in bay | Back to waiting, bay freed |
| Mark / remove priority | waiting · **reason required** | Re-orders the queue |
| Change service queue | waiting / in bay | Token unchanged |
| Send to Emergency | waiting (reason required) / in bay | Status `sent to emergency` |
| Left without being seen | waiting · reason required | Follow-up call due; **Patient returned — re-queue** restores them |
| Add a note | always | Shown on the card, in the form header and to the doctor |
| Access report | always | Opens the audit log filtered to this patient |

The panel also shows the full registration details and the patient's **history** (every call, move, note and decision with time and staff name).

**Drafts:** assessment entries save automatically (debounced) to the patient's record, and are flushed immediately when the nurse switches patients. A nurse can move between bays without losing work.

### 3.3 Assessment form

The form is split into **four tabs** so the nurse sees one short screen at a time. Entry follows the ward observation-chart pattern: one compact row per item, label on the left, a small box on the right. Any value that scores is coloured (amber / orange / red). Each tab shows ✓ once its required items are filled, and **Back / Next** buttons step through the tabs. The assessment summary on the right stays visible on every tab.

Identity confirmation is a single checkbox in the patient header ("name and age/DOB match wristband"), above the tabs.

| Tab | Contents |
|---|---|
| **Vitals** | RR, SpO₂, air / O₂, HR, systolic and diastolic BP, temperature, ACVPU, capillary glucose, pain 0–10, weight, height. A coloured **NEWS2 block** under the rows updates as the nurse types |
| **Foot & limb** | Table with right and left columns and a compact dropdown in each cell (abnormal answers highlighted): dorsalis pedis and posterior tibial pulse (palpable / weak / Doppler only / absent), colour, temperature, 10 g monofilament sensation, swelling. Below it: capillary refill, rest/night pain, walking distance before leg pain |
| **Wound** | Wound present / no open wound; site; length × width (× depth) → area; wound bed; exudate; redness (cm from edge); odour; probe-to-bone. **Wound photographs** (see 3.3a). The tab label shows the photo count |
| **Handover** | Nurse action checklist generated from the findings; free-text note for the doctor |

#### 3.3a Wound photographs

- **📷 Take photo** opens the rear camera on a phone or tablet (`capture=environment`). **⤒ Upload from device** picks one or more existing images. There is a maximum of 6 per patient at the assessment.
- Each image is resized in the browser (longest side 900 px, JPEG) before saving. Re-encoding removes EXIF data such as GPS location and device (rule A29). Typical size is 40–120 KB.
- Each thumbnail has a **"marker in frame"** checkbox. Without the calibration marker the photo is kept as a record but labelled *no measurement*. Photos can be enlarged, captioned or removed.
- The patient's photo-consent scope from registration is shown next to the buttons.
- Every add and remove is written to the access audit.
- The assessment record stores `photo: true` and the photo IDs, so the doctor sees which images belong to the assessment.

The same upload is available on the ward **Wound & HBOT** screen (*Capture photograph*). There, the quality gate (marker, focus, lighting, angle) is confirmed before saving. A photo that fails the gate is saved without a measurement. Added photos join the photograph series and go through the same consent-scoped *Request a use* check as the seeded images.

**Required to complete:** identity confirmed · RR, SpO₂, HR, BP, temperature · glucose if diabetic or unknown · pain score · all four pedal pulses · wound size and bed if a wound is present · reason if the suggested category was changed · nurse attestation.

### 3.4 Rules the summary applies

**NEWS2** — RCP 2017, SpO₂ scale 1 (same function as the ward screens).

**Foot infection grade** (IWGDF/IDSA, simplified; only if a wound is present):

| Grade | Rule |
|---|---|
| none | no local signs (redness < 0.5 cm, no purulent exudate, no odour) |
| mild | local signs only |
| moderate | redness > 2 cm, or probe-to-bone, or depth > 0.5 cm |
| severe | local signs **and** ≥ 2 SIRS features (temp > 38 or < 36, HR > 90, RR > 20) |

**Automatic flags**

| Flag | Rule |
|---|---|
| Possible acute limb ischaemia (side) | both pulses absent / Doppler only **and** limb cold **and** pale, mottled or dusky |
| Suspected CLTI | rest pain, or a wound, **with** absent / Doppler-only / weak pulses |
| Sepsis screen positive | NEWS2 ≥ 5 **and** any foot infection |
| Severe / moderate foot infection | from the grade above |
| Probe-to-bone positive | ticked |
| Hypoglycaemia / Hyperglycaemia | glucose < 70 / > 300 mg/dL |
| Neuropathy — high-risk diabetic foot | diabetic **and** reduced/absent sensation on either foot |
| Fall risk | not walking unaided, or age ≥ 80 |
| Anticoagulated with open wound | blood thinners **and** wound present |

**Suggested triage category**

| Category | Target | Triggered by (first match wins) |
|---|---|---|
| **Emergency** | move now | NEWS2 ≥ 7 · SpO₂ ≤ 91 · systolic ≤ 90 · ACVPU not A · glucose < 54 · severe infection · acute limb ischaemia |
| **Urgent** | doctor within 15 min | NEWS2 ≥ 5 or any single parameter scoring 3 · moderate infection · suspected CLTI · glucose < 70 or > 300 · probe-to-bone |
| **Standard** | doctor within 60 min | NEWS2 1–4 · any wound · priority registration · pain ≥ 7 |
| **Routine** | doctor within 2 h | none of the above |

The nurse can choose a different category; a **reason is required** and stored as an override.

**Nurse action checklist** is generated from the findings: hypoglycaemia protocol (15 g glucose, recheck 15 min) · sepsis bundle (lactate, cultures before antibiotics) · doctor informed directly (Urgent) · wound left exposed for the doctor · wound photo with calibration marker (if consented) · allergy band · fall-risk band · shoes and socks off (diabetic).

### 3.5 What the assessment produces

- **Assessment record** (`TriageRecord`, which holds the triage category) on the registration (see §6), status → `ready for doctor` or `sent to emergency`.
- **Ledger entry** in Review & sign-off: nurse attestation *"I confirm these observations were taken by me at the time stated"* with a SHA-256 content hash.
- **Countersignature request** to the duty doctor when NEWS2 ≥ 5 or any parameter scores 3 (rule A01).
- **Assessment record view** from *Ready for doctor*, with **Reopen assessment to correct** (form is pre-filled from the record; the correction is logged in history).

---

## 4. Step 3 — Doctor consultation

**Screen:** `/clinical/consult` · **Code:** `web/src/app/clinical/consult/Consult.tsx` · **Rules:** `web/src/lib/cx/consult.ts` · **Who:** consultants and trainees

### 4.1 Layout

1. **KPIs:** ready for doctor, over target, rooms in use, at tests, seen (and how many await countersignature).
2. **Consult rooms 1–3:** occupant, doctor, minutes in room. Empty room: **Call next**. Occupied room: **Open** or **Back to queue**.
3. **Ready for doctor:** ordered by triage category (Urgent → Standard → Routine), then by how close each patient is to their target time. Each row shows *due in N min* or, in red, *N min over*, plus NEWS2 and the nurse's flags. **Call to room** takes the first free room.
4. **Consultation form** (7 tabs) with a sticky **Consultation summary**.
5. **At tests** (with **Results back**) and **Seen today** (click a row for the signed record).

### 4.2 Consultation form

Same compact style as the assessment form. Each tab shows ✓ when its required items are filled. Entries save automatically as a draft on the patient, so the doctor can switch rooms, or send the patient for tests, without losing work.

| Tab | Contents |
|---|---|
| **Nursing** | Read-only nursing assessment: vitals, NEWS2, both-foot check, wound, photos (click to enlarge), flags, nurse actions and note |
| **History** | Presenting complaint, duration, history of presenting complaint (required), symptom chips, past history chips pre-filled from registration, allergies (drug and reaction, red when present), last HbA1c, **latest eGFR** (used for kidney dosing) and **WBC** (used for the SIRS count) |
| **Exam** | Femoral, popliteal, DP and PT pulses right/left (pedal pulses pre-filled by the nurse). Bedside Doppler pressures → **ABI and TBI calculated live**; a reason is required if no pressures are taken. **Diabetic foot examination** (diabetics only): monofilament from the nurse, vibration sense (128 Hz, required), ankle reflexes, callus, deformity and skin chips per foot, footwear (required), ulcer history → **IWGDF risk category 0–3** with the screening interval |
| **Wounds** | **One card per wound, on either limb.** The nurse's wound is pre-filled; the doctor confirms or corrects it and can add more (**+ Add wound (right / left)**). Each card has side, site, location, the doctor's own length × width × depth (area calculated), wound bed % (granulation, slough, necrotic, epithelial; must total 100), undermining and tunnelling, exposed structures, probe-to-bone, gangrene, exudate and surrounding skin. It also has **IWGDF/IDSA infection** from ticked local signs, erythema and deep signs (nurse's grade shown for comparison), suggested Wagner, University of Texas, and doctor photos (upload per wound). **Per-limb WIfI** panels at the top take the worst wound and infection on that limb and that limb's own ABI or toe pressure |
| **Treatment** | What was done **today**, per wound: debridement (method, anaesthesia, tissue removed, depth, bleeding control, tolerance) and a **dressing plan** (primary and secondary dressing, change frequency, who changes it; required for every wound). **Offloading device** issued (required for diabetics with a plantar ulcer) |
| **Diagnosis** | Diagnoses with ICD-10 (WHO) codes and side, suggested from the findings (now including Charcot and osteomyelitis from the deep signs). Orders, with one-click suggestions or **Add all** |
| **Medicines** | **Reconciliation** of current medicines (pre-filled from registration: insulin, anticoagulant, oral diabetes medicine): continue, stop, hold or change dose, with a reason for anything but continue. **New prescription** from the demo formulary. **Antibiotic stewardship** when an antibiotic is prescribed: indication, culture before first dose, planned duration, review (all required). **Best medical therapy** for PAD (antiplatelet, high-intensity statin, BP < 140/90, smoking cessation) and diabetes (HbA1c known and < 8% or ordered): each gap needs a one-click add or a reason |
| **Consent** | Who was present, interpreter (required; patient's language shown), what was discussed (diagnosis required; **amputation risk required** for CLTI or WIfI stage 4), shared **treatment decision** (required for CLTI or stage 4, optional at stage 3), patient's goals, **teach-back** (required). **Procedure consent** whenever anything was debrided: verbal or written, given by the patient or a named relative, witness, at least three risks explained, and a **signature on the pad** for written consent |
| **Plan & sign** | Plan (required); outcome; follow-up interval when going home; patient instructions; **Send for tests, see again today** |

Each tab lists what it still needs (“Still needed here: …”). The tab bar stays pinned under the page header while scrolling long tabs.

### 4.3 Rules (in `lib/cx/consult.ts`)

**ABI** = the higher ankle pressure (DP or PT) on that side ÷ the higher brachial pressure. Bands follow AHA/ACC 2016: > 1.40 non-compressible · 1.00–1.40 normal · 0.91–0.99 borderline · 0.70–0.90 mild · 0.40–0.69 moderate · < 0.40 severe. A **TBI** ≤ 0.70 is abnormal.

**WIfI ischaemia grade:** ABI ≥ 0.80 → I0 · 0.60–0.79 → I1 · 0.40–0.59 → I2 · < 0.40 → I3. If the ABI is > 1.3, toe pressure is used instead (≥ 60 → I0 · 40–59 → I1 · 30–39 → I2 · < 30 → I3). Without either, the limb is not staged.

**WIfI wound grade (suggested):**
- W3: gangrene of the forefoot, midfoot, heel or whole foot, or a deep heel ulcer.
- W2: exposed tendon or bone, gangrene limited to the digits, or a superficial heel ulcer.
- W1: any other ulcer.

**WIfI stage:** the SVS 64-cell table (Mills et al. 2014), stages 1–4. Stage 5 (unsalvageable foot) is left to clinical judgement.

**Wagner (suggested):** whole-foot gangrene → 5 · localised gangrene → 4 · probe-to-bone → 3 · tendon or capsule exposed → 2 · superficial → 1.

**Safety checks.** A *blocking* check needs a documented override reason, or the item removed, before the consultation can be signed. All checks and overrides are stored in the record.

| Check | Level |
|---|---|
| Penicillin allergy + a penicillin (e.g. co-amoxiclav) | block |
| Penicillin allergy + a cephalosporin | warn (cross-reactivity) |
| Sulfonamide allergy + cotrimoxazole | block |
| Anticoagulant + NSAID or antiplatelet | warn (bleeding) |
| Kidney disease + NSAID | warn |
| Dialysis + metformin | block · kidney disease + metformin: warn (check eGFR) |
| Contrast study (CT angiography, DSA) + kidney disease or dialysis | warn (nephropathy precautions, hold metformin) |
| Contrast study without creatinine / eGFR ordered | warn |
| 4-layer compression with ABI < 0.8 | block |
| Total contact cast with ischaemia ≥ I2 or infection ≥ fI2 | block |
| HBOT assessment with Wagner < 3 | warn |

The treatment and kidney-dosing checks below add to this list.

**Suggested orders**, which the doctor adds with one click and are never added automatically:

| Finding | Suggested orders |
|---|---|
| No ABI recorded | formal ABI/TBI |
| Probe-to-bone | X-ray, MRI, bone culture |
| Any ischaemia | arterial duplex, lipids |
| CLTI | vascular MDT |
| Infection fI ≥ 2 | CBC, CRP, deep-tissue culture |
| Infection fI 3 | blood cultures |
| Diabetic | HbA1c |
| Diabetic and Wagner ≥ 3 | HBOT assessment |
| Venous ulcer | venous duplex; compression only if ABI ≥ 0.8 |
| Neuropathic ulcer without ischaemia | total contact cast |

**IWGDF/IDSA infection (2019), per wound:**

| Grade | Rule |
|---|---|
| 1 · uninfected | fewer than 2 local signs (swelling/induration, erythema > 0.5 cm, tenderness, warmth, pus) and no pus |
| 2 · mild | 2 or more local signs (or pus), erythema ≤ 2 cm, skin and subcutaneous only |
| 3 · moderate | erythema > 2 cm, or a deep sign (abscess, osteomyelitis, septic arthritis, fasciitis) |
| 4 · severe | infected and 2 or more SIRS criteria |

SIRS criteria are: temperature > 38 or < 36 °C, HR > 90, RR > 20, and WBC > 12 or < 4 if entered. "(O)" is added when osteomyelitis is ticked. WIfI fI = IWGDF grade − 1.

**IWGDF risk category (2019):**

| Category | Rule | Foot check |
|---|---|---|
| 3 · high | LOPS or PAD, plus a history of ulcer, amputation, or end-stage renal disease (dialysis) | every 1–3 months |
| 2 · moderate | LOPS + PAD, LOPS + deformity, or PAD + deformity | every 3–6 months |
| 1 · low | LOPS or PAD | every 6–12 months |
| 0 · very low | none of the above | once a year |

LOPS means loss of protective sensation: abnormal monofilament or vibration. PAD means absent or Doppler-only pedal pulses, ABI < 0.9, or TBI < 0.7. With an active ulcer, the category applies once the ulcer has healed.

**Treatment checks:**

| Check | Level |
|---|---|
| Sharp debridement of dry necrosis or gangrene in a limb with ischaemia ≥ I2 ("keep it dry until revascularised") | block |
| Compression bandage on a limb with ABI < 0.8 | block |
| Total contact cast with ischaemia ≥ I2 or infection ≥ fI2 | block |
| Hydrogel on a heavily exuding wound | warn |
| Occlusive dressing on an infected wound | warn |
| NPWT over necrotic tissue | warn |
| Plantar diabetic ulcer without offloading | warn |

**Kidney dosing**, using the eGFR from the History tab. Each check offers an **Apply** button that sets the adjusted dose:

| Situation | Check |
|---|---|
| eGFR < 30 | co-amoxiclav 625 mg BD (after dialysis if on dialysis) |
| eGFR < 15 or dialysis | cotrimoxazole is blocked |
| eGFR 15–30 | cotrimoxazole: half dose |
| eGFR < 30 | cefuroxime once daily |
| eGFR < 30 | pentoxifylline BD |
| eGFR 30–60 | pregabalin 75 mg once daily |
| eGFR < 30 or dialysis | pregabalin 25 mg once daily |
| Kidney disease with no eGFR entered | warn |

### 4.4 Signing and outcomes

The doctor ticks the attestation, re-enters the PIN (demo **1234**) and signs.

Signing does the following:
- Hashes the record.
- Adds an `author` entry to the sign-off ledger.
- Writes the audit log.
- Moves the patient to the chosen outcome:

| Outcome | Status |
|---|---|
| Home · checkout & follow-up (follow-up interval required) | `to checkout` |
| Dressing room / procedure today | `for procedure` |
| Admit to ward | `admitted` |
| Emergency department | `sent to emergency` |

**Trainees** (senior house officer) can sign. Their consultation is marked *awaiting consultant*, and a **countersignature request** goes to *Review & sign-off*. When a consultant signs it there, the record shows the consultant's name.

**Send for tests** needs at least one order. The patient moves to **At tests** with the consultation still open. **Results back** returns them to *Ready for doctor*, marked *back from tests*. The next doctor to call them sees the saved draft.

### 4.5 What the consultation produces

- **ConsultRecord** on the registration (see §6), bound to its content hash.
- Ledger entry, audit entries and history events. For trainees, also a pending countersignature.
- **Seen today** list with a read-only record view.

---

## 5. Step 4 — after the doctor

The doctor's signed outcome sends the patient down one of three branches. **Today's patient flow** (`/clinical/flow`) shows every patient of the day on one board.

### 5.1 Today's patient flow

**Screen:** `/clinical/flow` · **Code:** `web/src/app/clinical/flow/Flow.tsx`

The board has eight stage columns: waiting for nurse, nursing assessment, waiting for doctor, with doctor, at tests, procedure / dressing, waiting for a bed, checkout.

- **Cards:** each shows the token, name, minutes in the stage and minutes since arrival. It turns amber, then red, past per-stage limits (for example waiting for doctor 30 / 60 min; checkout 15 / 30 min). Clicking a card opens the screen that moves the patient on.
- **KPIs:** in the building; median door-to-doctor (registration → consult room); median length of visit (registration → checkout); stuck (over the red limit); finished (home, admitted, Emergency).
- **Finished today:** a list of patients who have left the outpatient flow.

### 5.2 4A · Checkout (front desk)

**Screen:** `/clinical/checkout` · **Code:** `web/src/app/clinical/checkout/Checkout.tsx` · **Rules:** `web/src/lib/cx/checkout.ts`

The queue lists patients `to checkout`, oldest signed consultation first. Checkout has five sections:

| # | Section | What happens |
|---|---|---|
| 1 | Next appointment | The clinic is suggested from the patient's queue; each clinic runs on set days (Wound clinic Mon/Wed/Fri, Diabetic foot Tue/Thu/Sat, Vascular OPD Mon–Sat, HBOT assessment Wed/Fri). The first date offered is the doctor's follow-up interval from today, with the next six clinic dates shown. 15-minute slots 09:00–12:45; slots already booked in the clinic book (and ~40% demo bookings) are struck through. Or *No follow-up needed* with a reason |
| 2 | Visit summary and prescription | Printable document in the Indian prescription format: centre header, doctor's qualifications and **State Medical Council registration number**, patient identifiers (MRN, ABHA if present), allergy banner, diagnosis, findings, treatment today and home wound care, **Rx with generic names in capitals**, changes to current medicines, tests to be done, referrals, instructions, "come back at once if…" (108 for emergencies), next visit, HBOT plan if any. Mark as printed, sent by SMS/WhatsApp in the patient's language, or uploaded to ABHA |
| 3 | Letter to the referring doctor | Written automatically from the consultation (diagnosis, ABI, WIfI, wounds, treatment today, new medicines and changes, investigations, plan, next review). Editable; sent via referral portal, email or printed; "self-referred" skips it |
| 4 | Home care | Only when the dressing plan says family, patient or home-care nurse: supplies issued, family taught, home-care visit booked, offloading device fitted |
| 5 | Bill and payment | Items from the consultation (consultation new/follow-up, bedside ABI, debridement and dressing per wound, NPWT, offloading device) at the demo tariff. Coverage by payer — see below. Payment by UPI, cash or card; credit or waiver when nothing is payable. Receipt number issued on completion |

**Payer rules at an outpatient visit (demo policy):**

| Payer | Rule |
|---|---|
| PM-JAY / CMCHIS | These schemes pay for admissions, not outpatient visits. Hospital policy (demo): consultation, ABI, debridement and dressings free for beneficiaries; devices charged |
| CGHS / ESI | Billed to the payer on credit; the patient pays nothing today |
| Corporate panel | Consultation and procedures billed to the company; devices self-pay |
| Private insurance | Patient pays and claims later; itemised bill given |
| Self-pay | Everything is payable. No GST on clinical services |

**Completing checkout** sets the status to `checked out`. It also books the appointment in the clinic book (`State.appointments`), queues an SMS reminder in the patient's language, and writes the receipt, the audit entry and the history. **Checked out today** keeps the receipt, the visit summary and the letter for reprinting.

### 5.3 4B · Tests & procedures

**Screen:** `/clinical/services` · **Code:** `web/src/app/clinical/services/Services.tsx` · **Rules:** `web/src/lib/cx/services.ts`

**Results desk (patients `at tests`).** Each ordered test has its own result form, grouped by vascular lab, imaging and laboratory:
- **Vascular lab:** formal ABI/TBI, arterial duplex by segment, venous duplex with DVT, TcPO₂.
- **Imaging:** X-ray main finding, MRI (osteomyelitis and abscess), CT angiography / DSA (revascularisation option).
- **Laboratory:** HbA1c, CBC, CRP/ESR, creatinine/eGFR/potassium, LDL, blood and tissue cultures (which may go back as *pending*).

Non-test orders (e.g. debridement) are listed separately.

**Critical results** (rule A05) must be phoned to a doctor, with who took the call recorded, before the results can be sent back:

| Area | Critical when |
|---|---|
| Kidney | eGFR < 30 or K⁺ > 6.0 |
| Blood count | Hb < 7, WBC > 20 or platelets < 50 |
| Perfusion | ABI < 0.4 or TcPO₂ < 30 |
| Imaging | gas in soft tissue on X-ray, or abscess on MRI |
| Vascular lab | DVT; popliteal and tibial occlusion |
| Microbiology | positive blood culture |

*Send results to the doctor* returns the patient to *Ready for doctor* (marked *back from tests*) and copies HbA1c, eGFR and WBC into the open consultation. The consultation's Nursing tab shows the results, with the critical and pending flags.

**Dressing room (patients `for procedure`).** For each wound, the nurse records whether the doctor's dressing plan was applied (or what was done instead), with pain before and after. Safety checks:

| Situation | Check |
|---|---|
| Compression | toes warm and pink afterwards; blocked if ABI < 0.8 |
| NPWT | seal checked at −125 mmHg |
| Dressing-room debridement | consent confirmed and the performing doctor named |

At least one patient-education item is required.

**HBOT assessment** (when *HBOT assessment* was ordered). Rule A25 gates:

| Gate | Condition |
|---|---|
| Indication | chosen |
| Wagner | ≥ 3 (diabetic foot ulcer indication) |
| Standard care | ≥ 30 days |
| Perfusion | adequate (ABI ≥ 0.8) or revascularised |
| Tissue hypoxia | TcPO₂ < 40 mmHg (pre-filled from today's result) |
| Contraindications | no absolute contraindication (untreated pneumothorax, bleomycin / cisplatin / doxorubicin, disulfiram) |

Relative contraindications are listed for management.
- **All gates met:** the pre-course checks are required (chest X-ray, ECG, otoscopy, perfusion, glucose ≥ 120 mg/dL before each session per rule A26), then the course is planned (20/30/40 sessions, 2.4 ATA, 90 min, 5 a week, start date).
- **Any gate failed:** a reason for deferring or declining is recorded.

*Done* sends the patient to checkout, and the HBOT plan is printed on the visit summary.

### 5.4 4C · Admission

**Screen:** `/clinical/admit` · **Code:** `web/src/app/clinical/admit/Admit.tsx` · **Rules:** `web/src/lib/cx/admit.ts`

The queue lists patients `awaiting admission`, oldest decision first, with emergency / today / planned, isolation and ICU badges suggested from the consultation. Admission has five sections:

| # | Section | What happens |
|---|---|---|
| 1 | Admission details | Urgency (emergency now / urgent today / planned with a date), unit (vascular ward or ICU), planned treatment, consultant in charge, expected stay, diet, **isolation** (suggested for severe infection or abscess, not for bone infection alone), risks for the ward (fall, pressure injury, VTE within 24 h, anticoagulant bridging, contrast precautions) |
| 2 | Financial clearance | **PM-JAY / CMCHIS:** choose packages (demo codes) → submit pre-authorisation → record the approval number. **Private insurance:** cashless request to the TPA, same steps. **CGHS / ESI / corporate:** credit letter or referral number. **Self-pay:** estimate (packages + bed charges), financial counselling, deposit and payment mode. **Emergency admissions are never delayed**: clearance is completed within 24 h |
| 3 | Bed | Live bed board for Chennai: vascular ward VW-01–24 (VW-21–24 side rooms) and ICU-01–08 (ICU-08 side room). Occupancy combines the ward fixture (with transfers/discharges) and today's admissions. Isolation allows side rooms only |
| 4 | Consent and documents | General consent for admission signed on the pad (explained in the patient's language); IP wristband (required); attendant pass; belongings list; ward informed |
| 5 | Handover (SBAR) | Written from the consultation: situation, background (past history, allergies, medicines held), assessment (NEWS2, ABI, wounds, WIfI), recommendation (treatment, isolation, diet, risks, new medicines). Editable, with "rewrite from the current details" |

*Admit* issues an **IP number**, sets the status to `admitted`, and puts the patient on the **Ward round** in-patient view under "Admitted today from the outpatient clinic". The bed board and ward counts update.

---

## 6. Data handed forward

Stored in the browser for the prototype (`web/src/lib/cx/store.ts`, key `prototype.clinical.v1`); in production this is the encounter record in the clinical database.

```
Registration
  id, epi (enterprise ID), mrn, token, queue, queueLabel, priority, centre, at, by
  returning, pid (patient-master link), emergencyQuick
  name, age, ageApprox, dob, sex, phone, phoneVerified, language, address…, kin, abha, idSeen
  arrival, referredBy, visit, complaint, redFlags[]
  clinical { diabetes, dmYears, insulin, ckd, dialysis, prevAmp, prevRevasc, anticoag,
             smoking, allergies, woundSite, woundWeeks, mobility }
  scheme, schemeId, consent { care, share, research, photo }
  status, bay, calledAt, recalls, requeuedAt
  notes[]   { at, by, text }        – visible to the doctor
  history[] { at, by, text }        – every queue / bay / status event
  draft                             – in-progress assessment form
  triage: TriageRecord

TriageRecord
  at, by, idChecked
  vitals { rr, spo2, o2, hr, sbp, dbp, pulse, temp, avpu, cbg, pain, weight, height }
  news, newsThree, algo ("NEWS2 · RCP 2017 · SpO₂ scale 1")
  limbs { right{dp,pt,colour,temp,sensation,swelling}, left{…}, crt, restPain, claudicationM }
  wound { site, length, width, depth, area, bed, exudate, odour, erythemaCm, probeBone, photo, photoIds[] } | null
  infection, flags[], category, suggested, overrideReason, actions[], note

Registration.photos[]  (WoundPhoto)
  id, at, by, site, dataUrl (resized JPEG), w, h, kb, marker, source, note, woundRef? (consultation wound)
State.woundPhotos{ woundId: WoundPhoto[] }   (ward Wound & HBOT screen)

Registration (step 3 additions)
  room, doctor, seenAt, testsAt, backFromTests
  consultDraft                      – in-progress consultation (kept while at tests)
  consult: ConsultRecord

ConsultRecord
  at, by, byRole, room
  hpi, duration, symptoms[], pmh[], meds, allergies, hba1c
  pulses { fem, pop, dp, pt: { r, l } }
  abi { r, l, tbiR, tbiL, notDone? }
  wounds[] { n, side, site, location, length, width, depth, area,
            tissue { granulation, slough, necrotic, epithelial }, undermining, tunnelling,
            exposed[], probeBone, periwound[], exudate, gangrene,
            infection { local[], deep[], erythemaCm, grade, label }, wagner, ut, photoIds[] }
  limbs[] { side, w, i, fi, stage, risk }            – per-limb WIfI
  footExam { right/left { vibration, reflex, deformity[], callus, skin[] },
             footwear, ulcerHistory, risk { cat, label, interval } } | null
  treatment { debridements[] { wound, method, anaesthesia, removed[], depthTo, haemostasis, tolerated },
              dressings[] { wound, primary, secondary, freq, by }, offload }
  medRec[] { drug, dose, action, reason }, egfr, wbc
  antibiotic { indication, culture, duration, review } | null
  bmt[] { label, met, reason? }
  discussion { present[], interpreter, discussed[], decision, goals, teachBack }
  consent { type, by, relName, risks[], signed, witness } | null
  (woundExam / wagner / ut / wifi: single-wound fields kept for records signed before Round 1)
  diagnoses[] { id, code (ICD-10 WHO), label, side }
  orders[], rx[] { drug, dose, route, freq, days }
  alerts[] { text, level, override? }
  plan, instructions[], disposition, followUp
  hash, countersign ("not needed" | "awaiting consultant" | consultant name)

Registration (step 4 additions)
  results[]  { order, dept, at, by, values{}, critical, informed }      – 4B results desk
  procedure  { at, by, wounds[] { wound, plan, applied, actual, painBefore, painAfter },
               checks[], debridedBy, education[],
               hbot { indication, absolute[], relative[], checks[], gates[], eligible, decision,
                      plan { sessions, ata, minutes, start } } | null }            – 4B dressing room
  checkout   { at, by, appointment { date, time, clinic, doctor } | null, noFollowUpReason,
               documents[], homeCare[], letter { to, via, text } | null,
               bill { payer, items[] { item, amount, covered }, total, payable, mode, receipt, note } }
  admission  { at, by, ipNo, unit, bed, urgency, plannedDate, indication, procedures[], consultant,
               expectedDays, isolation, diet, risks[],
               payer { scheme, kind, packages[], estimate, preauth { status, ref }, deposit, mode },
               documents[], handover }
State.appointments[] { id, regId, name, mrn, date, time, clinic, doctor, at, by }   – clinic book
```

---

## 7. Demo script

1. Sidebar → **Signed in as: Kavya R.** → *1 · Registration*.
2. Search `Fatima` → *This is the patient* (returning). Or register a new patient; OTP is **4829**; draw a signature.
3. Try a red flag (e.g. *leg suddenly cold*) → emergency mode → **Register & send to Emergency**.
4. **Signed in as: Sr. Revathi S.** → *2 · Initial nursing assessment*. If the queue is empty: **Load demo arrivals**.
5. **Call next** into Bay 1 → fill vitals → note the NEWS2 colouring → **Next: Foot & limb** → pulses from the dropdowns → **Wound** tab → size, bed and **Upload from device** (any image works) → summary suggests a category.
6. Click another waiting card → mark priority (reason) → add a note → watch the queue re-order.
7. Open **Actions** on a bay → recall three times → *Not responding → re-queue*.
8. Complete assessment → the bay frees → click the patient in *Ready for doctor* to see the record → *Reopen assessment to correct*.
9. **Signed in as: Dr. Meera Krishnan** → *3 · Doctor consultation*. If nobody is waiting: **Load demo patients** (three assessed patients: Urgent CLTI, Standard infected DFU with a penicillin allergy, Routine venous ulcer).
10. Call V-80 (Urgent CLTI):
    1. **History:** write the history of the complaint.
    2. **Exam:** brachial 150/146, left ankle DP 50 / PT 56 (ABI 0.37); vibration and footwear. Watch the IWGDF foot risk turn 3 (high).
    3. **Wounds:** wound 1 is pre-filled; enter 100% necrotic. The left limb shows **WIfI stage 4**. Add a right heel wound, tick two local signs, and see IWGDF 2 with the right limb staged separately.
    4. **Treatment:** tick *Debrided* on the toe and see the "keep it dry" block, then undo it. Set dressings for both wounds and a post-operative shoe.
    5. **Diagnosis:** add the suggested diagnoses, then **Add all** orders.
    6. **Medicines:** hold the anticoagulant (with a reason); add clopidogrel, atorvastatin and a nicotine patch from the best-medical-therapy rows.
    7. **Consent:** amputation risk must be discussed and a decision recorded; tick teach-back.
    8. **Plan & sign:** Admit, then sign with PIN 1234.
11. **Signed in as: Dr. Neha Bose** (trainee), call D-81:
    1. **History:** eGFR 25.
    2. **Exam:** vibration absent both feet, barefoot.
    3. **Wounds:** tick swelling and warmth → IWGDF 3 moderate, Wagner 3.
    4. **Treatment:** sharp debridement, silver dressing, knee-high walker.
    5. **Medicines:** co-amoxiclav is blocked by the penicillin allergy; use clindamycin and fill in the stewardship fields. Add pregabalin and **Apply** the kidney dose.
    6. **Consent:** written procedure consent, signed on the pad.
    7. **Send for tests**, then **Results back**, then call again (the draft is kept).
    8. **Plan & sign:** checkout, 1 week, sign. A countersignature request goes to the consultant.
12. **Review & sign-off** shows the nurse attestations and countersignature requests (including the trainee's consultation); **Access audit** shows every step.
13. **Signed in as: Sr. Revathi S.** → *4B · Tests & procedures* → **Load demo patients**.
    1. **Results desk:** open D-50 and enter the results; eGFR 28 raises a critical flag. Record who was told, mark the blood culture pending, and send the results back. As the doctor, the results appear on the Nursing tab and eGFR/WBC are copied in.
    2. **Dressing room:** W-52 has compression, so the toe check is required. D-53 has NPWT, debridement and an HBOT assessment: all gates are met with TcPO₂ 28, so tick the pre-course checks and pick a start date. Both patients go to checkout.
14. **Signed in as: Kavya R.** → *4A · Checkout* → **Load demo patients**.
    1. D-70 (CMCHIS): pick a slot, preview and print the prescription, add the appointment to the letter, tick the home-care items; ₹6,000 walker by UPI.
    2. W-71 (self-pay, cash) and V-72 (CGHS credit, ABHA upload).
15. *4C · Admission* → **Load demo patients**.
    1. D-61 is an emergency: isolation allows only ICU-08.
    2. V-60 is PM-JAY: submit the pre-authorisation and record an approval number.
    3. D-62 is self-pay, planned: counselling, deposit and date.
    4. Each needs the consent signature, the wristband and a check of the SBAR. Then open *Ward round* to see the three new in-patients.
16. *Today's patient flow* shows where everyone is and how long they have waited.

*Reset prototype data* (sidebar footer) clears everything.

Automated browser walk-throughs used during development are in the session scratchpad (`reg.mjs`, `tri.mjs`, `bay.mjs`, `wnd.mjs`, `con.mjs`, `chk.mjs`, `adm.mjs`, `svc.mjs`); they are not yet part of the repo.

---

## 8. Decisions for clinical sign-off

These are working defaults written for the prototype. Each needs a named clinical owner before real use.

| Area | Current default |
|---|---|
| Desk red-flag questions | six questions in §2.2 |
| Registration priority criteria | age ≥ 75, wheelchair/stretcher, dialysis, rest pain, toe discolouration |
| Fall-risk criteria | not walking unaided, or age ≥ 80 |
| Triage category thresholds | §3.4 |
| Target times | Urgent 15 min · Standard 60 min · Routine 120 min |
| Infection grading | simplified IWGDF/IDSA (§3.4) |
| Glucose thresholds | < 54 emergency · < 70 / > 300 urgent |
| Waiting-time alert | red after 30 min |
| Re-queue rule | after 3 calls, behind patients of the same priority |
| Bays | Assessment bay 1–3 and Dressing room |
| ABI / TBI bands | AHA/ACC 2016 (§4.3) |
| WIfI grades and stage table | SVS, Mills et al. 2014 (§4.3), transcribed for the prototype: **verify every cell against the published table** |
| Wagner / University of Texas suggestions | §4.3 |
| Suggested diagnoses and ICD-10 codes | WHO ICD-10 codes chosen for the demo; the coding team confirms (ICD-10-CM differs) |
| Drug formulary and doses | demo list of typical adult doses, not a verified drug database |
| Safety checks | the order, drug, treatment and kidney-dosing checks in §4.3 (need pharmacy and vascular sign-off) |
| IWGDF/IDSA infection grading and SIRS in clinic | §4.3; WBC only when entered |
| IWGDF risk category and screening intervals | §4.3 (IWGDF 2019) |
| Kidney dose adjustments | §4.3, typical values for the demo formulary — pharmacy to confirm |
| Best medical therapy targets | antiplatelet, high-intensity statin, BP < 140/90, HbA1c < 8%, smoking cessation (ESVS / Global Vascular Guidelines) |
| Required documentation | dressing plan for every wound, offloading for plantar DFU, reason for any stopped/held medicine, amputation-risk discussion for CLTI / WIfI 4, teach-back, procedure consent (written needs a signature) |
| Trainee countersignature | every trainee consultation, any outcome |
| Consult rooms | three |
| Clinic sessions and slots | days per clinic, 15-minute slots 09:00–12:45 (§5.2) |
| OPD tariff | demo rupee amounts (§5.2) — finance to replace |
| Scheme / payer policy at OPD | §5.2 — especially what is free for PM-JAY / CMCHIS beneficiaries |
| Prescription format | NMC generic-name guidance, registration number, "come back at once" text (§5.2) |
| Critical-result thresholds | §5.3 (rule A05) — laboratory and radiology to confirm |
| HBOT gates and course defaults | rule A25 gates, 2.4 ATA × 90 min, glucose floor 120 mg/dL (A26) |
| Admission packages and rates | demo codes, not the official package master |
| Isolation criteria | severe infection or abscess → side room (infection control to confirm) |
| Emergency admission clearance | admit now, clearance within 24 h |
| Bed layout | Chennai VW-01–24 (side rooms 21–24), ICU-01–08 (side room 08) |

## 9. Known limitations of the prototype

- Data lives in the browser; there is no server, so two computers do not share a queue.
- Photos are stored as data URLs in browser storage (about 5 MB in total). If storage fills up, the screen warns that the photos will not survive a reload. Production would upload the original to object storage via a signed URL and keep only metadata in the database.
- Photos taken at the nursing assessment are shown in the doctor consultation, but not yet on the ward Wound & HBOT screen (the demo patients are not the seeded ward patients).
- A signed consultation cannot be amended from this screen yet (the sign-off screen's amendment flow is not wired to consultations).
- Patients admitted from the clinic appear on the Ward round in their own card; the full ward chart (hourly observations, visit notes) still covers only the seeded ward patients.
- Clinic slot availability is partly simulated; SMS reminders, scheme portals (TMS), TPAs and ABHA uploads are not connected.
- The HBOT course planned in the dressing room does not yet create sessions on the Wound & HBOT screen.
- The drug checks are a small illustrative set, not a drug-interaction database.
- Wound-bed percentages and sizes are entered by hand; there is no measurement from the photo yet.
- The consent signature is a drawn mark on screen; production needs an e-signature with identity checks and a stored image.
- Announcements are on-screen toasts, not a real calling display or SMS.
- New registrations do not yet appear in the *Patient master* screen.
- Emergency-department care after escalation is not modelled beyond the list.
- Registration and nursing assessment are Chennai-centred in the demo (the desk and assessment users are Chennai staff).

## 10. Next steps

| Step | Scope |
|---|---|
| Consultation round 2 | Previous-visit comparison (wound area trend), addendum after signing |
| Ward | Admission clerking, daily ward round for OPD admissions, theatre list, discharge summary back to checkout |
| HBOT | Sessions from the planned course, in-chamber glucose (A26), session-20 review (A28) |
| Returning patients | Arrival for a booked appointment from the clinic book, recall list from the IWGDF risk interval |
