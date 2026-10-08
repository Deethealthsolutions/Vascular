import { adminRpc } from "@/lib/auth/admin";

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  return adminRpc("app_admin_unlock", { p_id: String(b.id ?? "") });
}
