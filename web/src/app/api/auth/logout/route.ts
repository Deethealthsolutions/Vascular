import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { authDb } from "@/lib/auth/db";
import { readSessionFull, SESSION_COOKIE } from "@/lib/auth/session";

// Ends the database session (if any) and clears the cookie.
async function endSession() {
  const full = await readSessionFull((await cookies()).get(SESSION_COOKIE)?.value);
  if (full?.token) await authDb()?.rpc("app_logout", { p_token: full.token });
}

const clear = (res: NextResponse) => {
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0, secure: process.env.NODE_ENV === "production" });
  return res;
};

export async function POST() {
  await endSession();
  return clear(NextResponse.json({ ok: true }));
}

/** Used when the database says the session has ended (deactivated, password reset, role changed). */
export async function GET(req: Request) {
  await endSession();
  return clear(NextResponse.redirect(new URL("/login?ended=1", req.url)));
}
