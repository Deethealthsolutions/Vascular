"use client";

// Storage for the research documents register.
//   Supabase mode   when NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set:
//                   tables + private storage bucket from supabase/migrations/*_research_documents.sql
//   Local mode      otherwise: records in localStorage, files in IndexedDB (this browser only),
//                   with the same register-number format and workflow rules.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Actor, NewResearch, ResearchDoc, ResearchEvent, ResearchFile, ResearchStatus, ResearchVersion } from "./types";
import type { Extraction } from "./extract";

export type Detail = { doc: ResearchDoc; files: ResearchFile[]; versions: ResearchVersion[]; events: ResearchEvent[] };
export type Reviewer = { name: string; role: string };
export type Transition = { to: ResearchStatus; comment?: string; archiveLocation?: string; reviewer?: Reviewer };

export interface ResearchRepo {
  mode: "supabase" | "local";
  list(): Promise<ResearchDoc[]>;
  get(id: string): Promise<Detail>;
  create(input: NewResearch, by: Actor): Promise<ResearchDoc>;
  updateMeta(id: string, patch: Partial<NewResearch>, by: Actor): Promise<void>;
  addFile(docId: string, file: File, sha256: string, ex: Extraction, by: Actor): Promise<ResearchFile>;
  removeFile(f: ResearchFile, by: Actor): Promise<void>;
  fileBlob(f: ResearchFile): Promise<Blob>;
  saveText(docId: string, body: string, source: ResearchVersion["source"], note: string, by: Actor): Promise<ResearchVersion>;
  transition(docId: string, t: Transition, by: Actor): Promise<void>;
  reassign(docId: string, reviewer: Reviewer, by: Actor, reason: string): Promise<void>;
}

