// Hash router for the single-file export: "#/clinical/triage?x=1" stands in for the
// Next.js route "/clinical/triage?x=1", so the whole app runs from one HTML file.

import { useSyncExternalStore } from "react";

export type Loc = { path: string; search: string };

const listeners = new Set<() => void>();
let current: Loc = read();

function read(): Loc {
  const h = typeof window === "undefined" ? "" : window.location.hash.replace(/^#/, "");
  return parse(h.startsWith("/") ? h : "/");
}

function parse(raw: string): Loc {
  const i = raw.indexOf("?");
  return { path: (i < 0 ? raw : raw.slice(0, i)).replace(/\/+$/, "") || "/", search: i < 0 ? "" : raw.slice(i + 1) };
}

function emit(scroll = true, next: Loc = read()) {
  const prev = current;
  current = next;
  if (prev.path === current.path && prev.search === current.search) return;
  if (scroll && prev.path !== current.path) window.scrollTo(0, 0);
  listeners.forEach((l) => l());
}

if (typeof window !== "undefined") {
  window.addEventListener("hashchange", () => emit());
  window.addEventListener("popstate", () => emit());
}

export function navigate(href: string, opts: { replace?: boolean; scroll?: boolean } = {}) {
  const raw = href.startsWith("/") ? href : "/" + href;
  // Keep the route in memory; mirror it to the address bar where the host frame allows it.
  try {
    if (opts.replace) window.history.replaceState(null, "", "#" + raw);
    else window.history.pushState(null, "", "#" + raw);
  } catch {
    // sandboxed frame: navigation still works, the back button does not
  }
  emit(opts.scroll !== false, parse(raw));
}

export function useLoc(): Loc {
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, () => current, () => current);
}

/** Match "/clinical/patient/:pid" against a path; returns params or null. */
export function match(pattern: string, path: string): Record<string, string> | null {
  const a = pattern.split("/").filter(Boolean), b = path.split("/").filter(Boolean);
  if (a.length !== b.length) return null;
  const out: Record<string, string> = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith(":")) out[a[i].slice(1)] = decodeURIComponent(b[i]);
    else if (a[i] !== b[i]) return null;
  }
  return out;
}
