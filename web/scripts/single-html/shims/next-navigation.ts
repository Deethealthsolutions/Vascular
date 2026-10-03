// Stand-in for next/navigation in the single-file export.
import { navigate, useLoc } from "../router";

export class NotFoundError extends Error {}

const router = {
  push: (href: string, o?: { scroll?: boolean }) => navigate(href, { scroll: o?.scroll }),
  replace: (href: string, o?: { scroll?: boolean }) => navigate(href, { replace: true, scroll: o?.scroll }),
  back: () => window.history.back(),
  forward: () => window.history.forward(),
  refresh: () => {},
  prefetch: () => {},
};

export const useRouter = () => router;
export const usePathname = () => useLoc().path;
export const useSearchParams = () => new URLSearchParams(useLoc().search);
export const useParams = () => ({});

export function notFound(): never {
  throw new NotFoundError("not found");
}
export function redirect(href: string): never {
  navigate(href, { replace: true });
  throw new NotFoundError("redirected");
}
