import type { Metadata } from "next";
import { cookies } from "next/headers";
import { readSession, SESSION_COOKIE } from "@/lib/auth/session";
import { Shell } from "@/components/cx/Shell";
import "./clinical.css";

export const metadata: Metadata = { title: { default: "Clinical workspace", template: "%s | Clinical workspace" } };

export default async function ClinicalLayout({ children }: LayoutProps<"/clinical">) {
  // The proxy (src/proxy.ts) has already turned away anyone not logged in.
  const account = await readSession((await cookies()).get(SESSION_COOKIE)?.value);
  return (
    <div className="cx" style={{ flex: 1 }}>
      <Shell account={account}>{children}</Shell>
    </div>
  );
}
