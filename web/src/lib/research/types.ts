// Research documents register: record types and the workflow rules.
// The same rules are enforced in the database (supabase/migrations/*_research_documents.sql);
// they are repeated here so the screen can explain why an action is unavailable before trying it.

import { STAFF, type Staff } from "@/lib/cx/users";

export type ResearchStatus = "draft" | "in_review" | "approved" | "complete";

export type ResearchDoc = {
  id: string; register_no: string; title: string; principal_investigator: string; co_authors: string | null;
  department: string | null; study_type: string | null; study_year: number | null; ethics_ref: string | null; keywords: string[];
  status: ResearchStatus; current_text: string; text_version: number; archive_location: string | null;
  created_by: string; created_at: string; updated_by: string | null; updated_at: string;
  submitted_by: string | null; submitted_at: string | null; approved_by: string | null; approved_at: string | null;
  completed_by: string | null; completed_at: string | null;
  /** Reviewer the submitter assigned (only they can approve); reassignable while in review. */
  assigned_reviewer?: string | null; assigned_reviewer_role?: string | null; assigned_at?: string | null; assigned_by?: string | null;
};

export type ResearchFile = {
  id: string; document_id: string; file_name: string; mime_type: string | null; size_bytes: number; storage_path: string; sha256: string;
  extracted_text: string | null; extraction_method: string | null; pages: number | null; ocr_confidence: number | null; warnings: string[];
  uploaded_by: string; uploaded_at: string; removed: boolean; removed_by: string | null; removed_at: string | null;
};

export type ResearchVersion = { id: string; document_id: string; version: number; body: string; source: "extracted" | "edited" | "restored"; note: string | null; created_by: string; created_at: string };

export type ResearchEvent = { id: number | string; document_id: string; at: string; actor: string; actor_role: string | null; action: string; from_status: string | null; to_status: string | null; comment: string | null };

export type NewResearch = Pick<ResearchDoc, "title" | "principal_investigator" | "co_authors" | "department" | "study_type" | "study_year" | "ethics_ref" | "keywords">;

export type Actor = { name: string; role: string };

export const STATUS: Record<ResearchStatus, { label: string; tone: string; step: number }> = {
  draft: { label: "Draft", tone: "n", step: 0 },
  in_review: { label: "In review", tone: "b", step: 1 },
  approved: { label: "Approved", tone: "v", step: 2 },
  complete: { label: "Complete", tone: "g", step: 3 },
};
export const STEPS: ResearchStatus[] = ["draft", "in_review", "approved", "complete"];

export const DEPARTMENTS = ["Vascular surgery", "Diabetic foot", "Wound care", "Hyperbaric medicine", "Interventional radiology", "Nursing", "Podiatry", "Anaesthesia", "Microbiology"];
export const STUDY_TYPES = ["Clinical trial", "Observational cohort", "Case series / case report", "Clinical audit / QI", "Systematic review", "Thesis / dissertation", "Conference abstract", "Protocol"];
export const ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg,.bmp";

// ------------------------------------------------------------------ who can do what

/** Authors: create records, upload, edit text and submit while a record is a draft. */
export const canAuthor = (me: Staff) => me.cls === "research" || me.cls === "consultant" || me.cls === "trainee";
/** Reviewers: approve or return a record in review — consultants and the research monitor. */
export const canReview = (me: Staff) => me.cls === "consultant" || (me.cls === "research" && /monitor/i.test(me.role));
/** Completion: the data custodian files the physical copy and closes the record. */
export const canComplete = (me: Staff) => me.cls === "custodian";

/** People a record can be assigned to for review: reviewers other than the submitter.
 *  Prototype: from the staff directory. Production: from the hospital user list / Supabase Auth. */
export const reviewersFor = (submitter: string, exclude: string[] = []) =>
  STAFF.filter((s) => canReview(s) && s.name !== submitter && !exclude.includes(s.name));

/** Why a workflow action is not available now ("" = available). */
export function blockReason(action: "submit" | "approve" | "return" | "complete", doc: ResearchDoc, me: Staff, ctx: { files: number; unsaved: boolean; reviewer?: string }): string {
  if (action === "submit") {
    if (doc.status !== "draft") return "Only drafts can be submitted.";
    if (!canAuthor(me)) return "Only authors (research staff, consultants, trainees) can submit.";
    if (ctx.files === 0) return "Upload at least one research file first.";
    if (ctx.unsaved) return "Save or discard your text changes first.";
    if (doc.current_text.trim().length < 20) return "The record's text is empty — scan a file or type the summary.";
    if (!ctx.reviewer) return "Choose who should review it.";
    return "";
  }
  if (action === "approve" || action === "return") {
    if (doc.status !== "in_review") return "Only records in review can be approved or returned.";
    if (doc.assigned_reviewer && doc.assigned_reviewer !== me.name) return `Assigned to ${doc.assigned_reviewer} — only they can review it.`;
    if (!canReview(me)) return "Only consultants or the research monitor can review.";
    if (action === "approve" && doc.submitted_by === me.name) return "You submitted this record, so someone else must approve it.";
    return "";
  }
  if (doc.status !== "approved") return "Only approved records can be completed.";
  if (!canComplete(me)) return "Only the data custodian files the physical copy and completes the record.";
  return "";
}
