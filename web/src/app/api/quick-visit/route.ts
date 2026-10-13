import { tokenRpc } from "@/lib/auth/admin";

// Quick visit (supabase/migrations/*_quick_visits.sql). The database checks the log-in session
// and role on every call.
const opts = {
  denied: "Your role cannot use Quick visit.",
  setup: "Quick visit is not set up in the database yet (run the quick_visits migration).",
};

/** ?q=… search patients · ?patient=<id> one patient with visits · ?recent=<days>&location=… recent visits */
export async function GET(req: Request) {
  const u = new URL(req.url);
  if (u.searchParams.has("patient")) return tokenRpc("qv_patient", { p_id: u.searchParams.get("patient") }, opts);
  if (u.searchParams.has("recent")) {
    return tokenRpc("qv_recent", { p_location: u.searchParams.get("location") ?? "", p_days: Number(u.searchParams.get("recent")) || 1 }, opts);
  }
  return tokenRpc("qv_search", { p_q: u.searchParams.get("q") ?? "" }, opts);
}

/** Save: { patient, visit } — creates or updates the patient, then creates or updates the visit. */
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  return tokenRpc("qv_save", { p_patient: b.patient ?? {}, p_visit: b.visit ?? {} }, opts);
}