const now = () => new Date().toISOString();
const safe = (n: string) => n.replace(/[^\w.\-]+/g, "_").slice(-120);
const rid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`);

function stamps(doc: ResearchDoc, t: Transition, by: Actor): Partial<ResearchDoc> {
  const at = now();
  if (t.to === "in_review") return { status: t.to, submitted_by: by.name, submitted_at: at, approved_by: null, approved_at: null,
    assigned_reviewer: t.reviewer?.name ?? null, assigned_reviewer_role: t.reviewer?.role ?? null, assigned_at: at, assigned_by: by.name };
  if (t.to === "approved") return { status: t.to, approved_by: by.name, approved_at: at };
  if (t.to === "complete") return { status: t.to, completed_by: by.name, completed_at: at, archive_location: t.archiveLocation ?? doc.archive_location };
  return { status: t.to }; // returned to draft
}
const ACTION: Record<ResearchStatus, string> = { draft: "Returned to draft", in_review: "Submitted for review", approved: "Approved", complete: "Completed — physical copy filed" };
const actionText = (t: Transition) => (t.to === "in_review" && t.reviewer ? `Submitted for review · assigned to ${t.reviewer.name}` : ACTION[t.to]);

// ------------------------------------------------------------------ Supabase

class SupabaseRepo implements ResearchRepo {
  mode = "supabase" as const;
  constructor(private db: SupabaseClient) {}
  private async ok<T>(p: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<T> {
    const { data, error } = await p;
    if (error) throw new Error(error.message);
    return data;
  }
  private event(document_id: string, by: Actor, action: string, extra: Partial<ResearchEvent> = {}) {
    return this.ok(this.db.from("research_document_events").insert({ document_id, actor: by.name, actor_role: by.role, action, ...extra }));
  }
  async list() {
    return this.ok(this.db.from("research_documents").select("*").order("updated_at", { ascending: false })) as Promise<ResearchDoc[]>;
  }
  async get(id: string): Promise<Detail> {
    const [doc, files, versions, events] = await Promise.all([
      this.ok(this.db.from("research_documents").select("*").eq("id", id).single()),
      this.ok(this.db.from("research_document_files").select("*").eq("document_id", id).order("uploaded_at")),
      this.ok(this.db.from("research_document_versions").select("*").eq("document_id", id).order("version", { ascending: false })),
      this.ok(this.db.from("research_document_events").select("*").eq("document_id", id).order("at", { ascending: false })),
    ]);
    return { doc: doc as ResearchDoc, files: files as ResearchFile[], versions: versions as ResearchVersion[], events: events as ResearchEvent[] };
  }
  async create(input: NewResearch, by: Actor) {
    const doc = (await this.ok(this.db.from("research_documents").insert({ ...input, created_by: by.name, updated_by: by.name }).select("*").single())) as ResearchDoc;
    await this.event(doc.id, by, `Record created · register number ${doc.register_no}`, { to_status: "draft" });
    return doc;
  }
  async updateMeta(id: string, patch: Partial<NewResearch>, by: Actor) {
    await this.ok(this.db.from("research_documents").update({ ...patch, updated_by: by.name }).eq("id", id));
    await this.event(id, by, "Details updated");
  }
  async addFile(docId: string, file: File, sha: string, ex: Extraction, by: Actor) {
    const path = `${docId}/${rid()}-${safe(file.name)}`;
    await this.ok(this.db.storage.from("research-files").upload(path, file, { contentType: file.type || undefined, upsert: false }));
    const row = (await this.ok(this.db.from("research_document_files").insert({
      document_id: docId, file_name: file.name, mime_type: file.type || null, size_bytes: file.size, storage_path: path, sha256: sha,
      extracted_text: ex.text, extraction_method: ex.method, pages: ex.pages, ocr_confidence: ex.confidence, warnings: ex.warnings, uploaded_by: by.name,
    }).select("*").single())) as ResearchFile;
    await this.event(docId, by, `File uploaded: ${file.name} (${ex.method}, SHA-256 ${sha.slice(0, 12)}…)`);
    return row;
  }
  async removeFile(f: ResearchFile, by: Actor) {
    // The original stays in storage for the audit trail; the row is marked removed.
    await this.ok(this.db.from("research_document_files").update({ removed: true, removed_by: by.name, removed_at: now() }).eq("id", f.id));
    await this.event(f.document_id, by, `File removed from the record: ${f.file_name}`);
  }
  async fileBlob(f: ResearchFile) {
    return this.ok(this.db.storage.from("research-files").download(f.storage_path)) as Promise<Blob>;
  }
  async saveText(docId: string, body: string, source: ResearchVersion["source"], note: string, by: Actor) {
    const cur = (await this.ok(this.db.from("research_documents").select("text_version").eq("id", docId).single())) as { text_version: number };
    const version = cur.text_version + 1;
    const v = (await this.ok(this.db.from("research_document_versions").insert({ document_id: docId, version, body, source, note: note || null, created_by: by.name }).select("*").single())) as ResearchVersion;
    await this.ok(this.db.from("research_documents").update({ current_text: body, text_version: version, updated_by: by.name }).eq("id", docId));
    await this.event(docId, by, `Text ${source === "extracted" ? "added from a scanned file" : source === "restored" ? "restored from an earlier version" : "edited"} · version ${version}${note ? ` — ${note}` : ""}`);
    return v;
  }
  async transition(docId: string, t: Transition, by: Actor) {
    const doc = (await this.ok(this.db.from("research_documents").select("*").eq("id", docId).single())) as ResearchDoc;
    await this.ok(this.db.from("research_documents").update({ ...stamps(doc, t, by), updated_by: by.name }).eq("id", docId));
    await this.event(docId, by, actionText(t), { from_status: doc.status, to_status: t.to, comment: t.comment || null });
  }
  async reassign(docId: string, reviewer: Reviewer, by: Actor, reason: string) {
    const doc = (await this.ok(this.db.from("research_documents").select("assigned_reviewer").eq("id", docId).single())) as { assigned_reviewer: string | null };
    await this.ok(this.db.from("research_documents").update({ assigned_reviewer: reviewer.name, assigned_reviewer_role: reviewer.role, assigned_at: now(), assigned_by: by.name, updated_by: by.name }).eq("id", docId));
    await this.event(docId, by, `Review reassigned from ${doc.assigned_reviewer ?? "nobody"} to ${reviewer.name}`, { comment: reason || null });
  }
}

// ------------------------------------------------------------------ local demo

type LocalDB = { seq: number; docs: ResearchDoc[]; files: ResearchFile[]; versions: ResearchVersion[]; events: ResearchEvent[] };
const KEY = "prototype.research.v1";
const IDB = "prototype-research-files";

function idb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(IDB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore("files");
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function idbPut(key: string, blob: Blob) {
  const db = await idb();
  await new Promise<void>((res, rej) => { const tx = db.transaction("files", "readwrite"); tx.objectStore("files").put(blob, key); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
}
async function idbGet(key: string): Promise<Blob> {
  const db = await idb();
  return new Promise((res, rej) => { const r = db.transaction("files").objectStore("files").get(key); r.onsuccess = () => (r.result ? res(r.result as Blob) : rej(new Error("The original file is not stored in this browser."))); r.onerror = () => rej(r.error); });
}

/** Same rules as the database trigger, for local mode. */
function guard(doc: ResearchDoc, next: Partial<ResearchDoc>) {
  if (doc.status === "complete") throw new Error(`Completed research records are read-only (${doc.register_no}).`);
  if (next.status && next.status !== doc.status) {
    const ok = (doc.status === "draft" && next.status === "in_review") || (doc.status === "in_review" && (next.status === "approved" || next.status === "draft")) || (doc.status === "approved" && next.status === "complete");
    if (!ok) throw new Error(`Invalid status change: ${doc.status} -> ${next.status}.`);
    if (next.status === "in_review" && !next.assigned_reviewer) throw new Error("Assign a reviewer before submitting for review.");
    if (next.status === "in_review" && next.assigned_reviewer === next.submitted_by) throw new Error("You cannot assign the review to yourself.");
    if (next.status === "approved" && next.approved_by === doc.submitted_by) throw new Error("The person who submitted the record cannot approve it.");
    if (next.status === "approved" && doc.assigned_reviewer && next.approved_by !== doc.assigned_reviewer) throw new Error(`Only the assigned reviewer (${doc.assigned_reviewer}) can approve this record.`);
    if (next.status === "complete" && !(next.archive_location ?? "").trim()) throw new Error("A physical archive location is required to complete the record.");
  } else if (doc.status !== "draft" && ("current_text" in next || "title" in next || "principal_investigator" in next)) {
    throw new Error(`Only draft records can be edited (record is ${doc.status}).`);
  }
  if ((!next.status || next.status === doc.status) && "assigned_reviewer" in next) {
    if (doc.status !== "in_review" && doc.status !== "draft") throw new Error("The reviewer can only be changed while the record is in review.");
    if (next.assigned_reviewer === doc.submitted_by) throw new Error("The review cannot be assigned to the person who submitted it.");
  }
}

class LocalRepo implements ResearchRepo {
  mode = "local" as const;
  private read(): LocalDB {
    try { const raw = localStorage.getItem(KEY); if (raw) return JSON.parse(raw) as LocalDB; } catch { /* fall through */ }
    const db = seedLocal();
    this.write(db);
    return db;
  }
  private write(db: LocalDB) {
    try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { throw new Error("Browser storage is full. Connect Supabase to store research files properly."); }
  }
  private ev(db: LocalDB, document_id: string, by: Actor, action: string, extra: Partial<ResearchEvent> = {}) {
    db.events.push({ id: rid(), document_id, at: now(), actor: by.name, actor_role: by.role, action, from_status: null, to_status: null, comment: null, ...extra });
  }
  private patch(db: LocalDB, id: string, p: Partial<ResearchDoc>, by: Actor) {
    const i = db.docs.findIndex((d) => d.id === id);
    if (i < 0) throw new Error("Record not found.");
    guard(db.docs[i], p);
    db.docs[i] = { ...db.docs[i], ...p, updated_by: by.name, updated_at: now() };
    return db.docs[i];
  }
  async list() { return [...this.read().docs].sort((a, b) => b.updated_at.localeCompare(a.updated_at)); }
  async get(id: string): Promise<Detail> {
    const db = this.read();
    const doc = db.docs.find((d) => d.id === id);
    if (!doc) throw new Error("Record not found.");
    return {
      doc, files: db.files.filter((f) => f.document_id === id),
      versions: db.versions.filter((v) => v.document_id === id).sort((a, b) => b.version - a.version),
      events: db.events.filter((e) => e.document_id === id).sort((a, b) => b.at.localeCompare(a.at)),
    };
  }
  async create(input: NewResearch, by: Actor) {
    const db = this.read();
    db.seq += 1;
    const at = now();
    const doc: ResearchDoc = {
      id: rid(), register_no: `RES-${new Date().getFullYear()}-${String(db.seq).padStart(5, "0")}`, ...input, status: "draft", current_text: "", text_version: 0, archive_location: null,
      created_by: by.name, created_at: at, updated_by: by.name, updated_at: at, submitted_by: null, submitted_at: null, approved_by: null, approved_at: null, completed_by: null, completed_at: null,
    };
    db.docs.push(doc);
    this.ev(db, doc.id, by, `Record created · register number ${doc.register_no}`, { to_status: "draft" });
    this.write(db);
    return doc;
  }
  async updateMeta(id: string, p: Partial<NewResearch>, by: Actor) {
    const db = this.read(); this.patch(db, id, p, by); this.ev(db, id, by, "Details updated"); this.write(db);
  }
  async addFile(docId: string, file: File, sha: string, ex: Extraction, by: Actor) {
    const db = this.read();
    const doc = db.docs.find((d) => d.id === docId)!;
    if (doc.status !== "draft") throw new Error("Files can only be added or removed while the record is a draft.");
    const path = `${docId}/${rid()}-${safe(file.name)}`;
    await idbPut(path, file);
    const row: ResearchFile = {
      id: rid(), document_id: docId, file_name: file.name, mime_type: file.type || null, size_bytes: file.size, storage_path: path, sha256: sha,
      extracted_text: ex.text, extraction_method: ex.method, pages: ex.pages, ocr_confidence: ex.confidence, warnings: ex.warnings,
      uploaded_by: by.name, uploaded_at: now(), removed: false, removed_by: null, removed_at: null,
    };
    db.files.push(row);
    this.ev(db, docId, by, `File uploaded: ${file.name} (${ex.method}, SHA-256 ${sha.slice(0, 12)}…)`);
    this.write(db);
    return row;
  }
  async removeFile(f: ResearchFile, by: Actor) {
    const db = this.read();
    const doc = db.docs.find((d) => d.id === f.document_id)!;
    if (doc.status !== "draft") throw new Error("Files can only be added or removed while the record is a draft.");
    db.files = db.files.map((x) => (x.id === f.id ? { ...x, removed: true, removed_by: by.name, removed_at: now() } : x));
    this.ev(db, f.document_id, by, `File removed from the record: ${f.file_name}`);
    this.write(db);
  }
  async fileBlob(f: ResearchFile) { return idbGet(f.storage_path); }
  async saveText(docId: string, body: string, source: ResearchVersion["source"], note: string, by: Actor) {
    const db = this.read();
    const doc = db.docs.find((d) => d.id === docId)!;
    const version = doc.text_version + 1;
    this.patch(db, docId, { current_text: body, text_version: version }, by);
    const v: ResearchVersion = { id: rid(), document_id: docId, version, body, source, note: note || null, created_by: by.name, created_at: now() };
    db.versions.push(v);
    this.ev(db, docId, by, `Text ${source === "extracted" ? "added from a scanned file" : source === "restored" ? "restored from an earlier version" : "edited"} · version ${version}${note ? ` — ${note}` : ""}`);
    this.write(db);
    return v;
  }
  async transition(docId: string, t: Transition, by: Actor) {
    const db = this.read();
    const doc = db.docs.find((d) => d.id === docId)!;
    const from = doc.status;
    this.patch(db, docId, stamps(doc, t, by), by);
    this.ev(db, docId, by, actionText(t), { from_status: from, to_status: t.to, comment: t.comment || null });
    this.write(db);
  }
  async reassign(docId: string, reviewer: Reviewer, by: Actor, reason: string) {
    const db = this.read();
    const prev = db.docs.find((d) => d.id === docId)?.assigned_reviewer ?? "nobody";
    this.patch(db, docId, { assigned_reviewer: reviewer.name, assigned_reviewer_role: reviewer.role, assigned_at: now(), assigned_by: by.name }, by);
    this.ev(db, docId, by, `Review reassigned from ${prev} to ${reviewer.name}`, { comment: reason || null });
    this.write(db);
  }
}

/** A few historical records so the register is not empty in local mode (text only, no originals). */
function seedLocal(): LocalDB {
  const y = new Date().getFullYear();
  const d = (n: number, days: number, o: Partial<ResearchDoc>): ResearchDoc => {
    const at = new Date(Date.now() - days * 864e5).toISOString();
    return {
      id: rid(), register_no: `RES-${y}-${String(n).padStart(5, "0")}`, title: "", principal_investigator: "", co_authors: null, department: null, study_type: null,
      study_year: y, ethics_ref: null, keywords: [], status: "draft", current_text: "", text_version: 1, archive_location: null,
      created_by: "Dr. Priya Menon", created_at: at, updated_by: "Dr. Priya Menon", updated_at: at, submitted_by: null, submitted_at: null,
      approved_by: null, approved_at: null, completed_by: null, completed_at: null, ...o,
    };
  };
  const docs = [
    d(1, 40, { title: "Hyperbaric oxygen in Wagner grade 3 diabetic foot ulcers — five-year retrospective audit", principal_investigator: "Dr. Meera Krishnan", co_authors: "Dr. Arun Nair, Sr. Anandhi K.", department: "Hyperbaric medicine", study_type: "Clinical audit / QI", ethics_ref: "IEC/2021/044", keywords: ["HBOT", "DFU", "Wagner 3"], status: "complete", archive_location: "Records room · Cabinet R2 · Box 14", assigned_reviewer: "Dr. Meera Krishnan", assigned_reviewer_role: "Consultant vascular surgeon · Head of service", current_text: "Background: Adjunctive HBOT for Wagner 3 DFU...\nMethods: 212 patients, 2019–2024...\nResults: Complete healing at 12 weeks in 61%...", submitted_by: "Dr. Priya Menon", approved_by: "Dr. Meera Krishnan", completed_by: "R. Subramanian" }),
    d(2, 12, { title: "Toe pressure versus ABI in predicting healing after minor amputation", principal_investigator: "Dr. Arun Nair", department: "Vascular surgery", study_type: "Observational cohort", ethics_ref: "IEC/2024/112", keywords: ["toe pressure", "ABI", "amputation"], status: "approved", assigned_reviewer: "Dr. Priya Menon", assigned_reviewer_role: "Clinical research monitor", current_text: "Prospective cohort of 96 minor amputations; toe pressure < 30 mmHg predicted non-healing (AUC 0.82)...", submitted_by: "S. Hariharan", approved_by: "Dr. Priya Menon" }),
    d(3, 3, { title: "Nurse-led offloading education and DFU recurrence — protocol", principal_investigator: "Sr. Anandhi K.", department: "Nursing", study_type: "Protocol", keywords: ["offloading", "recurrence", "education"], status: "in_review", assigned_reviewer: "Dr. Priya Menon", assigned_reviewer_role: "Clinical research monitor", assigned_by: "S. Hariharan", current_text: "Protocol v1.2 — cluster randomised design across three clinics...", submitted_by: "S. Hariharan" }),
  ];
  const events: ResearchEvent[] = docs.map((x) => ({ id: rid(), document_id: x.id, at: x.created_at, actor: x.created_by, actor_role: "Clinical research monitor", action: `Record created · register number ${x.register_no} (migrated from the paper register)`, from_status: null, to_status: x.status, comment: null }));
  const versions: ResearchVersion[] = docs.map((x) => ({ id: rid(), document_id: x.id, version: 1, body: x.current_text, source: "extracted", note: "Migrated summary", created_by: x.created_by, created_at: x.created_at }));
  return { seq: 3, docs, files: [], versions, events };
}

// ------------------------------------------------------------------ factory

let repo: ResearchRepo | null = null;
export function researchRepo(): ResearchRepo {
  if (repo) return repo;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // NEXT_PUBLIC_RESEARCH_STORAGE=local forces the browser-only demo even when keys are set (training, tests).
  const forceLocal = process.env.NEXT_PUBLIC_RESEARCH_STORAGE === "local";
  repo = url && key && !forceLocal ? new SupabaseRepo(createClient(url, key, { auth: { persistSession: false } })) : new LocalRepo();
  return repo;
}
