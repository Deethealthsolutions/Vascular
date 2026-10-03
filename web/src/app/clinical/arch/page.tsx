import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Guard, Top } from "@/components/cx/Shell";

export const metadata: Metadata = { title: "Architecture" };

const Box = ({ c = "", t, d }: { c?: string; t: string; d?: string }) => (
  <div className={`abox ${c}`}><div className="t">{t}</div>{d && <div className="d">{d}</div>}</div>
);
const Zone = ({ c, l, children }: { c: string; l: string; children: ReactNode }) => (
  <div className={`azone ${c}`}><span className="zl">{l}</span>{children}</div>
);
const Flow = ({ children }: { children: ReactNode }) => <div className="aflow"><span>{children}</span></div>;
const Down = () => <div className="adown">▼</div>;
const Note = ({ children }: { children: ReactNode }) => <div className="sm" style={{ color: "var(--ink2)", lineHeight: 1.65, marginTop: 13 }}>{children}</div>;
const CardX = ({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) => (
  <div className="card mb14"><div className="card-h"><h3>{title}</h3>{hint && <span className="hint">{hint}</span>}</div><div className="card-b">{children}</div></div>
);

export default function ArchPage() {
  return (
    <Guard screen="arch">
      <Top title="Architecture" sub="Services, trust zones, data lake and the AI access layer" />
      <div className="wrap">
        <div className="disc"><b>Target architecture.</b> This prototype is a Next.js front end over fixtures; this is the shape the production system takes (REQ-LAKE-001/002, REQ-AI-001/002 are Phase 5).</div>

        <CardX title="System architecture" hint="three trust zones · one crossing · one direction">
          <div className="alab">Clients</div>
          <div className="arow"><Box t="Nurse mobile" d="Observation entry, voice capture, wound photography, offline queue" /><Box t="Clinician tablet / desktop" d="Round, chart, zoom, visit analysis, sign-off" /><Box t="Head of service browser" d="Network rollup across three centres" /><Box c="n" t="AI assistant" d="Reaches the system only through MCP, never the database" /></div>
          <Flow>HTTPS · <b>OAuth2 / OIDC</b> · user identity carried end to end</Flow>
          <div className="arow"><Box c="k" t="API gateway" d="Authentication, authorisation, centre scoping, rate limiting, audit. Every caller — UI, integration or agent — inherits the same rules." /></div>
          <Down />
          <div className="alab">Services</div>
          <div className="arow"><Box c="b" t="Patient master" d="Identity, aliases, consent, duplicate adjudication" /><Box c="b" t="Clinical record" d="Encounters (IP, OP, ED, day-case), observations, labs, meds, documents" /><Box c="b" t="Rule engine" d="Subscribes to events, raises alerts, never writes clinical data" /><Box c="b" t="Image service" d="Wound photography, calibration, quality gate, consent scope" /></div>
          <div className="arow" style={{ marginTop: 9 }}><Box c="b" t="Voice pipeline" d="Stateless: audio in, candidate fields out — drafts only" /><Box c="b" t="Workflow" d="Alerts, tasks, the append-only sign-off ledger" /><Box c="b" t="Analytics" d="Reads the serving layer, never the transactional store" /><Box c="v" t="Research service" d="Studies, CRF, abstraction, knowledge graph" /></div>
          <Down />
          <div className="alab">Stores</div>
          <div className="arow" style={{ alignItems: "stretch" }}>
            <div style={{ flex: 2.1 }}><Zone c="cl" l="Clinical zone · identifiable"><div className="arow"><Box t="PostgreSQL + TimescaleDB" d="org · identity · clinical · wound · workflow · audit" /><Box t="Object storage" d="Wound images, scanned consent, documents" /></div></Zone></div>
            <div style={{ flex: 1.2 }}><Zone c="rs" l="Research zone · pseudonymous"><div className="arow"><Box t="PostgreSQL + pgvector" d="research schema · graph nodes and edges · embeddings" /></div></Zone></div>
            <div style={{ flex: 0.75 }}><Zone c="vt" l="Vault"><div className="arow"><Box t="Isolated DB" d="pseudo ↔ patient · separate KMS key · two-person reads" /></div></Zone></div>
          </div>
          <div className="arow" style={{ marginTop: 11 }}><Box c="a" t="Extract broker — the only crossing between the clinical and research zones" d="Approved protocol · variable allow-list · consent evaluated at materialisation · pseudonymised · custodian sign-off · logged. Runs one way." /></div>
          <Note>Three databases rather than three schemas, because the separation has to hold at the credential level. A connection string that reads the clinical store must not be able to reach the vault.</Note>
        </CardX>

        <CardX title="Data lake" hint="Apache Iceberg on object storage · four catalogs, four IAM boundaries">
          <div className="alab">Ingestion</div>
          <div className="arow"><Box t="PostgreSQL" d="Transactional source of truth" /><Box t="Debezium CDC" d="Change capture from the write-ahead log" /><Box t="Kafka" d="Ordered, replayable event stream" /><Box t="Event outbox" d="Domain events written in the same transaction" /></div>
          <Down />
          <div className="alab">Clinical catalog · medallion</div>
          <div className="med">
            {[["Bronze", "#b45309", "Raw CDC, source-faithful, append-only. Never corrected."], ["Silver", "#64748b", "Conformed and deduplicated. Patient merges resolved here. Units normalised."],
              ["Gold", "#b58b14", "Marts and rollups: site comparison, amputation and salvage rates, feature tables."], ["Serving", "#0d9488", "What dashboards read — never the transactional store."]].map(([n, c, d]) => (
              <div key={n}><div className="mh"><i style={{ background: c }} />{n}</div><div className="md">{d}</div></div>
            ))}
          </div>
          <Flow><b>broker job only</b> — validates variables against the approved protocol, evaluates consent per patient at run time, pseudonymises through the vault, and pins the snapshot id it read</Flow>
          <div className="arow">
            <div style={{ flex: 1 }}><Zone c="rs" l="Research catalog"><div className="xs" style={{ color: "var(--ink2)", lineHeight: 1.6 }}>Curated study datasets and immutable snapshots. <b>No principal reads both this and the clinical catalog.</b></div></Zone></div>
            <div style={{ flex: 1 }}><Zone c="im" l="Imaging catalog"><div className="xs" style={{ color: "var(--ink2)", lineHeight: 1.6 }}>Wound photography with its own lifecycle and tiering.</div></Zone></div>
            <div style={{ flex: 1 }}><Zone c="kn" l="Knowledge catalog"><div className="xs" style={{ color: "var(--ink2)", lineHeight: 1.6 }}>Protocols, SOPs, guidelines. No patient data.</div></Zone></div>
            <div style={{ flex: 0.8 }}><Zone c="vt" l="Vault"><div className="xs" style={{ color: "var(--ink2)", lineHeight: 1.6 }}>Pseudonym map only. Own key, own IAM.</div></Zone></div>
          </div>
          <Note><b>The failure mode most likely to sink this design is the lake becoming a bypass.</b> A data scientist with read access to the clinical gold layer has stepped around the ethics gate, the allow-list, the consent check and the audit in one move. Iceberg snapshot time travel <i>is</i> the reproducible research snapshot.</Note>
        </CardX>

        <CardX title="AI layer — MCP and RAG" hint="the trust zones continue all the way into the vector index">
          <div className="arow"><Box c="k" t="AI assistant" d="Carries the end user's token. Never a service account, never a database connection." /></div>
          <Down />
          <div className="alab">MCP servers — one per zone</div>
          <div className="arow">
            <div style={{ flex: 1 }}><Zone c="kn" l="knowledge-mcp"><div className="xs" style={{ color: "var(--ink2)" }}>Guidelines, protocols, drug information. No PHI.</div></Zone></div>
            <div style={{ flex: 1 }}><Zone c="cl" l="clinical-mcp"><div className="xs" style={{ color: "var(--ink2)" }}>Patient lookup, chart summary, draft authoring. Scoped to the caller&apos;s care relationship.</div></Zone></div>
            <div style={{ flex: 1 }}><Zone c="rs" l="research-mcp"><div className="xs" style={{ color: "var(--ink2)" }}>Study data, graph traversal, manuscript support. Pseudonymous only.</div></Zone></div>
          </div>
          <Flow>every tool call hits the <b>same authorised API the UI uses</b> · no tool holds its own connection</Flow>
          <div className="arow"><Box t="idx-knowledge" d="No PHI. All staff may retrieve." /><Box c="b" t="idx-clinical" d="PHI. Care relationship required. ACL pre-filter; only signed content retrieves." /><Box c="v" t="idx-research" d="Pseudonymous. Study team only. Graph-aware (GraphRAG)." /></div>
          <div className="arow mt14"><Box c="r" t="An embedding is not anonymisation" d="Clinical vectors are classified and controlled as PHI." /><Box c="a" t="Filter before you search" d="ACL is a pre-filter in the query, not a post-filter on results." /><Box c="r" t="Drafts only — an AI never signs" d="The signer column references staff; there is no staff row for a model." /></div>
          <Note>Audit parity closes the loop: a tool call is written to the same access log as a UI read, with model identity and prompt hash. See the voice-pipeline entries in Access audit.</Note>
        </CardX>

        <CardX title="Schema map" hint="eight bounded contexts across three databases">
          <table className="t"><thead><tr><th>Schema</th><th>Database</th><th>Key tables</th><th>Write rate</th></tr></thead><tbody>
            {[["org", "clinical", "centre, location, staff, staff_role, service_line", "Rare"], ["identity", "clinical", "patient, patient_alias, patient_profile, consent, duplicate_candidate", "Low"],
              ["clinical", "clinical", "encounter, inpatient_stay, outpatient_visit, ed_attendance, day_case, appointment, observation, derived_score, lab_result, document", "Very high"],
              ["wound", "clinical", "wound, assessment, image, hbot_course, hbot_session", "Medium"], ["workflow", "clinical", "alert, alert_response, attestation, signoff", "High"],
              ["audit", "clinical", "access", "Very high"], ["research", "research", "study, protocol_variable, participant, extract_request, extract_run, graph_node, graph_edge", "Low"],
              ["vault", "vault", "pseudonym, reidentification", "Very low"]].map((r) => (
              <tr key={r[0]}><td className="num sm"><b>{r[0]}</b></td><td><span className={`pill ${r[1] === "research" ? "v" : r[1] === "vault" ? "n" : "b"}`}>{r[1]}</span></td><td className="num xs mut">{r[2]}</td><td className="sm mut">{r[3]}</td></tr>
            ))}
          </tbody></table>
        </CardX>
      </div>
    </Guard>
  );
}
