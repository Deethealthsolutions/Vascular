import { NextResponse } from "next/server";
import { authDb } from "@/lib/auth/db";
import { authConfigured, SESSION_COOKIE, SESSION_HOURS, signSession, type Account } from "@/lib/auth/session";

// Checks the username and password with the database's app_login() function
// (supabase/migrations/*_app_users.sql) and, if they match, sets the signed session cookie.

export async function POST(req: Request) {
  const db = authDb();
  if (!db || !authConfigured()) {
    return NextResponse.json({ error: "Log-in is not set up on this server (Supabase keys or AUTH_SECRET missing)." }, { status: 503 });
  }

  let username = "", password = "";
  try {
    const b = await req.json();
    username = String(b.username ?? "").trim();
    password = String(b.password ?? "");
  } catch { /* fall through to the empty-field check */ }
  if (!username || !password) return NextResponse.json({ error: "Enter your username and password." }, { status: 400 });

  const { data, error } = await db.rpc("app_login", { p_username: username, p_password: password });
  if (error) {
    console.error("app_login failed:", error.message);
    return NextResponse.json({ error: "Could not reach the user database. Try again in a moment." }, { status: 502 });
  }

  const r = data as { ok: boolean; error?: string; locked_until?: string; user?: Account; token?: string };
  if (!r?.ok || !r.user) {
    if (r?.error === "locked") {
      const until = r.locked_until ? new Date(r.locked_until).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" }) : "later";
      return NextResponse.json({ error: `Too many wrong passwords. This account is locked until ${until}.` }, { status: 423 });
    }
    return NextResponse.json({ error: "Wrong username or password." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true, user: { username: r.user.username, display_name: r.user.display_name } });
  res.cookies.set(SESSION_COOKIE, await signSession(r.user, r.token), {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: SESSION_HOURS * 3600,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
