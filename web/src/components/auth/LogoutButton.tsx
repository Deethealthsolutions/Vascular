"use client";

import { useRouter } from "next/navigation";
import { useState, type CSSProperties } from "react";

export function LogoutButton({ className, style }: { className?: string; style?: CSSProperties }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function logout() {
    setBusy(true);
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.replace("/login");
    router.refresh();
  }
  return (
    <button type="button" onClick={logout} disabled={busy} className={className} style={style}>
      {busy ? "Logging out…" : "Log out"}
    </button>
  );
}
