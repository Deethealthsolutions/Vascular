// Requirement-by-requirement comparison of the HTML mockup and this build, against
// Hospital_Development_Requirements.html. Drives /clinical/requirements.

export type Status = "met" | "partial" | "missing" | "future";

export type Req = {
  id: string; area: string; text: string;
  mockup: Status; mockupNote: string;
  build: Status; buildNote: string; href?: string;
};

export const REQS: Req[] = [
  // 5. Patient profile master
  { id: "REQ-PROF-001", area: "Patient profile", text: "One enterprise record per person, many centre MRNs",
    mockup: "partial", mockupNote: "Shows one MRN per profile; aliases not modelled.",
    build: "met", buildNote: "Centre MRNs column; referral episodes and signed merges add aliases.", href: "/clinical/profile" },
  { id: "REQ-PROF-002", area: "Patient profile", text: "Identity stored apart from encounters",
    mockup: "met", mockupNote: "Explained and shown as a separate screen.",
    build: "met", buildNote: "Profile screen holds no clinical data; encounters reference the patient ID.", href: "/clinical/profile" },
  { id: "REQ-PROF-003", area: "Patient profile", text: "Duplicate detection across centres",
    mockup: "met", mockupNote: "Candidate list with score and reason.",
    build: "met", buildNote: "Same list plus side-by-side comparison with differences highlighted.", href: "/clinical/profile" },
  { id: "REQ-PROF-004", area: "Patient profile", text: "Signed, reversible merge",
    mockup: "missing", mockupNote: "Adjudicate button does nothing.",
    build: "met", buildNote: "Consultant proposes, a second consultant signs; signed merges can be reversed the same way.", href: "/clinical/profile" },

  // 6. Dashboard
  { id: "REQ-DASH-001", area: "Dashboard", text: "Centre bands with census, review needs, ICU/ward, referrals, HBOT, overdue follow-up",
    mockup: "met", mockupNote: "", build: "met", buildNote: "Also ED and day-case counts per centre.", href: "/clinical/round" },
  { id: "REQ-DASH-002", area: "Dashboard", text: "Centre filter in URL and UI",
    mockup: "met", mockupNote: "?centre=BLR", build: "met", buildNote: "?centre= and ?care=; staff scoped to one centre are locked to it.", href: "/clinical/round?centre=blr" },
  { id: "REQ-DASH-003", area: "Dashboard", text: "Patients ordered by clinical acuity",
    mockup: "met", mockupNote: "Uses fixture NEWS2.", build: "met", buildNote: "Re-orders using newly saved observations.", href: "/clinical/round" },
  { id: "REQ-DASH-004", area: "Dashboard", text: "Network overview for head of service",
    mockup: "met", mockupNote: "", build: "met", buildNote: "Head-of-service role only; filters kept in the URL.", href: "/clinical" },

  // 7. IP / OP
  { id: "REQ-CARE-001", area: "IP / OP", text: "Encounters classed IP, OP, emergency, day-case",
    mockup: "partial", mockupNote: "IP and OP only.",
    build: "met", buildNote: "Four encounter tabs with separate counts.", href: "/clinical/round?care=ed" },
  { id: "REQ-CARE-002", area: "IP / OP", text: "Admission, bed, ward transfer, discharge",
    mockup: "partial", mockupNote: "Bed shown; no transfer or discharge.",
    build: "partial", buildNote: "Transfer and discharge work (summary goes to sign-off). Admission is recorded as a clinic outcome but does not yet create a bed.", href: "/clinical/patient/P-4402" },
  { id: "REQ-CARE-003", area: "IP / OP", text: "Appointment, attendance, DNA, outcome, follow-up",
    mockup: "partial", mockupNote: "Read-only lists.",
    build: "met", buildNote: "Mark arrived / DNA, record outcome and follow-up; DNA creates a recall in the safety net.", href: "/clinical/round?care=op" },

  // 8. Chart
  { id: "REQ-CHART-001", area: "Patient chart", text: "Latest vitals, labs, scores, medications, alerts",
    mockup: "met", mockupNote: "", build: "met", buildNote: "Includes observations saved by nurses.", href: "/clinical/patient/P-4412" },
  { id: "REQ-CHART-002", area: "Patient chart", text: "Zoom into one channel incl. creatinine",
    mockup: "partial", mockupNote: "No creatinine channel.",
    build: "met", buildNote: "Creatinine zoom plotted at draw times with 1.5× / 2× baseline lines.", href: "/clinical/patient/P-4412?zoom=creat" },
  { id: "REQ-CHART-003", area: "Patient chart", text: "Window statistics",
    mockup: "met", mockupNote: "", build: "met", buildNote: "", href: "/clinical/patient/P-4418?zoom=cbg" },
  { id: "REQ-CHART-004", area: "Patient chart", text: "Context sparklines, clickable",
    mockup: "met", mockupNote: "", build: "met", buildNote: "", href: "/clinical/patient/P-4418?zoom=cbg" },

  // 9. Entry
  { id: "REQ-NURSE-001", area: "Data entry", text: "Nurse enters HR, pulse, BP, SpO₂, RR, temp, CBG, urine, AVPU, O₂; creates timestamped rows",
    mockup: "partial", mockupNote: "No HR field; Save does nothing.",
    build: "met", buildNote: "All fields with range validation; attested, timestamped, offline-tolerant.", href: "/clinical/nurse" },
  { id: "REQ-NURSE-002", area: "Data entry", text: "Scores and alerts raised after entry, into review queue",
    mockup: "partial", mockupNote: "Live score only.",
    build: "met", buildNote: "NEWS2 ≥ 5 or a single 3 creates a high-priority countersign item.", href: "/clinical/nurse" },
  { id: "REQ-VISIT-001", area: "Data entry", text: "Visit analysis incl. medication changes and wound/HBOT notes; draft then sign",
    mockup: "partial", mockupNote: "No medication changes; Sign / Save inert.",
    build: "met", buildNote: "Medication changes, HBOT note, draft → submit → sign → amend.", href: "/clinical/visit" },
  { id: "REQ-VISIT-002", area: "Data entry", text: "Voice-to-text creates drafts only",
    mockup: "partial", mockupNote: "Simulated dictation; nothing enforced.",
    build: "met", buildNote: "Voice notes flagged as AI drafts with model attribution; audit logs the extraction.", href: "/clinical/visit" },

  // 10. Wound
  { id: "REQ-WOUND-001", area: "Wound & HBOT", text: "Wound site, laterality, aetiology, Wagner, status",
    mockup: "partial", mockupNote: "Laterality and status implicit.",
    build: "met", buildNote: "Explicit laterality and status pills.", href: "/clinical/wound" },
  { id: "REQ-WOUND-002", area: "Wound & HBOT", text: "Photos in object storage, metadata in DB",
    mockup: "met", mockupNote: "Metadata displayed.",
    build: "partial", buildNote: "Metadata and quality gate shown; no real object storage in a prototype.", href: "/clinical/wound" },
  { id: "REQ-WOUND-003", area: "Wound & HBOT", text: "HBOT course and sessions (pressure, duration, complications)",
    mockup: "met", mockupNote: "", build: "met", buildNote: "Adds a session table with ATA and minutes.", href: "/clinical/wound" },
  { id: "REQ-WOUND-004", area: "Wound & HBOT", text: "Consent scope enforced for photo use",
    mockup: "partial", mockupNote: "Described, not enforced.",
    build: "met", buildNote: "Use requests checked against patient consent at read time; refusals logged.", href: "/clinical/wound?wid=W-2201" },

  // 11. Research
  { id: "REQ-RES-001", area: "Research", text: "Studies, protocols, ethics and registry references",
    mockup: "met", mockupNote: "", build: "met", buildNote: "", href: "/clinical/research" },
  { id: "REQ-RES-002", area: "Research", text: "Pseudonymous participants only",
    mockup: "met", mockupNote: "", build: "met", buildNote: "Research roles are also blocked from identifiable charts.", href: "/clinical/research" },
  { id: "REQ-RES-003", area: "Research", text: "Extracts with allow-lists; consent checked at run time",
    mockup: "partial", mockupNote: "Builder inert.",
    build: "met", buildNote: "Submit → custodian signs → materialises with released and withheld counts.", href: "/clinical/research" },
  { id: "REQ-RES-004", area: "Research", text: "Legacy paper abstraction",
    mockup: "met", mockupNote: "", build: "met", buildNote: "", href: "/clinical/research?study=DFU-RETRO-19-25" },

  // 12. Graph
  { id: "REQ-GRAPH-001", area: "Knowledge graph", text: "All node types in legend",
    mockup: "met", mockupNote: "", build: "met", buildNote: "", href: "/clinical/graph" },
  { id: "REQ-GRAPH-002", area: "Knowledge graph", text: "No patient nodes",
    mockup: "met", mockupNote: "", build: "met", buildNote: "", href: "/clinical/graph" },
  { id: "REQ-GRAPH-003", area: "Knowledge graph", text: "Unused variables, sparse claims, manuscript gaps",
    mockup: "met", mockupNote: "", build: "met", buildNote: "", href: "/clinical/graph" },
  { id: "REQ-GRAPH-004", area: "Knowledge graph", text: "GraphRAG support",
    mockup: "future", mockupNote: "Architecture only.", build: "future", buildNote: "Phase 5.", href: "/clinical/arch" },

  // 13. Sign-off
  { id: "REQ-SIGN-001", area: "Sign-off", text: "Draft, submitted, signed, superseded states",
    mockup: "partial", mockupNote: "Shown in data; Sign button inert.",
    build: "met", buildNote: "Working lifecycle; amendments supersede without editing.", href: "/clinical/signoff" },
  { id: "REQ-SIGN-002", area: "Sign-off", text: "Signature bound to version, content hash, attestation",
    mockup: "partial", mockupNote: "Static hashes.",
    build: "met", buildNote: "SHA-256 over content, version and attestation; PIN re-authentication.", href: "/clinical/signoff" },
  { id: "REQ-SIGN-003", area: "Sign-off", text: "Countersignature / second person enforced",
    mockup: "partial", mockupNote: "Described only.",
    build: "met", buildNote: "Role and separation-of-duties checks on every Sign button.", href: "/clinical/signoff" },
  { id: "REQ-SIGN-004", area: "Sign-off", text: "AI output only creates drafts",
    mockup: "partial", mockupNote: "Described only.",
    build: "met", buildNote: "AI drafts labelled; no model can be selected as signer.", href: "/clinical/signoff" },

  // 14. Lake / AI
  { id: "REQ-LAKE-001", area: "Data lake & AI", text: "CDC export to Iceberg, separate catalogs",
    mockup: "future", mockupNote: "Architecture only.", build: "future", buildNote: "Phase 5; architecture screen.", href: "/clinical/arch" },
  { id: "REQ-LAKE-002", area: "Data lake & AI", text: "Only the broker writes clinical → research",
    mockup: "future", mockupNote: "Architecture only.", build: "partial", buildNote: "Broker workflow demonstrated in the research screen; lake itself is Phase 5.", href: "/clinical/research" },
  { id: "REQ-AI-001", area: "Data lake & AI", text: "MCP servers per trust zone",
    mockup: "future", mockupNote: "Architecture only.", build: "future", buildNote: "Phase 5.", href: "/clinical/arch" },
  { id: "REQ-AI-002", area: "Data lake & AI", text: "RAG indexes per zone, ACL pre-filtered",
    mockup: "future", mockupNote: "Architecture only.", build: "future", buildNote: "Phase 5.", href: "/clinical/arch" },

  // 15. Non-functional
  { id: "NFR-SEC-1", area: "Non-functional", text: "Role-based and centre-scoped access",
    mockup: "missing", mockupNote: "Role toggle only changes the landing screen.",
    build: "partial", buildNote: "Enforced in the UI per staff role and centre; production must enforce in the API gateway.", href: "/clinical/round" },
  { id: "NFR-SEC-2", area: "Non-functional", text: "Audit reads, writes, exports, sign-offs, AI calls; patient access report",
    mockup: "missing", mockupNote: "",
    build: "met", buildNote: "Access audit screen with per-patient report and CSV export.", href: "/clinical/audit" },
  { id: "NFR-AVAIL-1", area: "Non-functional", text: "Bedside capture tolerates network loss",
    mockup: "missing", mockupNote: "",
    build: "met", buildNote: "Observations queue offline and sync on reconnect.", href: "/clinical/nurse" },
  { id: "NFR-DQ-1", area: "Non-functional", text: "Observations record source mode and time; scores store algorithm version",
    mockup: "missing", mockupNote: "",
    build: "met", buildNote: "Entry mode, entered-by, timestamp and NEWS2 algorithm version saved with each set.", href: "/clinical/nurse" },
  { id: "NFR-PERF-1", area: "Non-functional", text: "72-hour chart < 2 s; dashboard < 3 s",
    mockup: "missing", mockupNote: "Not measurable in a static file.",
    build: "partial", buildNote: "Fixture data renders instantly; must be load-tested against the real API.", href: "/clinical/patient/P-4412" },
];

export const STATUS_PILL: Record<Status, [string, string]> = {
  met: ["g", "met"], partial: ["a", "partial"], missing: ["r", "missing"], future: ["n", "future phase"],
};
