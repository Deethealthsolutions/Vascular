import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Server-side Supabase client with the public key, for the app_* log-in functions; null if not configured. */
export function authDb(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  return createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
}
