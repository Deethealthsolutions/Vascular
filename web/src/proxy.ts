import { NextResponse, type NextRequest } from "next/server";
import { canOpen, homeFor } from "@/lib/auth/access";
import { readSession, SESSION_COOKIE } from "@/lib/auth/session";

// The staff workspace needs a log-in, and each role may open only its own screens
// (lib/auth/access.ts). The public site does not need a log-in.
export async function proxy(req: NextRequest) {
  const account = await readSession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!account) {
    const login = new URL("/login", req.url);
    login.searchParams.set("next", req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(login);
  }
  if (!canOpen(account.role, req.nextUrl.pathname)) return NextResponse.redirect(new URL(homeFor(account.role), req.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/clinical", "/clinical/:path*", "/staff", "/staff/:path*"],
};
