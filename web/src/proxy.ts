import { NextResponse, type NextRequest } from "next/server";
import { readSession, SESSION_COOKIE } from "@/lib/auth/session";

// The staff workspace needs a log-in; the public site does not.
export async function proxy(req: NextRequest) {
  if (await readSession(req.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();
  const login = new URL("/login", req.url);
  login.searchParams.set("next", req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/clinical", "/clinical/:path*", "/staff", "/staff/:path*"],
};
