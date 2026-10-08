import { authDb } from "./db";
import type { Account } from "./session";

export type LoginStats = { users_logged_in: number; total_users: number; logins_total: number; logins_today: number };

/** Log-in counts from app_login_stats() (supabase/migrations/*_app_login_stats.sql); null if unavailable. */
export async function loginStats(): Promise<LoginStats | null> {
  const db = authDb();
  if (!db) return null;
  try {
    const { data, error } = await db.rpc("app_login_stats");
    return error || !data ? null : (data as LoginStats);
  } catch {
    return null;
  }
}

export type SessionInfo =
  | { state: "ok"; user: Account; stats: LoginStats }
  | { state: "ended" }
  | { state: "unavailable" };

/** Checks the database session behind the cookie: current name/role, or "ended" if it was
 *  revoked, expired or the user was deactivated. "unavailable" before the
 *  *_app_user_admin.sql migration is run (or if the database cannot be reached). */
export async function sessionInfo(token: string | null | undefined): Promise<SessionInfo> {
  const db = authDb();
  if (!db) return { state: "unavailable" };
  try {
    const { data, error } = await db.rpc("app_session", { p_token: token ?? "" });
    if (error || !data) return { state: "unavailable" };
    const r = data as { ok: boolean; user?: Account; stats?: LoginStats };
    return r.ok && r.user && r.stats ? { state: "ok", user: r.user, stats: r.stats } : { state: "ended" };
  } catch {
    return { state: "unavailable" };
  }
}
