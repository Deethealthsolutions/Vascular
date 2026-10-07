// Entry point for the single-file HTML export (npm run build:html).
// Mounts every route of the Next.js app (public site, staff walk-in flow, clinical
// workspace) behind a hash router; the store seeds the demo day on first open.

import { Component, Suspense, use, useEffect, useMemo, type ComponentType, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Shell } from "@/components/cx/Shell";
import { StaffTopBar } from "@/components/staff/StaffTopBar";
import { site } from "@/lib/site";
import Link from "next/link";
import { NotFoundError } from "./shims/next-navigation";
import { match, navigate, useLoc } from "./router";

import * as Home from "@/app/(public)/page";
import * as Book from "@/app/(public)/book/page";
import * as Conditions from "@/app/(public)/conditions/page";
import * as Condition from "@/app/(public)/conditions/[slug]/page";
import * as Outcomes from "@/app/(public)/outcomes/page";
import * as Portal from "@/app/(public)/portal/page";
import * as Referral from "@/app/(public)/portal/[id]/page";
import * as Refer from "@/app/(public)/refer/page";
import * as SelfCheck from "@/app/(public)/self-check/page";
import * as Team from "@/app/(public)/team/page";
import * as Treatments from "@/app/(public)/treatments/page";
import * as Treatment from "@/app/(public)/treatments/[slug]/page";
import * as StaffBoard from "@/app/staff/page";
import * as CheckIn from "@/app/staff/check-in/page";
import * as StaffVisit from "@/app/staff/visit/[id]/page";
import * as Overview from "@/app/clinical/page";
import * as Register from "@/app/clinical/register/page";
import * as Triage from "@/app/clinical/triage/page";
import * as Consult from "@/app/clinical/consult/page";
import * as CheckoutPage from "@/app/clinical/checkout/page";
import * as FlowPage from "@/app/clinical/flow/page";
import * as AdmitPage from "@/app/clinical/admit/page";
import * as ServicesPage from "@/app/clinical/services/page";
import * as Round from "@/app/clinical/round/page";
import * as Patient from "@/app/clinical/patient/[pid]/page";
import * as Visit from "@/app/clinical/visit/page";
import * as Nurse from "@/app/clinical/nurse/page";
import * as Profile from "@/app/clinical/profile/page";
import * as Signoff from "@/app/clinical/signoff/page";
import * as Wound from "@/app/clinical/wound/page";
import * as Research from "@/app/clinical/research/page";
import * as Graph from "@/app/clinical/graph/page";
import * as Audit from "@/app/clinical/audit/page";
import * as Auto from "@/app/clinical/auto/page";
import * as Arch from "@/app/clinical/arch/page";
import * as Requirements from "@/app/clinical/requirements/page";
import * as ResearchDocsNote from "./ResearchDocsNote";

type Area = "public" | "staff" | "clinical";
type Mod = { default: ComponentType<never>; metadata?: { title?: unknown }; generateMetadata?: (p: never) => Promise<{ title?: unknown }> };

const ROUTES: [string, Mod, Area][] = [
  ["/", Home, "public"], ["/book", Book, "public"], ["/conditions", Conditions, "public"], ["/conditions/:slug", Condition, "public"],
  ["/outcomes", Outcomes, "public"], ["/portal", Portal, "public"], ["/portal/:id", Referral, "public"], ["/refer", Refer, "public"],
  ["/self-check", SelfCheck, "public"], ["/team", Team, "public"], ["/treatments", Treatments, "public"], ["/treatments/:slug", Treatment, "public"],
  ["/staff", StaffBoard, "staff"], ["/staff/check-in", CheckIn, "staff"], ["/staff/visit/:id", StaffVisit, "staff"],
  ["/clinical", Overview, "clinical"], ["/clinical/register", Register, "clinical"], ["/clinical/triage", Triage, "clinical"],
  ["/clinical/consult", Consult, "clinical"], ["/clinical/checkout", CheckoutPage, "clinical"], ["/clinical/flow", FlowPage, "clinical"], ["/clinical/admit", AdmitPage, "clinical"], ["/clinical/services", ServicesPage, "clinical"], ["/clinical/round", Round, "clinical"], ["/clinical/patient/:pid", Patient, "clinical"],
  ["/clinical/visit", Visit, "clinical"], ["/clinical/nurse", Nurse, "clinical"], ["/clinical/profile", Profile, "clinical"],
  ["/clinical/signoff", Signoff, "clinical"], ["/clinical/wound", Wound, "clinical"], ["/clinical/research", Research, "clinical"],
  ["/clinical/graph", Graph, "clinical"], ["/clinical/audit", Audit, "clinical"], ["/clinical/auto", Auto, "clinical"],
  ["/clinical/arch", Arch, "clinical"], ["/clinical/research-docs", ResearchDocsNote, "clinical"], ["/clinical/requirements", Requirements, "clinical"],
];
const TEMPLATE: Record<Area, [string, string]> = {
  public: [site.name, `%s | ${site.name}`],
  staff: ["Staff workspace", "%s | Staff workspace"],
  clinical: ["Clinical workspace", "%s | Clinical workspace"],
};

// Demo patients: the store builds the same "demo day" as the website on first open
// (app/clinical/demoDay.ts, registered by the clinical Shell).

// ------------------------------------------------------------------ page rendering

