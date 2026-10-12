// Which workspace screens each log-in role may open. Used by the proxy (blocks the URL on the
// server) and by the sidebar (hides what the role cannot open).
//
// The clinical screens also check a staff "persona" (lib/cx/users.ts) for finer rules and for
// names on signatures. Each log-in role is paired with a matching persona; admins and directors
// can still preview any persona with "Preview as".

export type Area = { href: string; screens: string[] };

const SCREENS = {
  register: "/clinical/register",
  triage: "/clinical/triage",
  consult: "/clinical/consult",
  research: "/clinical/research",
  rdocs: "/clinical/research-docs",
  graph: "/clinical/graph",
  profile: "/clinical/profile",
} as const;

type ScreenKey = keyof typeof SCREENS;

/** "all" = every screen. Roles not listed here (e.g. an old role value) see nothing. */
const ROLE_ACCESS: Record<string, "all" | ScreenKey[]> = {
  admin: "all",
  director: "all",
  doctor: ["consult"],
  front_office: ["register"],
  nurse: ["triage"],
  research_scientist: ["research", "rdocs", "graph"],
  medical_records: ["register", "profile"],
};

/** Staff persona (lib/cx/users.ts) each role works as; null = free choice (admin, director). */
export const PERSONA: Record<string, string | null> = {
  admin: null,
  director: null,
  doctor: "mk",
  front_office: "fd",
  nurse: "rv",
  research_scientist: "sh",
  medical_records: "fd",
};

export const NO_ACCESS = "/clinical/no-access";

export const seesAll = (role: string | null | undefined) => !!role && ROLE_ACCESS[role] === "all";

/** Paths (screen roots) a role may open, or "all". */
export function allowedPaths(role: string | null | undefined): "all" | string[] {
  const a = role ? ROLE_ACCESS[role] : undefined;
  if (a === "all") return "all";
  return (a ?? []).map((k) => SCREENS[k]);
}

/** May this role open this path? Only /clinical and /staff paths are restricted. */
export function canOpen(role: string | null | undefined, path: string): boolean {
  if (path === NO_ACCESS) return true;
  const a = allowedPaths(role);
  if (a === "all") return path !== "/clinical/users" || role === "admin";
  return a.some((p) => path === p || path.startsWith(`${p}/`));
}

/** Where a role lands after log-in (and when it opens a screen it may not use). */
export function homeFor(role: string | null | undefined): string {
  const a = allowedPaths(role);
  if (a === "all") return "/clinical/flow";
  return a[0] ?? NO_ACCESS;
}
