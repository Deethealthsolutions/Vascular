"use client";

// Research documents register. Every research record gets a database-issued running register
// number (for the physical file), its originals are uploaded (PDF, Word, Excel, images), scanned
// to text in the browser, the text can be corrected, and the record moves
// Draft → In review → Approved → Complete. Storage: lib/research/repo.ts (Supabase or local demo).

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Guard, Top, useMe } from "@/components/cx/Shell";
import { Modal, Pill, toast } from "@/components/cx/ui";
import { extractText, kindOf, sha256 } from "@/lib/research/extract";
import { researchRepo, type Detail, type Reviewer } from "@/lib/research/repo";
import {
  ACCEPT, DEPARTMENTS, STATUS, STEPS, STUDY_TYPES, blockReason, canAuthor, canReview, canComplete, reviewersFor,
  type Actor, type NewResearch, type ResearchDoc, type ResearchFile, type ResearchStatus, type ResearchVersion,
} from "@/lib/research/types";
import type { Staff } from "@/lib/cx/users";

const fmt = (s?: string | null) => (s ? new Date(s).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
const fmtDay = (s?: string | null) => (s ? new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");
const kb = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const words = (t: string) => (t.trim() ? t.trim().split(/\s+/).length : 0);
const actorOf = (me: Staff): Actor => ({ name: me.name, role: me.role });
const KIND_TONE: Record<string, string> = { PDF: "#c32b45", Word: "#0b6bcb", Excel: "#12874a", Image: "#6d28d9", Text: "#5a6674", Other: "#5a6674" };

function printDoc() {
  document.body.classList.add("print-doc");
  window.print();
  setTimeout(() => document.body.classList.remove("print-doc"), 500);
}

export function ResearchDocs() {
  return (
    <Guard screen="rdocs">
      <Top title="Research documents" sub="Register, upload and scan research papers · Draft → In review → Approved → Complete" />
      <div className="wrap"><Body /></div>
    </Guard>
  );
}

function Body() {
  const me = useMe();
  const repo = researchRepo();
  const [docs, setDocs] = useState<ResearchDoc[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const reload = useCallback(async () => {
    try { setDocs(await repo.list()); setErr(""); } catch (e) { setErr((e as Error).message); setDocs([]); }
  }, [repo]);
  useEffect(() => {
    let live = true;
    repo.list().then((x) => { if (live) { setDocs(x); setErr(""); } }, (e: Error) => { if (live) { setErr(e.message); setDocs([]); } });
    return () => { live = false; };
  }, [repo]);

  return (
    <>
      <div className={`rd-mode ${repo.mode}`}>
        {repo.mode === "supabase"
          ? <><b>Connected to Supabase.</b> Records, files and every change are stored in the hospital database.</>
          : <><b>Local demo mode.</b> Supabase keys are not set, so records and files stay in this browser only. Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to connect.</>}
      </div>
      {err && <div className="deny mb14"><b>Could not reach the database.</b> {err}</div>}
      {open ? <Record id={open} me={me} onBack={() => { setOpen(null); void reload(); }} />
        : <Register docs={docs} me={me} onOpen={setOpen} onCreated={(d) => { void reload(); setOpen(d.id); }} />}
    </>
  );
}

// ------------------------------------------------------------------ register (grid)

function Register({ docs, me, onOpen, onCreated }: { docs: ResearchDoc[] | null; me: Staff; onOpen: (id: string) => void; onCreated: (d: ResearchDoc) => void }) {
  const [q, setQ] = useState("");
  const [st, setSt] = useState<ResearchStatus | "all">("all");
  const [mine, setMine] = useState(false);
  const myQueue = (docs ?? []).filter((d) => d.status === "in_review" && d.assigned_reviewer === me.name).length;
  const [creating, setCreating] = useState(false);
  const [issued, setIssued] = useState<ResearchDoc | null>(null);
  const counts = useMemo(() => Object.fromEntries(STEPS.map((s) => [s, (docs ?? []).filter((d) => d.status === s).length])) as Record<ResearchStatus, number>, [docs]);
  const ql = q.trim().toLowerCase();
  const rows = (docs ?? []).filter((d) => (st === "all" || d.status === st) && (!mine || (d.status === "in_review" && d.assigned_reviewer === me.name)) && (!ql || [d.register_no, d.title, d.principal_investigator, d.assigned_reviewer ?? "", d.department ?? "", d.keywords.join(" ")].join(" ").toLowerCase().includes(ql)));

  return (
    <>
      <div className="rd-pipe mb14" role="tablist" aria-label="Filter by status">
        <button role="tab" aria-selected={st === "all"} className={st === "all" ? "on" : ""} onClick={() => setSt("all")}><span className="n">{docs?.length ?? "…"}</span><span className="l">All records</span></button>
        {STEPS.map((s, i) => (
          <button key={s} role="tab" aria-selected={st === s} className={`${st === s ? "on" : ""} s-${s}`} onClick={() => setSt(s)}>
            <span className="n">{counts[s]}</span><span className="l">{STATUS[s].label}</span>{i < STEPS.length - 1 && <span className="ar" aria-hidden>→</span>}
          </button>
        ))}
      </div>

      <section className="opanel">
        <div className="opanel-h"><span className="ic" aria-hidden>≡</span><span className="tt">Research register</span>
          {canAuthor(me) && <button className="btn sm p" onClick={() => setCreating(true)}>+ New research record</button>}</div>
        <div className="opanel-b">
          <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
            <input className="gsearch" style={{ flex: "1 1 320px", padding: "9px 12px" }} placeholder="Search register number, title, investigator, reviewer, department or keyword" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search research records" />
            {canReview(me) && (
              <button className={`rd-mine${mine ? " on" : ""}`} onClick={() => setMine((x) => !x)} aria-pressed={mine}>
                Waiting for my review <span className="ct">{myQueue}</span>
              </button>
            )}
          </div>
          {docs === null ? <div className="sm mut">Loading the register…</div> : rows.length === 0 ? (
            <div className="sm mut">{docs.length === 0 ? "No research records yet. Create the first one to issue register number 00001." : "No records match."}</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="t rd-grid">
                <thead><tr><th>Register no.</th><th>Title</th><th>Investigator</th><th>Department / type</th><th>Status</th><th>Reviewer</th><th>Updated</th><th /></tr></thead>
                <tbody>
                  {rows.map((d) => (
                    <tr key={d.id} className="clk" onClick={() => onOpen(d.id)}>
                      <td className="num" style={{ whiteSpace: "nowrap" }}><b>{d.register_no}</b></td>
                      <td className="sm" style={{ maxWidth: 380 }}><b>{d.title}</b>{d.keywords.length > 0 && <div className="xs mut">{d.keywords.join(" · ")}</div>}</td>
                      <td className="sm">{d.principal_investigator}</td>
                      <td className="xs">{d.department ?? "—"}<div className="mut">{d.study_type ?? ""}</div></td>
                      <td><Pill c={STATUS[d.status].tone}>{STATUS[d.status].label}</Pill></td>
                      <td className="xs">{d.assigned_reviewer ? (d.status === "in_review" && d.assigned_reviewer === me.name ? <b style={{ color: "var(--blue)" }}>You</b> : d.assigned_reviewer) : <span className="mut">—</span>}
                        {d.status === "in_review" && d.assigned_reviewer && <div className="mut">waiting since {fmtDay(d.assigned_at ?? d.submitted_at)}</div>}</td>
                      <td className="xs mut" style={{ whiteSpace: "nowrap" }}>{fmtDay(d.updated_at)}<div>{d.updated_by}</div></td>
                      <td style={{ textAlign: "right" }}><button className="btn sm" onClick={(e) => { e.stopPropagation(); onOpen(d.id); }}>{d.status === "draft" && canAuthor(me) ? "Edit" : "View"}</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {creating && <NewRecord me={me} onClose={() => setCreating(false)} onDone={(d) => { setCreating(false); setIssued(d); }} />}
      {issued && <Issued doc={issued} onClose={() => { const d = issued; setIssued(null); onCreated(d); }} />}
    </>
  );
}

function NewRecord({ me, onClose, onDone }: { me: Staff; onClose: () => void; onDone: (d: ResearchDoc) => void }) {
  const [f, setF] = useState({ title: "", pi: me.cls === "research" ? "" : me.name, co: "", dept: "", type: "", year: String(new Date().getFullYear()), ethics: "", kw: "" });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));
  const ok = f.title.trim().length > 2 && f.pi.trim().length > 1;
  async function create() {
    setBusy(true);
    try {
      const input: NewResearch = {
        title: f.title.trim(), principal_investigator: f.pi.trim(), co_authors: f.co.trim() || null, department: f.dept || null, study_type: f.type || null,
        study_year: Number(f.year) || null, ethics_ref: f.ethics.trim() || null, keywords: f.kw.split(",").map((x) => x.trim()).filter(Boolean),
      };
      onDone(await researchRepo().create(input, actorOf(me)));
    } catch (e) { toast(`Could not create the record: ${(e as Error).message}`); setBusy(false); }
  }
  return (
    <Modal title="New research record" onClose={onClose} width={640}>
      <div className="sm mut" style={{ marginBottom: 12 }}>The database issues the next register number when you create the record. Write it on the physical file.</div>
      <div className="ob xw"><label>Title<b className="rq"> *</b><span>as on the paper</span></label><input value={f.title} onChange={(e) => set("title", e.target.value)} aria-label="Title" autoFocus /></div>
      <div className="ob xw"><label>Principal investigator<b className="rq"> *</b></label><input value={f.pi} onChange={(e) => set("pi", e.target.value)} aria-label="Principal investigator" /></div>
      <div className="ob xw"><label>Co-authors<span>comma separated</span></label><input value={f.co} onChange={(e) => set("co", e.target.value)} aria-label="Co-authors" /></div>
      <div className="ob xw"><label>Department</label><select value={f.dept} onChange={(e) => set("dept", e.target.value)} aria-label="Department"><option value="">Select…</option>{DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}</select></div>
      <div className="ob xw"><label>Study type</label><select value={f.type} onChange={(e) => set("type", e.target.value)} aria-label="Study type"><option value="">Select…</option>{STUDY_TYPES.map((d) => <option key={d}>{d}</option>)}</select></div>
      <div className="ob wide"><label>Year</label><input inputMode="numeric" value={f.year} onChange={(e) => set("year", e.target.value.replace(/\D/g, "").slice(0, 4))} aria-label="Year" /></div>
      <div className="ob xw"><label>Ethics approval no.<span>IEC reference, if any</span></label><input value={f.ethics} onChange={(e) => set("ethics", e.target.value)} aria-label="Ethics reference" /></div>
      <div className="ob xw"><label>Keywords<span>comma separated</span></label><input value={f.kw} onChange={(e) => set("kw", e.target.value)} aria-label="Keywords" placeholder="e.g. HBOT, DFU" /></div>
      <button className="btn p" style={{ width: "100%", marginTop: 8, padding: 11 }} disabled={!ok || busy} onClick={create}>{busy ? "Issuing register number…" : "Create record & issue register number"}</button>
    </Modal>
  );
}

function Label({ doc }: { doc: ResearchDoc }) {
  return (
    <div className="print-area rd-label">
      <div className="k">Research register · physical file</div>
      <div className="no">{doc.register_no}</div>
      <div className="ti">{doc.title}</div>
      <div className="mt">{doc.principal_investigator}{doc.department ? ` · ${doc.department}` : ""}{doc.study_year ? ` · ${doc.study_year}` : ""}</div>
      <div className="ft">Registered {fmtDay(doc.created_at)} by {doc.created_by} · Demo Network — Vascular &amp; Diabetic Foot</div>
    </div>
  );
}

function Issued({ doc, onClose }: { doc: ResearchDoc; onClose: () => void }) {
  return (
    <Modal title="Register number issued" onClose={onClose} width={560}>
      <div className="sm" style={{ marginBottom: 10 }}>Write this number on the physical file, or print the label and stick it on the folder.</div>
      <Label doc={doc} />
      <div className="noprint" style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button className="btn" onClick={printDoc}>Print file label</button>
        <button className="btn p" onClick={onClose}>Open the record & upload files</button>
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------------ one record

type Upload = { key: string; name: string; msg: string; pct: number; error?: string };

function Record({ id, me, onBack }: { id: string; me: Staff; onBack: () => void }) {
  const repo = researchRepo();
  const [d, setD] = useState<Detail | null>(null);
  const [text, setText] = useState("");
  const [note, setNote] = useState("");
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [viewFile, setViewFile] = useState<ResearchFile | null>(null);
  const [viewVer, setViewVer] = useState<ResearchVersion | null>(null);
  const [label, setLabel] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const actor = actorOf(me);

  const load = useCallback(async (keepText = false) => {
    const x = await repo.get(id);
    setD(x);
    if (!keepText) setText(x.doc.current_text);
    return x;
  }, [repo, id]);
  useEffect(() => { void load().catch((e) => toast((e as Error).message)); }, [load]);

  if (!d) return <div className="sm mut">Loading the record…</div>;
  const { doc, versions, events } = d;
  const files = d.files.filter((f) => !f.removed);
  const draft = doc.status === "draft";
  const editable = draft && canAuthor(me);
  const unsaved = text !== doc.current_text;

  async function run(what: string, fn: () => Promise<unknown>) {
    setBusy(true);
    try { await fn(); await load(); return true; } catch (e) { toast(`${what}: ${(e as Error).message}`); return false; } finally { setBusy(false); }
  }

  async function upload(list: FileList | null) {
    if (!list?.length) return;
    if (unsaved) { toast("Save or discard your text changes before uploading more files."); return; }
    let body = doc.current_text;
    for (const file of Array.from(list)) {
      const key = `${file.name}-${file.size}-${file.lastModified}`;
      const step = (msg: string, pct: number) => setUploads((u) => u.map((x) => (x.key === key ? { ...x, msg, pct } : x)));
      setUploads((u) => [...u.filter((x) => x.key !== key), { key, name: file.name, msg: "Fingerprinting…", pct: 0 }]);
      try {
        if (file.size > 50 * 1048576) throw new Error("File is larger than 50 MB.");
        const sha = await sha256(await file.arrayBuffer());
        if (files.some((f) => f.sha256 === sha)) throw new Error("This exact file is already on the record.");
        const ex = await extractText(file, step);
        step("Saving the original…", 100);
        await repo.addFile(doc.id, file, sha, ex, actor);
        body = `${body}${body.trim() ? "\n\n" : ""}=== ${file.name} ===\n${ex.text || "[No text found in this file]"}`;
        await repo.saveText(doc.id, body, "extracted", `Scanned ${file.name}`, actor);
        setUploads((u) => u.filter((x) => x.key !== key));
        toast(`${file.name}: ${ex.method}${ex.confidence != null ? `, ${ex.confidence}% confidence` : ""} — text added to the record.`);
      } catch (e) {
        setUploads((u) => u.map((x) => (x.key === key ? { ...x, error: (e as Error).message } : x)));
      }
    }
    const x = await load();
    setText(x.doc.current_text);
  }

  async function verify(f: ResearchFile) {
    try {
      const blob = await repo.fileBlob(f);
      const h = await sha256(await blob.arrayBuffer());
      toast(h === f.sha256 ? `✓ ${f.file_name}: the stored original matches its fingerprint (SHA-256 ${h.slice(0, 12)}…).` : `✗ ${f.file_name}: the stored file does NOT match its fingerprint. Report to the data custodian.`);
    } catch (e) { toast(`Could not verify ${f.file_name}: ${(e as Error).message}`); }
  }

  async function openOriginal(f: ResearchFile) {
    try { const url = URL.createObjectURL(await repo.fileBlob(f)); window.open(url, "_blank", "noopener"); setTimeout(() => URL.revokeObjectURL(url), 60000); }
    catch (e) { toast(`Could not open ${f.file_name}: ${(e as Error).message}`); }
  }

  const step = STATUS[doc.status].step;
  const stamp = [
    { s: "draft", who: doc.created_by, at: doc.created_at },
    { s: "in_review", who: doc.submitted_by ? `${doc.submitted_by}${doc.assigned_reviewer ? ` → ${doc.assigned_reviewer}` : ""}` : null, at: doc.submitted_at },
    { s: "approved", who: doc.approved_by, at: doc.approved_at },
    { s: "complete", who: doc.completed_by, at: doc.completed_at },
  ];

  return (
    <>
      <button className="btn sm mb14" onClick={() => { if (!unsaved || confirm("Discard unsaved text changes?")) onBack(); }}>← All research documents</button>

      <section className="opanel mb14">
        <div className="opanel-h"><span className="ic" aria-hidden>≡</span><span className="tt">Research record</span><Pill c={STATUS[doc.status].tone}>{STATUS[doc.status].label}</Pill></div>
        <div className="opanel-b rd-head">
          <div>
            <div className="rd-no">{doc.register_no}</div>
            <div className="rd-title">{doc.title}</div>
            <div className="xs mut">{doc.principal_investigator}{doc.co_authors ? ` · with ${doc.co_authors}` : ""}{doc.department ? ` · ${doc.department}` : ""}{doc.study_type ? ` · ${doc.study_type}` : ""}{doc.ethics_ref ? ` · ${doc.ethics_ref}` : ""}</div>
            <button className="btn sm" style={{ marginTop: 8 }} onClick={() => setLabel(true)}>Print file label</button>
          </div>
          <ol className="rd-steps" aria-label="Workflow">
            {STEPS.map((s, i) => {
              const st = stamp[i];
              const state = i < step || doc.status === "complete" ? "done" : i === step ? "now" : "todo";
              return (
                <li key={s} className={state}>
                  <span className="dot" aria-hidden>{state === "done" ? "✓" : i + 1}</span>
                  <span className="lb">{STATUS[s].label}</span>
                  <span className="who">{state !== "todo" && st.who ? `${st.who} · ${fmtDay(st.at)}` : state === "now" ? "current" : ""}</span>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      <div className="rd-cols">
        <div>
          <Panel title="Original files" status={`${files.length} file${files.length === 1 ? "" : "s"}`}>
            {editable ? (
              <div className={`rd-drop${busy ? " dis" : ""}`} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); void upload(e.dataTransfer.files); }}>
                <div><b>Drop research files here</b> or <button className="btn sm p" onClick={() => fileInput.current?.click()}>Choose files</button></div>
                <div className="xs mut">PDF · Word (.doc, .docx) · Excel (.xls, .xlsx) · PNG · JPG · BMP — up to 50 MB each. Scanned pages are read by OCR.</div>
                <input ref={fileInput} type="file" multiple accept={ACCEPT} className="sr-only" aria-label="Upload research files" onChange={(e) => { void upload(e.target.files); e.target.value = ""; }} />
              </div>
            ) : <div className="xs mut" style={{ marginBottom: 8 }}>{draft ? "Only authors can upload files." : "Files are locked once a record leaves Draft."}</div>}
            {uploads.map((u) => (
              <div key={u.key} className={`rd-up${u.error ? " err" : ""}`}>
                <div className="sm"><b>{u.name}</b> <span className="xs mut">{u.error ? "" : u.msg}</span></div>
                {u.error ? <div className="xs" style={{ color: "var(--red)" }}>{u.error} <button className="btn sm" onClick={() => setUploads((x) => x.filter((y) => y.key !== u.key))}>Dismiss</button></div>
                  : <div className="reg-prog"><i style={{ width: `${u.pct}%` }} /></div>}
              </div>
            ))}
            {files.length === 0 && uploads.length === 0 && <div className="sm mut">No files yet.</div>}
            {files.map((f) => {
              const k = kindOf(f.file_name);
              return (
                <div key={f.id} className="rd-file">
                  <span className="rd-kind" style={{ background: KIND_TONE[k] }}>{f.file_name.split(".").pop()?.toUpperCase()}</span>
                  <div className="meta">
                    <b className="sm">{f.file_name}</b>
                    <div className="xs mut">{kb(f.size_bytes)} · {f.extraction_method ?? "not scanned"}{f.pages ? ` · ${f.pages} page${f.pages > 1 ? "s" : ""}` : ""}{f.ocr_confidence != null ? ` · OCR ${f.ocr_confidence}%` : ""} · {f.uploaded_by}, {fmtDay(f.uploaded_at)}</div>
                    <div className="xs mut num" title={f.sha256}>SHA-256 {f.sha256.slice(0, 16)}…</div>
                    {f.warnings.map((w) => <div key={w} className="xs" style={{ color: "var(--amber)" }}>⚠ {w}</div>)}
                  </div>
                  <div className="acts">
                    <button className="btn sm" onClick={() => setViewFile(f)}>Text</button>
                    <button className="btn sm" onClick={() => openOriginal(f)}>Original</button>
                    <button className="btn sm" onClick={() => verify(f)}>Verify</button>
                    {editable && <button className="btn sm" onClick={() => confirm(`Remove ${f.file_name} from the record? The original stays in storage for audit.`) && void run("Remove file", () => repo.removeFile(f, actor))}>Remove</button>}
                  </div>
                </div>
              );
            })}
          </Panel>

          <Details doc={doc} editable={editable} onSave={(p) => run("Save details", () => repo.updateMeta(doc.id, p, actor))} />
        </div>

        <div>
          <Panel title="Record text" status={editable ? (unsaved ? "unsaved changes" : `version ${doc.text_version}`) : `locked · version ${doc.text_version}`} warn={unsaved}>
            {!editable && <div className="rd-lock">{draft ? "Only authors can edit the text." : `Locked while ${STATUS[doc.status].label.toLowerCase()}.${doc.status === "in_review" ? " A reviewer can return it to Draft for corrections." : ""}`}</div>}
            <textarea className="rd-text" value={text} readOnly={!editable} onChange={(e) => setText(e.target.value)} aria-label="Record text"
              placeholder={editable ? "Upload files to scan their text here, or type the summary of the research." : ""} />
            <div className="rd-tbar">
              <span className="xs mut">{words(text).toLocaleString("en-IN")} words · {text.length.toLocaleString("en-IN")} characters</span>
              {editable && (
                <>
                  <input className="cmp" style={{ maxWidth: 240 }} placeholder="What did you correct? (optional)" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Change note" />
                  <button className="btn sm" disabled={!unsaved || busy} onClick={() => setText(doc.current_text)}>Discard</button>
                  <button className="btn sm p" disabled={!unsaved || busy} onClick={async () => { if (await run("Save text", () => repo.saveText(doc.id, text, "edited", note.trim(), actor))) { setNote(""); toast(`Saved as version ${doc.text_version + 1}.`); } }}>Save changes</button>
                </>
              )}
            </div>
          </Panel>

          <Panel title="Text versions" status={`${versions.length}`}>
            {versions.length === 0 ? <div className="sm mut">No saved text yet.</div> : (
              <table className="t cmp-t"><tbody>
                {versions.map((v) => (
                  <tr key={v.id}>
                    <td className="num sm" style={{ width: 42 }}><b>v{v.version}</b></td>
                    <td className="xs"><Pill c={v.source === "edited" ? "b" : v.source === "restored" ? "a" : "n"}>{v.source}</Pill> {v.note}<div className="mut">{v.created_by} · {fmt(v.created_at)}</div></td>
                    <td className="xs mut" style={{ whiteSpace: "nowrap" }}>{words(v.body).toLocaleString("en-IN")} words</td>
                    <td style={{ textAlign: "right" }}><button className="btn sm" onClick={() => setViewVer(v)}>View</button></td>
                  </tr>
                ))}
              </tbody></table>
            )}
          </Panel>
        </div>
      </div>

      <div className="rd-cols">
        <Workflow doc={doc} me={me} files={files.length} unsaved={unsaved} busy={busy}
          onMove={(to, extra) => run(to === "draft" ? "Return" : "Workflow", () => repo.transition(doc.id, { to, ...extra }, actor)).then((ok) => { if (ok) toast(`${doc.register_no}: ${STATUS[to].label}${to === "in_review" && extra?.reviewer ? ` — assigned to ${extra.reviewer.name}` : ""}.`); })}
          onReassign={(rv, reason) => run("Reassign", () => repo.reassign(doc.id, rv, actor, reason)).then((ok) => { if (ok) toast(`${doc.register_no}: review reassigned to ${rv.name}.`); })} />
        <Panel title="History" status={`${events.length} events`}>
          <ol className="rd-hist">
            {events.map((e) => (
              <li key={String(e.id)}>
                <span className="at">{fmt(e.at)}</span>
                <span className="tx"><b>{e.action}</b>{e.comment && <> — “{e.comment}”</>}<span className="by">{e.actor}{e.actor_role ? `, ${e.actor_role}` : ""}</span></span>
              </li>
            ))}
          </ol>
        </Panel>
      </div>

      {viewFile && (
        <Modal title={`Scanned text · ${viewFile.file_name}`} onClose={() => setViewFile(null)} width={820}>
          <div className="xs mut" style={{ marginBottom: 8 }}>{viewFile.extraction_method}{viewFile.ocr_confidence != null ? ` · OCR confidence ${viewFile.ocr_confidence}%` : ""} · exactly as read from the file (corrections go in the record text).</div>
          <pre className="rd-pre">{viewFile.extracted_text || "[No text found]"}</pre>
        </Modal>
      )}
      {viewVer && (
        <Modal title={`${doc.register_no} · text version ${viewVer.version}`} onClose={() => setViewVer(null)} width={820}>
          <div className="xs mut" style={{ marginBottom: 8 }}>{viewVer.source} by {viewVer.created_by} · {fmt(viewVer.created_at)}{viewVer.note ? ` · ${viewVer.note}` : ""}</div>
          <pre className="rd-pre">{viewVer.body}</pre>
          {editable && viewVer.version !== doc.text_version && (
            <button className="btn p" style={{ marginTop: 10 }} onClick={async () => { const v = viewVer; setViewVer(null); if (await run("Restore", () => repo.saveText(doc.id, v.body, "restored", `Restored version ${v.version}`, actor))) toast(`Version ${v.version} restored as a new version.`); }}>Restore this version</button>
          )}
        </Modal>
      )}
      {label && (
        <Modal title="Physical file label" onClose={() => setLabel(false)} width={560}>
          <Label doc={doc} />
          <button className="btn p noprint" style={{ marginTop: 12 }} onClick={printDoc}>Print</button>
        </Modal>
      )}
    </>
  );
}

function Panel({ title, status, warn, children }: { title: string; status?: string; warn?: boolean; children: ReactNode }) {
  return (
    <section className="opanel mb14" aria-label={title}>
      <div className="opanel-h"><span className="ic" aria-hidden>≡</span><span className="tt">{title}</span>{status && <span className={`st${warn ? "" : " ok"}`} style={warn ? { color: "#f3c06b" } : { color: "#9aa6b2" }}>{status}</span>}</div>
      <div className="opanel-b">{children}</div>
    </section>
  );
}

function Details({ doc, editable, onSave }: { doc: ResearchDoc; editable: boolean; onSave: (p: Partial<NewResearch>) => void }) {
  const [f, setF] = useState({ title: doc.title, pi: doc.principal_investigator, co: doc.co_authors ?? "", dept: doc.department ?? "", type: doc.study_type ?? "", year: String(doc.study_year ?? ""), ethics: doc.ethics_ref ?? "", kw: doc.keywords.join(", ") });
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));
  const patch: Partial<NewResearch> = {
    title: f.title.trim(), principal_investigator: f.pi.trim(), co_authors: f.co.trim() || null, department: f.dept || null, study_type: f.type || null,
    study_year: Number(f.year) || null, ethics_ref: f.ethics.trim() || null, keywords: f.kw.split(",").map((x) => x.trim()).filter(Boolean),
  };
  const changed = JSON.stringify(patch) !== JSON.stringify({ title: doc.title, principal_investigator: doc.principal_investigator, co_authors: doc.co_authors, department: doc.department, study_type: doc.study_type, study_year: doc.study_year, ethics_ref: doc.ethics_ref, keywords: doc.keywords });
  return (
    <Panel title="Details" status={editable ? undefined : "read-only"}>
      <fieldset disabled={!editable} style={{ border: 0, padding: 0, margin: 0 }}>
        <div className="ob xw"><label>Title</label><input value={f.title} onChange={(e) => set("title", e.target.value)} aria-label="Edit title" /></div>
        <div className="ob xw"><label>Principal investigator</label><input value={f.pi} onChange={(e) => set("pi", e.target.value)} aria-label="Edit investigator" /></div>
        <div className="ob xw"><label>Co-authors</label><input value={f.co} onChange={(e) => set("co", e.target.value)} aria-label="Edit co-authors" /></div>
        <div className="ob xw"><label>Department</label><select value={f.dept} onChange={(e) => set("dept", e.target.value)} aria-label="Edit department"><option value="">—</option>{DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}</select></div>
        <div className="ob xw"><label>Study type</label><select value={f.type} onChange={(e) => set("type", e.target.value)} aria-label="Edit study type"><option value="">—</option>{STUDY_TYPES.map((d) => <option key={d}>{d}</option>)}</select></div>
        <div className="ob wide"><label>Year</label><input value={f.year} onChange={(e) => set("year", e.target.value.replace(/\D/g, "").slice(0, 4))} aria-label="Edit year" /></div>
        <div className="ob xw"><label>Ethics approval no.</label><input value={f.ethics} onChange={(e) => set("ethics", e.target.value)} aria-label="Edit ethics reference" /></div>
        <div className="ob xw"><label>Keywords</label><input value={f.kw} onChange={(e) => set("kw", e.target.value)} aria-label="Edit keywords" /></div>
      </fieldset>
      {doc.archive_location && <div className="ob xw"><label>Physical archive</label><div className="sm"><b>{doc.archive_location}</b></div></div>}
      {editable && <button className="btn sm p" disabled={!changed || patch.title!.length < 3} onClick={() => onSave(patch)}>Save details</button>}
    </Panel>
  );
}

type Extra = { comment?: string; archiveLocation?: string; reviewer?: Reviewer };

function Workflow({ doc, me, files, unsaved, busy, onMove, onReassign }: { doc: ResearchDoc; me: Staff; files: number; unsaved: boolean; busy: boolean; onMove: (to: ResearchStatus, extra?: Extra) => void; onReassign: (rv: Reviewer, reason: string) => void }) {
  const [comment, setComment] = useState("");
  const pool = reviewersFor(doc.status === "draft" ? me.name : doc.submitted_by ?? me.name);
  const [rvName, setRvName] = useState(() => (doc.assigned_reviewer && pool.some((p) => p.name === doc.assigned_reviewer) ? doc.assigned_reviewer : ""));
  const rv = pool.find((p) => p.name === rvName);
  const reviewer: Reviewer | undefined = rv ? { name: rv.name, role: rv.role } : undefined;
  const [moveTo, setMoveTo] = useState("");
  const [reason, setReason] = useState("");
  const others = pool.filter((p) => p.name !== doc.assigned_reviewer);
  const canReassign = doc.status === "in_review" && (me.name === doc.submitted_by || me.name === doc.assigned_reviewer || !!me.head);
  const [checked, setChecked] = useState(false);
  const [archive, setArchive] = useState("");
  const ctx = { files, unsaved, reviewer: rvName };
  const why = (a: "submit" | "approve" | "return" | "complete") => blockReason(a, doc, me, ctx);
  const btn = (a: "submit" | "approve" | "return" | "complete", to: ResearchStatus, label: string, o: { p?: boolean; extra?: Extra; need?: string } = {}) => {
    const { p, extra, need } = o;
    const reason = why(a) || need || "";
    return (
      <div className="rd-act">
        <button className={`btn${p ? " p" : ""}`} disabled={!!reason || busy} onClick={() => { onMove(to, extra); setComment(""); setChecked(false); }}>{label}</button>
        {reason && <span className="xs mut">{reason}</span>}
      </div>
    );
  };
  return (
    <Panel title="Workflow" status={STATUS[doc.status].label}>
      {doc.status === "draft" && (
        <>
          <div className="sm" style={{ marginBottom: 8 }}>When the files are uploaded and the text is checked, assign a reviewer and send the record for review.</div>
          <div className="fld" style={{ marginBottom: 8 }}><label className="req-l">Assign to reviewer</label>
            <select value={rvName} onChange={(e) => setRvName(e.target.value)} aria-label="Assign reviewer">
              <option value="">Select a reviewer…</option>
              {pool.map((p) => <option key={p.id} value={p.name}>{p.name} — {p.role}</option>)}
            </select>
            <div className="hint">Consultants and the research monitor can review. You cannot review your own submission.</div></div>
          <div className="fld" style={{ marginBottom: 8 }}><label>Note for the reviewer (optional)</label><input value={comment} onChange={(e) => setComment(e.target.value)} aria-label="Reviewer note" /></div>
          {btn("submit", "in_review", rv ? `Submit for review to ${rv.name}` : "Submit for review", { p: true, extra: { comment, reviewer } })}
        </>
      )}
      {doc.status === "in_review" && (
        <>
          <div className="rd-assign">
            <span className="av" aria-hidden>{(doc.assigned_reviewer ?? "?").replace(/^(Dr|Sr)\.\s*/, "").split(" ").map((w) => w[0]).slice(0, 2).join("")}</span>
            <div><div className="sm">Assigned to <b>{doc.assigned_reviewer ?? "nobody"}</b>{doc.assigned_reviewer === me.name && <Pill c="b">you</Pill>}</div>
              <div className="xs mut">{doc.assigned_reviewer_role ?? ""}{doc.assigned_at ? ` · since ${fmt(doc.assigned_at)}` : ""}{doc.assigned_by ? ` · by ${doc.assigned_by}` : ""} · submitted by {doc.submitted_by}</div></div>
          </div>
          {doc.assigned_reviewer !== me.name && <div className="sm mut" style={{ marginBottom: 8 }}>Waiting for {doc.assigned_reviewer}&apos;s review. Only the assigned reviewer can approve or return it.</div>}
          {doc.assigned_reviewer === me.name && <>
            <div className="fld" style={{ marginBottom: 8 }}><label>Review comment {"(required to return)"}</label><textarea value={comment} onChange={(e) => setComment(e.target.value)} style={{ minHeight: 60 }} aria-label="Review comment" /></div>
            <label className="check" style={{ marginBottom: 8 }}><input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} /> I have checked the record text against the original files.</label>
          </>}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {btn("approve", "approved", "Approve", { p: true, extra: { comment }, need: !checked ? "Tick the check above to approve." : "" })}
            {btn("return", "draft", "Return to draft", { extra: { comment }, need: comment.trim().length < 5 ? "Write what needs correcting to return it." : "" })}
          </div>
          {canReassign && (
            <details className="rd-reassign">
              <summary>Reassign to another reviewer</summary>
              <div className="fld" style={{ margin: "8px 0" }}><label>New reviewer</label>
                <select value={moveTo} onChange={(e) => setMoveTo(e.target.value)} aria-label="New reviewer"><option value="">Select…</option>{others.map((p) => <option key={p.id} value={p.name}>{p.name} — {p.role}</option>)}</select></div>
              <div className="fld" style={{ marginBottom: 8 }}><label>Reason</label><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. on leave this week" aria-label="Reassign reason" /></div>
              <button className="btn sm" disabled={!moveTo || reason.trim().length < 3 || busy} onClick={() => { const p = others.find((x) => x.name === moveTo)!; onReassign({ name: p.name, role: p.role }, reason.trim()); setMoveTo(""); setReason(""); }}>Reassign</button>
            </details>
          )}
        </>
      )}
      {doc.status === "approved" && (
        <>
          <div className="sm" style={{ marginBottom: 8 }}>Approved by <b>{doc.approved_by}</b> on {fmtDay(doc.approved_at)}. {canComplete(me) ? "File the physical copy and record where it is kept." : "Waiting for the data custodian to file the physical copy."}</div>
          <div className="fld" style={{ marginBottom: 8 }}><label>Physical archive location</label><input value={archive} onChange={(e) => setArchive(e.target.value)} placeholder="e.g. Records room · Cabinet R2 · Box 15" aria-label="Archive location" /></div>
          <label className="check" style={{ marginBottom: 8 }}><input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} /> The physical copy is filed, labelled {doc.register_no}, and matches the digital record.</label>
          {btn("complete", "complete", "Mark complete", { p: true, extra: { comment, archiveLocation: archive.trim() }, need: archive.trim().length < 3 ? "Enter the archive location." : !checked ? "Confirm the physical copy is filed." : "" })}
        </>
      )}
      {doc.status === "complete" && (
        <div className="sm">Completed by <b>{doc.completed_by}</b> on {fmtDay(doc.completed_at)}. Physical copy: <b>{doc.archive_location}</b>. The record is read-only; files can still be opened and verified.</div>
      )}
    </Panel>
  );
}