/** Next.js server pages are async (they await params); resolve them once per URL. */
function AsyncPage({ p }: { p: Promise<ReactNode> }) {
  return <>{use(p)}</>;
}
function RoutePage({ C, params, search }: { C: ComponentType<never>; params: Record<string, string>; search: string }) {
  const props = useMemo(() => {
    const sp: Record<string, string> = {};
    new URLSearchParams(search).forEach((v, k) => { sp[k] = v; });
    return { params: Promise.resolve(params), searchParams: Promise.resolve(sp) };
  }, [params, search]);
  const isAsync = C.constructor.name === "AsyncFunction";
  const pending = useMemo(() => (isAsync ? (C as unknown as (p: typeof props) => Promise<ReactNode>)(props) : null), [C, isAsync, props]);
  if (pending) return <Suspense fallback={null}><AsyncPage p={pending} /></Suspense>;
  const P = C as unknown as ComponentType<typeof props>;
  return <P {...props} />;
}

class Boundary extends Component<{ children: ReactNode; k: string }, { err: Error | null }> {
  state = { err: null as Error | null };
  static getDerivedStateFromError(err: Error) { return { err }; }
  componentDidUpdate(prev: { k: string }) { if (prev.k !== this.props.k && this.state.err) this.setState({ err: null }); }
  render() {
    if (!this.state.err) return this.props.children;
    const nf = this.state.err instanceof NotFoundError;
    return (
      <div className="container-page py-16">
        <h1 className="text-2xl font-bold text-brand-dark">{nf ? "Page not found" : "Something went wrong"}</h1>
        <p className="mt-2 text-muted">{nf ? "That page does not exist in this prototype." : this.state.err.message}</p>
        <p className="mt-4"><Link href="/" className="btn-primary">Go to the home page</Link></p>
      </div>
    );
  }
}

function Frame({ area, children }: { area: Area; children: ReactNode }) {
  if (area === "clinical") return <div className="cx" style={{ flex: 1 }}><Shell>{children}</Shell></div>;
  if (area === "staff") return <div className="flex min-h-full flex-1 flex-col bg-surface"><StaffTopBar /><main id="main" className="flex-1">{children}</main></div>;
  return <><Header /><main id="main" className="flex-1">{children}</main><Footer /></>;
}

type Hit = { mod: Mod; area: Area; params: Record<string, string> } | null;
const routeCache = new Map<string, Hit>();
/** Cached so the params object stays the same while the path does. */
function findRoute(path: string): Hit {
  if (!routeCache.has(path)) {
    let hit: Hit = null;
    for (const [pattern, mod, area] of ROUTES) { const params = match(pattern, path); if (params) { hit = { mod, area, params }; break; } }
    routeCache.set(path, hit);
  }
  return routeCache.get(path)!;
}

function App() {
  const { path, search } = useLoc();
  const hit = findRoute(path);
  const area: Area = hit?.area ?? (path.startsWith("/clinical") ? "clinical" : path.startsWith("/staff") ? "staff" : "public");

  useEffect(() => {
    const [def, tpl] = TEMPLATE[area];
    const set = (t: unknown) => { document.title = typeof t === "string" ? tpl.replace("%s", t) : def; };
    set(hit?.mod.metadata?.title);
    if (hit?.mod.generateMetadata) (hit.mod.generateMetadata as (p: object) => Promise<{ title?: unknown }>)({ params: Promise.resolve(hit.params), searchParams: Promise.resolve({}) }).then((m) => set(m.title), () => {});
  }, [hit, area]);

  return (
    <>
      <div className="bg-warn-soft px-4 py-1.5 text-center text-sm text-warn print:hidden">
        Prototype with demo data only. Do not enter real patient information.
        <span className="ml-3 whitespace-nowrap">
          Go to:{" "}
          {([["/", "Public site"], ["/staff", "Staff walk-in"], ["/clinical/register", "Clinical workspace"]] as const).map(([h, l], i) => (
            <span key={h}>{i > 0 && " · "}<Link href={h} className="font-semibold underline" style={{ fontWeight: area === (h === "/" ? "public" : h.startsWith("/staff") ? "staff" : "clinical") ? 700 : 500 }}>{l}</Link></span>
          ))}
        </span>
      </div>
      <Frame area={area}>
        <Boundary k={path + "?" + search}>
          {hit ? <RoutePage key={path} C={hit.mod.default} params={hit.params} search={search} /> : <NotFound />}
        </Boundary>
      </Frame>
    </>
  );
}

function NotFound(): ReactNode {
  throw new NotFoundError("not found");
}

// Plain <a href="/…"> links (not next/link) and in-page "#id" anchors, rewritten for the hash router.
document.addEventListener("click", (e) => {
  const a = (e.target as Element | null)?.closest?.("a");
  if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || a.target === "_blank") return;
  const href = a.getAttribute("href") ?? "";
  if (href.startsWith("/") && !href.startsWith("//")) { e.preventDefault(); navigate(href); }
  else if (href.startsWith("#") && !href.startsWith("#/") && href.length > 1) { e.preventDefault(); document.getElementById(href.slice(1))?.scrollIntoView({ behavior: "smooth" }); }
});

createRoot(document.getElementById("root")!, {
  onCaughtError: (err) => { if (!(err instanceof NotFoundError)) console.error(err); },
}).render(<App />);
