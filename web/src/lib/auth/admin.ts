import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { authDb } from "./db";
import { readSessionFull, SESSION_COOKIE } from "./session";

type Msgs = { denied: string; setup: string };

/** Calls a database function with the caller's session token (`p_token`). The database decides
 *  whether this person may do it. Returns the data, or a ready-made HTTP error response. */
export async function sessionRpc(fn: string, args: Record<string, unknown>, opts: Msgs): Promise<{ data: unknown } | { res: NextResponse }> {
  const db = authDb();
  if (!db) return { res: NextResponse.json({ error: "The database is not configured." }, { status: 503 }) };
  const full = await readSessionFull((await cookies()).get(SESSION_COOKIE)?.value);
  if (!full) return { res: NextResponse.json({ error: "Please log in again." }, { status: 401 }) };
  if (!full.token) return { res: NextResponse.json({ error: "Please log out and log in again." }, { status: 401 }) };
  const { data, error } = await db.rpc(fn, { p_token: full.token, ...args });
  if (error) {
    if (error.code === "42501") return { res: NextResponse.json({ error: opts.denied }, { status: 403 }) };
    if (error.code === "PGRST202") return { res: NextResponse.json({ error: opts.setup }, { status: 503 }) };
    return { res: NextResponse.json({ error: error.message }, { status: 400 }) };
  }
  return { data };
}

/** sessionRpc, answered as JSON. */
export async function tokenRpc(fn: string, args: Record<string, unknown>, opts: Msgs) {
  const r = await sessionRpc(fn, args, opts);
  return "res" in r ? r.res : NextResponse.json(r.data ?? { ok: true });
}

/** app_admin_* functions (Users screen). */
export const adminRpc = (fn: string, args: Record<string, unknown> = {}) =>
  tokenRpc(fn, args, {
    denied: "Only an active Admin can manage users.",
    setup: "User management is not set up in the database yet (run the app_user_admin migration).",
  });
