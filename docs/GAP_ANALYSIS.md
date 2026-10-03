# Gap analysis: requirements vs mockup vs new UI

**Date:** 2026-09-25
**Compared:**
- `Hospital_Development_Requirements.html`: the requirement set (REQ-*), plus the non-functional section
- `Hospital_Vascular_UI_Mockup.html`: the single-file clickable mockup
- this repository: the earlier build (public site and walk-in `/staff` flow) and the new clinical workspace at **`/clinical`**

There is a live, filterable version of this table in the app at **`/clinical/requirements`**, driven by `web/src/lib/cx/requirements.ts`.

A requirement counts as **met** only when the behaviour works in the UI. A screen that only describes the behaviour counts as **partial**.

---

## 1. Summary

| | Met | Partial | Missing | Future phase |
|---|---|---|---|---|
| Mockup | 17 | 16 | 6 | 5 |
| New UI (`/clinical`) | 35 | 5 | 0 | 4 |

(44 items: 39 REQ-* rows plus 5 non-functional rows.)

**Main finding:** the mockup is a strong *visual* and *information-design* reference. Its governance behaviour, which is the part the requirements care most about, is described rather than implemented. Every "Sign", "Adjudicate", "Save" and "Submit" button in the mockup is inert, and switching role only changes the landing screen. The new UI keeps the mockup's design system and fixture data and makes those actions work end to end.

**The earlier build in this repo** (public website, referral portal, single-clinic `/staff` walk-in flow) met almost none of these requirements. It had no multi-centre model, patient master, NEWS2, trends, sign-off ledger, research zone or HBOT tracking. It was built against a different brief: US-style, patient-facing and single-site. It stays in the repo for the public-facing side; `/clinical` is the hospital system.

---

## 2. Gaps in the mockup, and how the new UI closes them

| Requirement | Gap in mockup | New UI |
|---|---|---|
| REQ-PROF-001 | One MRN per profile | Centre-MRN list per patient (registration, referral episode, signed merges) |
| REQ-PROF-004 | Adjudicate button inert | Side-by-side comparison → consultant proposes → a **different** consultant signs; merges are reversible the same way |
| REQ-CARE-001 | IP and OP only | IP / OP / Emergency / Day-case tabs with counts per centre |
| REQ-CARE-002 | Bed only | Transfer (unit/bed history) and discharge (summary drafted to sign-off) |
| REQ-CARE-003 | Read-only clinic lists | Arrived / DNA / outcome + follow-up; a DNA creates a recall in the safety net |
| REQ-CHART-002 | No creatinine channel | Creatinine zoom at draw times with 1.5× / 2× baseline lines |
| REQ-NURSE-001 | No HR field; Save inert | All fields, range validation, attestation, timestamped rows, offline queue |
| REQ-NURSE-002 | Live score only | NEWS2 ≥ 5 or any single 3 creates a high-priority countersign item |
| REQ-VISIT-001 | No medication changes; Sign/Save inert | Medication-change table, HBOT note, draft → submit → sign → amend (versions kept) |
| REQ-VISIT-002 | Voice simulated, nothing enforced | Voice notes flagged as AI drafts with model attribution; extraction logged |
| REQ-WOUND-001 | Laterality and status implicit | Explicit laterality and status |
| REQ-WOUND-004 | Consent described only | Every image use checked against patient consent at read time; refusals logged |
| REQ-RES-003 | Extract builder inert | Allow-list-only selection → custodian signs → materialises with released and **withheld (consent)** counts |
| REQ-SIGN-001…004 | Ledger static | PIN re-authentication, attestation checkbox, SHA-256 content hash, separation-of-duties checks, amendments supersede, no AI signer |
| NFR security | Role toggle only changes landing page | 8 named staff with role- and centre-scoped screens and chart access; denials shown and logged |
| NFR audit | None | Access audit screen: reads, writes, signatures, AI actions, exports, refusals; per-patient access report; CSV |
| NFR availability | None | Bedside observations queue offline and sync on reconnect |
| NFR data quality | None | Each observation stores entry mode, author, time and NEWS2 algorithm version |

## 3. What is still open

| Item | Status | What is needed |
|---|---|---|
| REQ-CARE-002 admission | Partial | "Admitted" is a clinic outcome; it does not yet create an in-patient stay and bed |
| REQ-WOUND-002 object storage | Partial | Real object store, hashing on upload, tiering: needs a backend |
| REQ-LAKE-002 broker | Partial | Broker *workflow* works; the lake itself is Phase 5 |
| NFR security enforcement | Partial | Access rules run in the browser. Production must enforce them in the API gateway |
| NFR performance | Partial | Fixtures render instantly; needs load testing against a real API |
| REQ-GRAPH-004, LAKE-001, AI-001/002 | Future | Phase 5 by design; architecture screen only |

## 4. Other gaps found while comparing

1. **Branding.** The mockup names a real hospital group. The extracted fixtures use neutral names ("Demo Network"). Confirm the real brand before anything is shown outside the team.
2. **Regulatory framing mismatch.** `docs/SPEC.md` (earlier) is written around HIPAA. The requirements target Indian centres (IEC, CTRI, ICMR, DPDP Act 2023). The spec needs a revision for the Indian regulatory context.
3. **Emergency and day-case data.** Neither the mockup nor the requirements supply fixtures for these. The new UI adds a small synthetic set (`web/src/lib/cx/extra.ts`).
4. **Detailed charts are Chennai-only.** The mockup has hourly data for six Chennai patients only; Bengaluru and Hyderabad show roster-level lists. Real data will remove this limit.
5. **Open decisions from the requirements (§18) are all still open.** Identity provider, HIS/EMR integration, retention periods, consent form format, personal-device photography, alert-threshold owners, data custodian workflow, whether the lake is in MVP, and AI hosting.

## 5. How to demo

Run `cd web && npm run dev`, then open `http://localhost:3000/clinical`. Switch people with **Signed in as** in the sidebar. Demo PIN for signing: **1234**.

1. **Sr. Anandhi K.** → Observation entry → pick Anita Sharma → set RR 26, SpO₂ 91 → attest → Save. The NEWS2 escalation goes to sign-off.
2. **Dr. Arun Nair** → Review & sign-off → countersign it (PIN 1234).
3. **Dr. Neha Bose** → Visit analysis → dictate → Submit. The trainee cannot sign their own note; **Dr. Meera Krishnan** can.
4. **Dr. Meera Krishnan** → Patient master → Adjudicate → propose merge. The proposer is blocked from signing it; **Dr. Arun Nair** signs, and the alias MRN appears.
5. **S. Hariharan** → Research → submit an extract; **R. Subramanian** signs; the extract materialises with withdrawn-consent rows withheld.
6. **R. Subramanian** opening a patient chart → access denied and logged. **Sr. Josephine M.** is locked to Hyderabad.
7. Wound & HBOT → Fatima Begum → click a photo → Publication → refused (care-only consent).
8. Access audit → everything above is in the log.

**Reset prototype data** (sidebar footer) clears it all.
