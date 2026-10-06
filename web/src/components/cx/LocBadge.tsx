import type { CSSProperties } from "react";
import { locById } from "@/lib/cx/locations";

/** A location's visual badge: its short code on its colour. `dot` adds a status dot on the corner. */
export function LocBadge({ id, size = "md", dot, title }: { id?: string; size?: "xs" | "sm" | "md" | "lg"; dot?: "ok" | "warn" | "bad" | "empty"; title?: string }) {
  const l = locById(id);
  return (
    <span className={`loc-b ${size}`} style={{ "--lc": l.color } as CSSProperties} title={title ?? `${l.name}, ${l.city}`} aria-label={title ?? `${l.name}, ${l.city}`}>
      {l.abbr}
      {dot && <i className={`loc-dot ${dot}`} aria-hidden />}
    </span>
  );
}
