import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { authDb } from "./db";
import { readSessionFull, SESSION_COOKIE } from "./session";

/** Calls an app_admin_* database function with the caller's session token. The database
 *  decides whether the caller is an active admin; this only turns its answer into HTTP. */
export async function adminRpc(fn: string, args: Record<string, unknown> = {}) {
  const db = authDb();
  if (!db) return NextResponse.json({ error: "The user database is not configured." }, { status: 503 });
  const full = await readSessionFull((await cookies()).get(SESSION_COOKIE)?.value);
  if (!full) return NextResponse.json({ error: "Please log in again." }, { status: 401 });
  if (!full.token) return NextResponse.json({ error: "Please log out and log in again to manage users." }, { status: 401 });
  const { data, error } = await db.rpc(fn, { p_token: full.token, ...args });
  if (error) {
    if (error.code === "42501") return NextResponse.json({ error: "Only an active Admin can manage users." }, { status: 403 });
    if (error.code === "PGRST202") return NextResponse.json({ error: "User management is not set up in the database yet (run the app_user_admin migration)." }, { status: 503 });
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json(data ?? { ok: true });
}
