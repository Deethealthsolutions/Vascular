"use client";

import { useState } from "react";
import { Guard, Top, useMe } from "@/components/cx/Shell";
import { Card, Disc, Kpis, Modal, Pill, toast } from "@/components/cx/ui";
import { SIGN, SO_DOC, RES } from "@/lib/cx/data";
import { allLedger, audit, contentHash, nowIso, openPending, setState, uid, useStore, type LedgerEntry, type Pending, type State } from "@/lib/cx/store";
import { CAN_SIGN, SECOND_PERSON, type Staff } from "@/lib/cx/users";

const DEMO_PIN = "1234";
const NEED_LABEL: Record<string, string> = {
  counter: "countersignature", custodian: "custodian approval", monitor: "monitor review", abstract2: "second independent abstraction",
  discharge: "release authorisation", "author-ms": "co-author sign-off", author: "author attestation", merge: "merge adjudication",
};
const ATTEST: Record<string, string> = {
  ...(SIGN.attest as Record<string, string>),
  merge: "I have compared both records and confirm they describe the same person. I accept responsibility for combining them; the merge can be reversed.",
};

/** Why the signed-in user may not sign this item, or null if they may. */
export function signBlock(me: Staff, p: Pending): string | null {
  const allowed = CAN_SIGN[p.need] ?? [];
  if (!allowed.includes(me.cls)) return `A ${me.cls} cannot give ${NEED_LABEL[p.need] ?? p.need}.`;
  if (SECOND_PERSON.has(p.need) && p.entered === me.name) return "Separation of duties: you entered this record, so someone else must sign it.";
  if (p.need === "author" && p.entered !== me.name) return "Author attestation can only be given by the author.";
  if (p.aiDraft && p.need === "author" && p.entered !== me.name) return "Voice-derived drafts are signed by the invoking clinician.";
  return null;
}

export function Signoff() {
  return (
    <Guard screen="signoff">
      <Top title="Review & sign-off" sub="Draft → review → countersign · append-only attestation ledger" />
      <div className="wrap"><Body /></div>
    </Guard>
  );
}

