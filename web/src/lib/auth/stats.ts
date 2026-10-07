import { createClient } from "@supabase/supabase-js";

export type LoginStats = { users_logged_in: number; total_users: number; logins_total: number; logins_today: number };

/** Log-in counts from app_login_stats() (supabase/migrations/*_app_login_stats.sql); null if unavailable. */
export async function loginStats(): Promise<LoginStats | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  try {
    const db = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await db.rpc("app_login_stats");
    if (error || !data) return null;
    return data as LoginStats;
  } catch {
    return null;
  }
}
