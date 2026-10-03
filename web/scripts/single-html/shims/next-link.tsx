// Stand-in for next/link in the single-file export: internal hrefs become hash routes.
import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from "react";
import { navigate } from "../router";

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string | { pathname?: string; query?: Record<string, string> };
  replace?: boolean; scroll?: boolean; prefetch?: boolean | null; children?: ReactNode;
};

export default function Link({ href, replace, scroll, prefetch, onClick, children, ...rest }: Props) {
  void prefetch;
  const h = typeof href === "string" ? href : `${href.pathname ?? "/"}${href.query ? "?" + new URLSearchParams(href.query) : ""}`;
  const internal = h.startsWith("/") && !h.startsWith("//");
  return (
    <a
      {...rest}
      href={internal ? "#" + h : h}
      onClick={(e: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(e);
        if (e.defaultPrevented || !internal || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        navigate(h, { replace, scroll });
      }}
    >
      {children}
    </a>
  );
}
