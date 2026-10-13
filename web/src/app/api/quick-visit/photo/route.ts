import { NextResponse } from "next/server";
import { sessionRpc, tokenRpc } from "@/lib/auth/admin";

// Quick visit wound photos (supabase/migrations/*_quick_visit_photos.sql). Every call is
// checked by the database against the log-in session and role.
const opts = {
  denied: "Your role cannot use Quick visit photos.",
  setup: "Wound photos are not set up in the database yet (run the quick_visit_photos migration).",
};

/** ?id=<photo> → the image itself (for <img src>) · ?patient=<id> → photo list (no image data) */
export async function GET(req: Request) {
  const u = new URL(req.url);
  if (u.searchParams.has("patient")) return tokenRpc("qv_photo_list", { p_patient_id: u.searchParams.get("patient") }, opts);
  const r = await sessionRpc("qv_photo", { p_id: u.searchParams.get("id") }, opts);
  if ("res" in r) return r.res;
  const p = r.data as { mime: string; image: string; sha256: string } | null;
  if (!p) return NextResponse.json({ error: "Photo not found." }, { status: 404 });
  return new Response(Buffer.from(p.image, "base64"), {
    headers: { "Content-Type": p.mime, "Cache-Control": "private, max-age=3600", ETag: `"${p.sha256}"`, "X-Content-Type-Options": "nosniff" },
  });
}

/** Add a photo to a saved visit: { visit_id, image: "data:image/jpeg;base64,…", label, note, has_scale, consent, width, height } */
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(String(b.image ?? ""));
  if (!m) return NextResponse.json({ error: "Send the photo as a JPEG, PNG or WebP image." }, { status: 400 });
  return tokenRpc("qv_add_photo", {
    p_visit_id: b.visit_id, p_image: m[2],
    p_meta: { mime: m[1], label: b.label ?? "", note: b.note ?? "", has_scale: !!b.has_scale, consent: b.consent ?? "Care only", width: b.width ?? null, height: b.height ?? null },
  }, opts);
}

/** Remove a photo from the record (kept for audit): ?id=<photo>&reason=… */
export async function DELETE(req: Request) {
  const u = new URL(req.url);
  return tokenRpc("qv_remove_photo", { p_id: u.searchParams.get("id"), p_reason: u.searchParams.get("reason") ?? "" }, opts);
}