function Body() {
  const st = useStore();
  const me = useMe();
  const [signing, setSigning] = useState<Pending | null>(null);
  const [returning, setReturning] = useState<Pending | null>(null);
  const [amending, setAmending] = useState<LedgerEntry | null>(null);
  const [mineOnly, setMineOnly] = useState(false);
  const pending = openPending(st);
  const ledger = allLedger(st);
  const mine = pending.filter((p) => !signBlock(me, p));
  const T = SIGN.totals;

  return (
    <>
      <Disc><b>A save is not a sign-off.</b> Saving is a convenience. Signing is a named person asserting the content is correct and accepting responsibility for it. Signing re-authenticates (demo PIN <b>{DEMO_PIN}</b>), binds to a content hash, and appends to a ledger that is never edited.</Disc>

      <Kpis cols={5} items={[
        { k: "Awaiting sign-off", v: pending.length, d: `${pending.filter((p) => p.priority === "high").length} high priority`, tone: "bad" },
        { k: "You can sign", v: mine.length, d: `as ${me.name}`, tone: mine.length ? "warn" : "" },
        { k: "Signed", v: ledger.length, d: `${st.ledger.length} in this session`, tone: "" },
        { k: "Median wait", v: T.medLatency + "m", d: "entry to signature" },
        { k: "Amendments", v: SIGN.amendments.length + st.ledger.filter((l) => l.amended).length, d: "superseding a signed record", tone: "warn" },
      ]} />

      <div className="filt">
        <div className="fg"><span className="fl">Show</span>
          <div className="seg"><button className={mineOnly ? "" : "on"} onClick={() => setMineOnly(false)}>Whole queue</button><button className={mineOnly ? "on" : ""} onClick={() => setMineOnly(true)}>Only items I can sign</button></div>
        </div>
      </div>

      {(["clinical", "research"] as const).map((kind) => {
        const rows = pending.filter((p) => p.kind === kind && (!mineOnly || !signBlock(me, p)));
        const K = SIGN.byKind[kind];
        return (
          <Card key={kind} title={kind === "clinical" ? "Clinical sign-off queue" : "Research sign-off queue"} className="mb14" bodyClass={null}
            hint={kind === "clinical" ? "countersignature of supervised entries and release of documents" : "protocol-bound review under the study's own governance"}
            right={<><Pill>{K.signed} signed · median {K.medLatency}m</Pill><Pill c={rows.length ? "a" : "g"}>{rows.length} waiting</Pill></>}>
            {rows.length === 0 && <div className="card-b sm mut">Nothing waiting{mineOnly ? " that you can sign" : ""}.</div>}
            {rows.map((p) => <Item key={p.id} p={p} me={me} onSign={() => setSigning(p)} onReturn={() => setReturning(p)} />)}
          </Card>
        );
      })}

      <Card title="Amendments to signed records" hint="the original is never edited and never deleted" right={<Pill c="a">{SIGN.amendments.length + st.ledger.filter((l) => l.amended).length}</Pill>} className="mb14">
        {st.ledger.filter((l) => l.amended).map((l) => (
          <div key={l.id} style={{ padding: "11px 0", borderBottom: "1px solid var(--line)" }}>
            <div style={{ display: "flex", gap: 9, alignItems: "baseline", flexWrap: "wrap" }}><span className="num sm"><b>{l.id}</b></span><span className="sm">{l.doc}</span><Pill c="a">v{l.version}</Pill>
              <span className="xs mut" style={{ marginLeft: "auto" }}>{l.at.replace("T", " ")} · {l.signer}</span></div>
            <div className="xs mut" style={{ marginTop: 6 }}>signed in this session · earlier versions remain readable in the ledger</div>
          </div>
        ))}
        {SIGN.amendments.map((a) => (
          <div key={a.id} style={{ padding: "11px 0", borderBottom: "1px solid var(--line)" }}>
            <div style={{ display: "flex", gap: 9, alignItems: "baseline", flexWrap: "wrap" }}><span className="num sm"><b>{a.id}</b></span><span className="sm">{a.doc}</span>
              <span className="xs mut" style={{ marginLeft: "auto" }}>{a.at.replace("T", " ")} · {a.by}</span></div>
            <div className="sm" style={{ marginTop: 6, color: "var(--ink2)" }}>{a.reason}</div>
            <div style={{ marginTop: 7, display: "flex", gap: 9, alignItems: "center", flexWrap: "wrap" }}>
              <span className="num xs mut">{a.field}</span><span className="pill r" style={{ textDecoration: "line-through" }}>{a.was}</span><span className="mut">→</span><Pill c="g">{a.now}</Pill>
            </div>
            <div className="xs mut" style={{ marginTop: 6 }}>supersedes {a.orig}, signed {a.origSigned.replace("T", " ")} by {a.origBy} — that version remains readable</div>
          </div>
        ))}
      </Card>

      <div className="grid2 mb14">
        <Card title="What each signature means" hint="shown on the form at the point of signing">
          <table className="t"><thead><tr><th>Action</th><th>Count</th><th>Median wait</th><th>Attestation</th></tr></thead><tbody>
            {SIGN.byAction.map((a) => (
              <tr key={a.action}><td className="num sm"><b>{a.action}</b></td><td className="num sm">{a.n}</td><td className="num sm">{a.medLatency}m</td><td className="sm mut" style={{ fontStyle: "italic" }}>{a.attest}</td></tr>
            ))}
            <tr><td className="num sm"><b>merge</b></td><td className="num sm">{st.ledger.filter((l) => l.action === "merge").length}</td><td className="num sm">—</td><td className="sm mut" style={{ fontStyle: "italic" }}>{ATTEST.merge}</td></tr>
          </tbody></table>
        </Card>
        <Card title="Sign-off ledger" hint="append-only · hashed · most recent first" bodyClass="card-b" className="">
          <div style={{ maxHeight: 560, overflow: "auto" }}>
            <table className="t"><thead><tr><th>When</th><th>Record</th><th>Signer</th><th>Action</th><th>v</th><th>Hash</th><th /></tr></thead><tbody>
              {ledger.slice(0, 40).map((r) => {
                const superseded = ledger.some((x) => x.supersedes === r.id);
                return (
                  <tr key={r.id} style={superseded ? { opacity: 0.55 } : undefined}>
                    <td className="num xs mut">{r.at.replace("T", " ")}</td>
                    <td className="sm">{r.doc}<div className="xs mut">entered by {r.entered} · {r.centre}{superseded && " · superseded"}</div></td>
                    <td className="sm">{r.signer}<div className="xs mut">{r.method}</div></td>
                    <td><Pill c={r.kind === "research" ? "v" : "b"}>{r.action}</Pill></td>
                    <td className="num sm">{r.version > 1 ? <Pill c="a">v{r.version}</Pill> : "1"}</td>
                    <td className="num xs mut">{r.hash}</td>
                    <td>{r.kind === "clinical" && !superseded && <button className="btn sm" onClick={() => setAmending(r)}>Amend</button>}</td>
                  </tr>
                );
              })}
            </tbody></table>
          </div>
        </Card>
      </div>

      <Card title="Rules the ledger enforces">
        <table className="t"><tbody>
          {[["Append-only", "No row is ever updated or deleted. A correction appends a new version and marks the old one superseded."],
            ["Re-authentication", "Signing re-authenticates. A signature must mean the named person was present, not that a session was still open."],
            ["Explicit meaning", "Every signature carries the attestation wording shown at the time. Changing the wording creates a new attestation type."],
            ["Version binding", "A signature binds to a SHA-256 content hash. If the content changes, the signature no longer verifies."],
            ["Separation of duties", "The entering user cannot countersign, release, adjudicate a merge or give custodian approval for their own entry."],
            ["No AI signer", "Voice and model output lands as a draft attributed to the model and the invoking clinician. There is no staff row for a model."],
            ["No silent release", "Discharge summaries, extracts and manuscripts stay unreleased until signed."]].map((r) => (
            <tr key={r[0]}><td className="sm mut" style={{ width: "19%", verticalAlign: "top" }}><b>{r[0]}</b></td><td className="sm">{r[1]}</td></tr>
          ))}
        </tbody></table>
      </Card>

      {signing && <SignModal p={signing} me={me} onClose={() => setSigning(null)} />}
      {returning && <ReturnModal p={returning} me={me} onClose={() => setReturning(null)} />}
      {amending && <AmendModal l={amending} me={me} onClose={() => setAmending(null)} />}
    </>
  );
}

