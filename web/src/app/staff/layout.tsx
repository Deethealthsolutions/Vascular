import type { Metadata } from "next";
import { cookies } from "next/headers";
import { readSession, SESSION_COOKIE } from "@/lib/auth/session";
import { StaffTopBar } from "@/components/staff/StaffTopBar";

export const metadata: Metadata = { title: { default: "Staff workspace", template: "%s | Staff workspace" } };

export default async function StaffLayout({ children }: LayoutProps<"/staff">) {
  const account = await readSession((await cookies()).get(SESSION_COOKIE)?.value);
  return (
    <div className="flex min-h-full flex-1 flex-col bg-surface">
      <StaffTopBar account={account} />
      <main id="main" className="flex-1">{children}</main>
    </div>
  );
}
