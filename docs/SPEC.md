# Wound & Vascular Center Platform — MVP Specification

**Status:** Draft v0.1 · **Date:** 2026-09-25
**Scope:** Public-facing platform for a specialty practice covering wound care, vascular intervention, limb salvage, diabetic foot care and hyperbaric oxygen therapy (HBOT).

---

## 1. Goals

| Goal | Measure of success |
|---|---|
| Get at-risk patients seen before tissue loss worsens | Days from first contact to first visit (target: < 7 for urgent referrals) |
| Make referring clinicians' lives easier | Referrals submitted online vs. fax; referrer repeat rate |
| Reduce front-desk and prior-auth load | % of new patients with intake + insurance completed before visit |
| Build public trust | Organic traffic to condition pages; self-check completions → bookings |

**Non-goals for MVP:** clinical documentation (EHR replacement), billing/claims, AI wound diagnosis, telehealth video.

---

## 2. Users & roles

| Role | Description | Access |
|---|---|---|
| **Public visitor** | Patient, caregiver, anyone researching | Public site, self-check, booking |
| **Patient** | Has booked or been referred | Own intake, appointments, messages, uploaded photos |
| **Referring provider** | PCP, podiatrist, endocrinologist, nephrologist, home-health nurse | Submit referrals, view status + consult summary for *their* referrals only |
| **Front desk / intake coordinator** | Clinic staff | Referral queue, scheduling, intake review, insurance/prior-auth checklist |
| **Clinician** | Vascular surgeon, wound physician, HBOT physician, NP/PA, wound nurse | Triage referrals, review intake/photos, sign consult summary |
| **Admin** | Practice manager | Content, locations, users, audit logs, outcomes data |

Access control is role-based **plus** relationship-based (a referring provider sees only referrals they sent; a patient sees only their own records).

---

## 3. Phasing

### Phase 1 — MVP (this spec)
1. Public website & patient education
2. "Should I see a specialist?" self-check (educational, non-diagnostic)
3. Online booking + digital intake with wound photo upload
4. Referral portal with status tracking and consult summary return
5. Staff console: referral queue, intake review, prior-auth checklist
6. Public outcomes page (de-identified, manually curated)

### Phase 2
- Patient wound-tracking app (PWA): guided photos, healing timeline, reminders, secure messaging
- HBOT series management: session scheduling, pre-dive checklist, attendance alerts, chamber utilization
- Diabetic foot prevention program: daily foot-check prompts, IWGDF risk-based follow-up cadence
- EHR integration (FHIR) for referral + appointment sync

### Phase 3
- Clinician wound assessment tools (Wagner, University of Texas, WIfI calculators)
- Assisted wound area measurement from photos *(likely FDA SaMD — see §7.4)*
- Automated outcomes dashboard from EHR data
- LLM-assisted drafting of patient education and prior-auth letters (clinician-reviewed)

---

## 4. Functional requirements — Phase 1

### 4.1 Public website
- **Condition pages:** Diabetic foot ulcers, Peripheral artery disease (PAD), Chronic limb-threatening ischemia (CLTI), Venous leg ulcers, Pressure injuries, Non-healing surgical wounds, Radiation tissue injury, Chronic osteomyelitis.
  - Each page: plain-language overview, warning signs, who's at risk, how we treat it, when to call now, CTA (book / refer).
- **Treatment pages:** Endovascular revascularization (angioplasty, stenting, atherectomy), Advanced wound care (debridement, cellular/tissue-based products, NPWT), Offloading & total contact casting, HBOT, Limb salvage surgery, Venous procedures.
- **Team, locations, insurance accepted, contact.**
- **Content managed via CMS** (headless) so clinical staff can edit without deploys; every clinical page carries *reviewed-by* clinician + *last reviewed* date.
- Reading level target: grade 6–8. Spanish at launch; other languages configurable.
- **Accessibility:** WCAG 2.2 AA. Minimum 17px body text, high-contrast mode, everything usable by keyboard and screen reader. Many users are older, diabetic (retinopathy) or have limited dexterity.

### 4.2 Self-check
- 6–10 yes/no questions (wound duration, leg pain on walking, rest pain, color/temperature change, diabetes, prior amputation, signs of infection).
- Output tiers: **Seek emergency care now** (spreading redness + fever, black tissue, sudden cold/pale limb) / **Book a specialist visit** / **Discuss with your doctor**.
- Framed as education — never "you have X". Disclaimer on every result. No PHI stored; anonymous analytics only (tier reached, CTA clicked).