function Item({ p, me, onSign, onReturn }: { p: Pending; me: Staff; onSign: () => void; onReturn: () => void }) {
  const ageMin = Math.max(1, Math.round((Date.parse("2026-09-20T06:00") - Date.parse(p.at)) / 60000));
  const age = p.at > "2026-09-20T06:00" ? "new" : ageMin < 60 ? ageMin + "m" : ageMin < 2880 ? Math.floor(ageMin / 60) + "h" : Math.floor(ageMin / 1440) + "d";
  const dt = SO_DOC[p.docType] ?? ["n", p.docType];
  const block = signBlock(me, p);
  return (
    <div className="so">
      <div className={`bdg ${p.priority === "high" ? "hi" : p.priority === "medium" ? "md" : "lo"}`}><b>{age}</b>waiting</div>
      <div style={{ flex: 1 }}>
        <div className="t">{p.doc} <Pill c={dt[0]}>{dt[1]}</Pill>{p.version && p.version > 1 && <> <Pill c="a">v{p.version} amendment</Pill></>}{p.aiDraft && <> <Pill c="v">AI draft</Pill></>}</div>
        <div className="d">{p.why}</div>
        {p.aiDraft && <div className="xs" style={{ color: "var(--violet)", marginTop: 4 }}>{p.aiDraft}</div>}
        <div className="chain" style={{ marginTop: 9 }}>
          <div className="ev done"><b>Entered</b> by {p.entered} · {p.enteredRole} · {p.at.replace("T", " ")}</div>
          <div className="ev now"><b>Awaiting {NEED_LABEL[p.need] ?? p.need}</b> from {p.needFrom}</div>
          <div className="ev tbd">Locked on signature; any later change becomes an amendment</div>
        </div>
        <div className="attest">{ATTEST[p.need]}</div>
        <div className="sig">
          <button className="btn v" onClick={onSign} disabled={!!block}>Sign</button>
          <button className="btn" onClick={onReturn} disabled={p.entered === me.name}>Return with a query</button>
          <span className="xs mut">{block ?? "re-authentication required · SSO + PIN"}</span>
        </div>
      </div>
    </div>
  );
}

