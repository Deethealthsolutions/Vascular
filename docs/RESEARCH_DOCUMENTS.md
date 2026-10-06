# Research documents register

**Screen:** sidebar → Research → **Research documents** (`/clinical/research-docs`)
**Code:**
- Screen: `web/src/app/clinical/research-docs/ResearchDocs.tsx`
- Storage: `web/src/lib/research/repo.ts`
- Scanning: `web/src/lib/research/extract.ts`
- Rules: `web/src/lib/research/types.ts`

**Database:** `supabase/migrations/20261005000000_research_documents.sql`

The hospital's research papers exist on paper and as PDF, Word, Excel and image files. This register gives each research record a **running register number** for its physical file. It stores the originals, scans them to text that can be corrected, and moves the record through **Draft → In review → Approved → Complete**. Every step is kept for later verification.

## 1. Connect Supabase

1. Create a Supabase project (or use the hospital's).
2. In **SQL editor**, run the migrations in order:
   - `supabase/migrations/20261005000000_research_documents.sql`
   - `supabase/migrations/20261006000000_research_assigned_reviewer.sql` (adds the assigned reviewer)

   Together they create:
   - **4 tables:** documents, files, text versions, events
   - **the register sequence** behind the running number
   - **guard triggers** that enforce the workflow rules
   - **a private storage bucket**, `research-files` (50 MB per file)
3. Copy `web/.env.example` to `web/.env.local` and fill in **Project settings → API**:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR-ANON-KEY
   ```
4. Restart `npm run dev`. The banner on the screen changes from **Local demo mode** to **Connected to Supabase**.

Without keys the screen runs in **local demo mode**:
- **Storage:** records stay in the browser's localStorage and files in IndexedDB, on this computer only.
- **Rules:** register numbers and workflow rules are the same as with Supabase.
- **Demo data:** three historical records are pre-loaded.
- **Forcing it:** setting `NEXT_PUBLIC_RESEARCH_STORAGE=local` in `.env.local` forces local demo mode even when keys are set, for training or testing without touching the real register.

> **Before real data:** the migration's row-level-security policies are **demo policies**. They let the anon key read and write because the prototype has no real sign-in. Switch the app to Supabase Auth and replace them with role-based policies first; the SQL file marks where. No policy allows deleting anything.

## 2. Register number

- **Issued by the database** when the record is created, from a Postgres sequence: `RES-<year>-<5 digits>`, e.g. `RES-2026-00004`. The year is in India time.
- **Never reused or changed:** the sequence moves forward even if a record is abandoned, and a trigger blocks any change to the number.
- **Printable label:** the screen offers a label (number, title, investigator, department, year) to stick on the physical folder.

## 3. Upload and scan

Accepted: **PDF, DOC, DOCX, XLS, XLSX, CSV, TXT, PNG, JPG, BMP**, up to 50 MB each. Several files can be dropped at once.

| File | How the text is read | Notes |
|---|---|---|
| PDF | pdf.js text layer | Pages with no text (scanned pages) are rendered and read by OCR; the confidence is shown |
| DOCX | mammoth | Raw text, no formatting |
| DOC (legacy Word 97–2003) | Text runs recovered from the binary file | Approximate. Flagged for review; save as DOCX or PDF for a clean scan |
| XLS / XLSX / CSV | SheetJS | Every sheet, as CSV |
| PNG / JPG / BMP | tesseract.js OCR (English) | Low confidence (< 70%) is flagged |

For each file:
- **Fingerprint:** a **SHA-256** is computed in the browser, and the same file can't be uploaded twice.
- **Storage:** the original goes to storage and the scanned text is kept with the file row.
- **Record text:** the scanned text is appended to the record's text under `=== file name ===`.

Scanning runs **in the browser**. OCR downloads its engine and English language data the first time; if the hospital network blocks CDNs, these files can be self-hosted.

Per-file actions:
- **Text:** show exactly what was read from the file.
- **Original:** open the stored file.
- **Verify:** re-download it and check its SHA-256.
- **Remove** (drafts only): the row is marked removed, and the original stays in storage for audit.

## 4. Correct the text

- **Edit:** the record text is editable **only while the record is a Draft**, and only by authors.
- **Save:** creates a numbered **version**, with an optional note such as "fixed OCR in table 2".
- **Versions:** every version is kept (extracted / edited / restored). Any earlier version can be viewed and restored, and restoring saves it as a new version.

## 5. Workflow

| Step | Who | Rules |
|---|---|---|
| **Draft** | Authors: research staff, consultants, trainees | Upload, edit text and details. **Submit for review** needs ≥ 1 file, saved text, no unsaved edits, and an **assigned reviewer** chosen from the list |
| **In review** | **The assigned reviewer only** | Text and files are locked. **Approve** needs a tick that the text was checked against the originals. **Return to draft** needs a comment |
| **Approved** | Data custodian | **Mark complete** needs the physical archive location and confirmation that the paper copy is filed with the register number |
| **Complete** | — | Read-only. Files can still be opened and verified |

**Assigning the reviewer**
- **The list:** everyone allowed to review (consultants and the research monitor), **minus the submitter**.
- **Resubmitting:** a resubmission after a return pre-selects the previous reviewer.
- **Others:** everyone else sees "Waiting for *name*'s review", and the reviewer's name shows in the register grid.
- **Reassigning:** while a record is in review, the **submitter**, the **current reviewer** or the **head of service** can reassign it to another reviewer with a reason; the change is written to the history.
- **"Waiting for my review"** filters the grid to the records assigned to you.
- **Who's on the list:** in the prototype it comes from the staff directory. In production it would come from the hospital's user list (Supabase Auth).

The database trigger enforces the same rules, so a client that skips the screen cannot break them:
- the allowed status changes
- a reviewer must be assigned to submit, and never the submitter
- only the assigned reviewer can approve
- no self-approval
- archive location required to complete
- no edits outside Draft
- completed records frozen
- files added only to drafts, and file fingerprints never changed
- versions and events append-only

## 6. Register grid

- **Status tiles:** All / Draft / In review / Approved / Complete, each with a count; click a tile to filter.
- **Search:** by register number, title, investigator, department or keyword.
- **Columns:** register number, title and keywords, investigator, department / type, status, last update.
- **Open a record:** click a row.

## 7. Limitations

- **Demo security:** RLS is demo-only (see §1), and the signed-in person is the prototype's "Signed in as" choice, not a real login.
- **OCR:** English only. Handwriting and poor scans need manual correction.
- **Legacy .doc:** recovery is best-effort.
- **Single-file HTML / shared page:** this screen needs the running app, so it shows a note instead.
- **Untested against a live project:** the Supabase path was built to the migration but not run against a real project. The local demo path was tested end to end with all supported formats.