### 4.3 Booking & intake
- **Visit types:** Wound clinic new patient, Vascular consult, HBOT evaluation, Diabetic foot screening.
- **Flow:** visit type → location & slot → patient details → medical history → (HBOT screening if HBOT) → wound photos (optional, up to 5) → insurance → review & confirm.
- **Medical history:** diabetes (type, last A1c if known), smoking status, kidney disease/dialysis, prior amputation, prior vascular procedures, anticoagulants, allergies, current wound duration/location.
- **HBOT screening:** claustrophobia, seizure history, lung disease/prior pneumothorax, recent ear/sinus surgery or infection, pregnancy, current/recent chemotherapy, pacemaker/implanted devices. Positive answers flag for clinician review; they **do not** block booking.
- **Photos:** client-side compression, EXIF/GPS stripped, stored encrypted; linked to intake record.
- **Insurance:** card front/back upload, payer, member ID. Staff sees prior-auth checklist driven by visit type (HBOT & skin substitutes almost always require prior auth).
- Confirmation by email/SMS **without PHI in message body** (link to authenticated portal).
- Slot availability from scheduling system (Phase 1: internal calendar; Phase 2: EHR).

### 4.4 Referral portal
- **Provider onboarding:** self-register with NPI; verified against NPPES registry; practice affiliation.
- **Referral form:**
  - Patient demographics + insurance
  - Referral reason (multi-select): non-healing wound, diabetic foot ulcer, PAD/CLTI, HBOT evaluation, venous ulcer, osteomyelitis, post-amputation wound, other
  - Clinical data: wound location, duration, Wagner grade (optional), ABI/TBI values, signs of infection, recent imaging/labs
  - **Urgency:** Routine (≤ 14 days) / Urgent (≤ 72 h) / Emergent (instruct to send to ED — form shows ED guidance instead of submitting)
  - Attachments: wound photos, notes, vascular studies (PDF/image)
  - Built-in criteria helper: shows PAD referral triggers (ABI < 0.90 or > 1.40/non-compressible, rest pain, tissue loss) and common HBOT indications (UHMS/CMS-covered, e.g. Wagner ≥ 3 DFU after 30 days of standard care, delayed radiation injury, refractory osteomyelitis, compromised grafts/flaps)
- **Status tracking:** Received → Under review → Scheduled (date shown) → Seen → Consult summary sent. Also: Needs info (with message thread), Declined (with reason + alternative).
- **Consult summary return:** signed PDF + structured summary visible in portal; optional Direct message/fax fallback.
- Notifications to referrer on each status change (email without PHI).

### 4.5 Staff console
- Referral queue sorted by urgency and age; SLA timers (urgent referral untouched > 4 business hours = alert).
- Triage actions: assign clinician, request info, schedule, decline.
- Intake review: flagged answers (HBOT contraindications, signs of infection) surfaced at top.
- Prior-auth checklist per patient: required docs, submitted date, payer reference, status.
- Audit log view (admin).

### 4.6 Outcomes page
- Curated metrics, updated quarterly by admin: median days to heal, % healed at 12/20 weeks, major amputation rate among limb-salvage patients, HBOT series completion rate, patient satisfaction.
- Methodology note + minimum cohort size (suppress any metric with n < 11).

---

## 5. Data model (core entities)

```
Patient(id, name, dob, sex, phone, email, preferred_language, address, created_at)
Provider(id, npi, name, specialty, practice_id, verified_at)
Practice(id, name, address, phone, fax)
Location(id, name, address, services[], hours)
Clinician(id, name, role, specialties[], location_ids[])

Referral(id, patient_id, referring_provider_id, reasons[], urgency, status,
         wound_location, wound_duration_weeks, wagner_grade?, abi_left?, abi_right?,
         infection_signs, notes, assigned_clinician_id?, created_at, updated_at)
ReferralEvent(id, referral_id, type, from_status, to_status, actor_id, message?, at)

Appointment(id, patient_id, location_id, clinician_id?, visit_type, starts_at, status, referral_id?)
Intake(id, patient_id, appointment_id, medical_history JSONB, hbot_screening JSONB?,
       flags[], completed_at)
InsuranceCoverage(id, patient_id, payer, member_id, group, card_front_file_id, card_back_file_id)
PriorAuth(id, patient_id, service, payer_ref, status, submitted_at, decided_at)

File(id, owner_type, owner_id, kind[wound_photo|document|insurance_card], storage_key,
     mime, bytes, sha256, uploaded_by, created_at)
ConsultSummary(id, referral_id, appointment_id, author_clinician_id, body, pdf_file_id, signed_at)

User(id, role, email, mfa_enabled, patient_id?, provider_id?, clinician_id?)
AuditLog(id, user_id, action, entity_type, entity_id, ip, user_agent, at)
```

Clinical fields that vary by form version (intake, HBOT screening) are stored as versioned JSONB with a `form_version` key so questions can change without migrations.

---

## 6. Integrations