/** Applies the downstream effect of a signature (visit note becomes current, merge applies, extract materialises…). */
function applyEffects(s: State, p: Pending, signer: string): Partial<State> {
  const out: Partial<State> = {};
  if (p.subject?.type === "visit") {
    const note = s.notes.find((n) => n.id === p.subject!.ref);
    out.notes = s.notes.map((n) => n.id === p.subject!.ref ? { ...n, status: "signed" }
      : note && n.pid === note.pid && n.status === "signed" ? { ...n, status: "superseded" } : n);
  }
  if (p.subject?.type === "merge") {
    out.merges = s.merges.map((m) => (m.id === p.subject!.ref ? { ...m, signed: true } : m));
  }
  if (p.subject?.type === "extract") {
    const ids = p.subject.ref;
    const req = s.extracts.find((e) => e.id === ids);
    const parts = RES.participants.filter((x) => x.study === req?.study);
    const withheld = parts.filter((x) => x.consent !== "active").length;
    out.extracts = s.extracts.map((e) => (e.id === ids ? { ...e, status: "materialised", released: parts.length - withheld, withheld } : e));
  }
  if (p.subject?.type === "consult") {
    out.registrations = s.registrations.map((r) => (r.id === p.subject!.ref && r.consult
      ? { ...r, consult: { ...r.consult, countersign: signer }, history: [...(r.history ?? []), { at: new Date().toISOString(), by: signer, text: "Consultation countersigned" }] } : r));
  }
  return out;
}

function SignModal({ p, me, onClose }: { p: Pending; me: Staff; onClose: () => void }) {
  const [pin, setPin] = useState("");
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState("");
  async function sign() {
    if (pin !== DEMO_PIN) { setErr("PIN not recognised. Signature not recorded."); audit(me.name, "deny", p.doc, "Failed re-authentication at signing"); return; }
    const at = nowIso();
    const hash = await contentHash({ id: p.id, doc: p.doc, version: p.version ?? 1, content: p.content ?? p.doc, attest: ATTEST[p.need] });
    const entry: LedgerEntry = {
      id: uid("SO"), at, kind: p.kind, docType: p.docType, doc: p.doc, entered: p.entered, enteredRole: p.enteredRole,
      centre: "CHN", action: p.need, signer: me.name, attest: ATTEST[p.need], version: p.version ?? 1, amended: (p.version ?? 1) > 1,
      hash, method: "SSO + PIN", latencyMin: Math.max(0, Math.round((Date.now() - Date.parse(p.at)) / 60000)), supersedes: p.amendOf,
    };
    setState((s) => {
      const fx = applyEffects(s, p, me.name);
      return { ...fx, ledger: [entry, ...s.ledger], resolved: { ...s.resolved, [p.id]: { status: "signed", by: me.name, at } } };
    });
    audit(me.name, "sign", p.doc, `${p.need} · hash ${hash}`);
    toast(`Signed. Ledger entry ${entry.id} · hash ${hash}.`);
    onClose();
  }
  return (
    <Modal title={`Sign — ${p.doc}`} onClose={onClose}>
      {p.content && <div className="tx-box" style={{ maxHeight: 180, overflow: "auto", fontSize: 12 }}>{p.content.startsWith("{") ? <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>{JSON.stringify(JSON.parse(p.content), null, 1)}</pre> : p.content}</div>}
      <div className="attest" style={{ marginBottom: 12 }}>{ATTEST[p.need]}</div>
      <label className="sm" style={{ display: "flex", gap: 8, marginBottom: 12, cursor: "pointer" }}>
        <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} /> I have read the content above and make this attestation as {me.name}.
      </label>
      <div className="fld" style={{ maxWidth: 220, marginBottom: 12 }}><label>Re-enter PIN</label><input type="password" inputMode="numeric" value={pin} onChange={(e) => { setPin(e.target.value); setErr(""); }} placeholder="demo: 1234" autoFocus /></div>
      {err && <div className="deny" style={{ marginBottom: 12 }}>{err}</div>}
      <button className="btn v" disabled={!ok || !pin} onClick={sign}>Sign and append to ledger</button>
    </Modal>
  );
}

