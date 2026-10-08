import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { readSessionFull, SESSION_COOKIE } from "@/lib/auth/session";
import { loginStats, sessionInfo } from "@/lib/auth/stats";
import { Shell } from "@/components/cx/Shell";
import "./clinical.css";

export const metadata: Metadata = { title: { default: "Clinical workspace", template: "%s | Clinical workspace" } };

export default async function ClinicalLayout({ children }: LayoutProps<"/clinical">) {
  // The proxy (src/proxy.ts) has already turned away anyone without a valid cookie. Here the
  // database confirms the session is still live (not ended by an admin) and gives the current role.
  const full = await readSessionFull((await cookies()).get(SESSION_COOKIE)?.value);
  const info = await sessionInfo(full?.token);
  if (info.state === "ended") redirect("/api/auth/logout");
  const account = info.state === "ok" ? info.user : full?.account ?? null;
  const stats = info.state === "ok" ? info.stats : await loginStats();
  return (
    <div className="cx" style={{ flex: 1 }}>
      <Shell account={account} loginStats={stats}>{children}</Shell>
    </div>
  );
}