| System | Phase | Notes |
|---|---|---|
| Headless CMS (e.g. Sanity, Contentful, Payload) | 1 | Public content only — **no PHI** |
| NPPES NPI Registry API | 1 | Verify referring providers |
| Transactional email/SMS (HIPAA-eligible vendor with BAA) | 1 | No PHI in message bodies |
| Scheduling | 1 internal → 2 EHR | |
| EHR via FHIR R4 (Epic, athenahealth, eClinicalWorks, NextGen) | 2 | Patient, Appointment, ServiceRequest (referral), DocumentReference |
| Direct Secure Messaging / eFax | 2 | Consult summaries to non-portal referrers |
| Insurance eligibility (X12 270/271 via clearinghouse) | 2 | |

---

## 7. Security, privacy & regulatory

### 7.1 HIPAA
- BAAs with every vendor that touches PHI (hosting, database, storage, email/SMS, error tracking, analytics if PHI-adjacent).
- Encryption in transit (TLS 1.2+) and at rest (KMS-managed keys). Wound photos in private bucket, access only via short-lived signed URLs.
- MFA required for staff, clinicians and referring providers; optional for patients.
- Audit logging for every PHI read/write; retained ≥ 6 years.
- Session timeout 15 min idle for staff roles.
- Minimum-necessary access enforced in API layer, not just UI.

### 7.2 Public site analytics
- Marketing analytics (pixels, session replay) **must not** load on booking, intake, referral or portal routes — per HHS OCR guidance on online tracking technologies.

### 7.3 Content governance
- Every clinical page has a named clinician reviewer and review date; admin dashboard flags pages > 12 months since review.

### 7.4 FDA / Software as a Medical Device
- Phase 1 features are administrative/educational and intended to stay outside SaMD scope. The self-check gives general education and routing, not a diagnosis.
- Automated wound measurement, AI wound classification or risk scores driving treatment decisions (Phase 3) require regulatory assessment before build.

### 7.5 Clinical safety
- Emergency guidance ("call 911 / go to ED") shown for red-flag answers in self-check, intake and referral forms.
- Portal messaging is non-urgent; every message screen says so, with the clinic phone number.

---

## 8. Non-functional requirements
- **Performance:** public pages LCP < 2.5 s on 4G mid-range phone; statically generated where possible.
- **Availability:** 99.9% for booking and referral portal.
- **Mobile-first:** many patients and home-health referrers will use phones.
- **Localization:** all UI strings externalized; content localized via CMS.
- **Backups:** daily encrypted, point-in-time recovery, restore tested quarterly.

---

## 9. Architecture

```
            ┌──────────────────────────────┐
 Browser ──▶│ Next.js (App Router)         │── Headless CMS (public content)
            │  • public pages (SSG/ISR)    │
            │  • booking / intake / portal │
            │  • server actions + API      │
            └──────────────┬───────────────┘
                           │  authz + audit middleware
            ┌──────────────▼───────────────┐
            │ PostgreSQL (PHI)             │   Object storage (photos/docs,
            │  Prisma/Drizzle ORM          │── encrypted, signed URLs)
            └──────────────┬───────────────┘
                           │  job queue
               Email/SMS · NPPES · (Phase 2: FHIR/EHR, eligibility)
```

- **Stack:** Next.js 16 + TypeScript + Tailwind, PostgreSQL, ORM (Prisma or Drizzle), Auth (Auth.js or a HIPAA-eligible IdP with BAA), object storage with SSE-KMS, background jobs (e.g. pg-boss).
- **Hosting:** HIPAA-eligible cloud with BAA (AWS / Azure / GCP). Note: many popular frontend-hosting platforms offer BAAs only on enterprise tiers — confirm before choosing.
- **Environments:** dev (synthetic data only) → staging → production. Real PHI never leaves production.

---

## 10. Prototype mapping

The clickable prototype in `web/` implements Phase 1 screens with **mock data only**:

| Route | Spec section |
|---|---|
| `/` | 4.1 Home |
| `/conditions`, `/conditions/[slug]` | 4.1 Condition pages |
| `/treatments`, `/treatments/[slug]` | 4.1 Treatment pages |
| `/self-check` | 4.2 |
| `/book` | 4.3 |
| `/refer` | 4.4 Referral form |
| `/portal`, `/portal/[id]` | 4.4 Status tracking & consult summary |
| `/outcomes` | 4.6 |
| `/staff` | 4.5 Staff console: clinic board |
| `/staff/check-in` | 4.5 Front desk registration & check-in |
| `/staff/visit/[id]` | 4.5 Triage, wound assessment, provider orders, vascular lab, checkout |

Not in the prototype: authentication, a real database (referrals and visits are stored in the browser only), EHR integration, CMS.

---

## 11. Open questions
1. Single clinic, hospital-based program or multi-site group? (Affects locations, scheduling, EHR choice.)
2. Which EHR is in use?
3. Languages required at launch beyond English/Spanish?
4. Does the practice already have a website/domain and brand guidelines?
5. Are HBOT referrals accepted directly from patients, or referral-only?
6. Who will own clinical content review?