function ReturnModal({ p, me, onClose }: { p: Pending; me: Staff; onClose: () => void }) {
  const [q, setQ] = useState("");
  function send() {
    setState((s) => ({
      resolved: { ...s.resolved, [p.id]: { status: "returned", by: me.name, at: nowIso(), note: q } },
      notes: p.subject?.type === "visit" ? s.notes.map((n) => (n.id === p.subject!.ref ? { ...n, status: "returned" } : n)) : s.notes,
    }));
    audit(me.name, "return", p.doc, `Returned with query: ${q}`);
    toast(`Returned to ${p.entered} with your query.`);
    onClose();
  }
  return (
    <Modal title={`Return with a query — ${p.doc}`} onClose={onClose}>
      <div className="fld" style={{ marginBottom: 12 }}><label>Query to {p.entered}</label><textarea value={q} onChange={(e) => setQ(e.target.value)} placeholder="What needs to change before you can sign?" /></div>
      <button className="btn p" disabled={!q.trim()} onClick={send}>Return</button>
    </Modal>
  );
}

function AmendModal({ l, me, onClose }: { l: LedgerEntry; me: Staff; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const [field, setField] = useState("");
  const [now, setNow] = useState("");
  function send() {
    setState((s) => ({
      pending: [{
        id: uid("SO"), kind: "clinical", doc: `${l.doc} · amendment`, docType: l.docType, entered: me.name, enteredRole: me.role, at: nowIso(),
        need: me.cls === "consultant" ? "author" : "counter", needFrom: me.cls === "consultant" ? me.name : l.signer, priority: "medium",
        why: `Amendment: ${reason}`, subject: { type: "amend", ref: l.id }, content: JSON.stringify({ supersedes: l.id, field, now, reason }),
        version: l.version + 1, amendOf: l.id,
      }, ...s.pending],
    }));
    audit(me.name, "write", l.doc, `Amendment raised against ${l.id}: ${reason}`);
    toast("Amendment raised. The original stays in the ledger and is marked superseded only when the amendment is signed.");
    onClose();
  }
  return (
    <Modal title={`Amend — ${l.doc}`} onClose={onClose}>
      <div className="sm mut" style={{ marginBottom: 12 }}>Signed {l.at.replace("T", " ")} by {l.signer} · hash {l.hash}. This creates version {l.version + 1}; nothing about the signed version is edited.</div>
      <div className="frow">
        <div className="fld"><label>Field</label><input value={field} onChange={(e) => setField(e.target.value)} placeholder="e.g. plan.insulin" /></div>
        <div className="fld"><label>Corrected value</label><input value={now} onChange={(e) => setNow(e.target.value)} /></div>
      </div>
      <div className="fld" style={{ marginBottom: 12 }}><label>Reason</label><textarea value={reason} onChange={(e) => setReason(e.target.value)} /></div>
      <button className="btn p" disabled={!reason.trim() || !field.trim()} onClick={send}>Raise amendment for signature</button>
    </Modal>
  );
}
