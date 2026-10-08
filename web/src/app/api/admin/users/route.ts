import { adminRpc } from "@/lib/auth/admin";

export async function GET() {
  return adminRpc("app_admin_list_users");
}

/** Create (no id) or update a user. An empty password keeps the current one. */
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  return adminRpc("app_admin_save_user", {
    p_id: b.id || null, p_username: String(b.username ?? ""), p_display_name: String(b.display_name ?? ""),
    p_role: String(b.role ?? ""), p_active: b.active !== false, p_password: b.password ? String(b.password) : null,
  });
}
