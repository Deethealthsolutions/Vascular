import type { Metadata } from "next";
import { StaffTopBar } from "@/components/staff/StaffTopBar";

export const metadata: Metadata = { title: { default: "Staff workspace", template: "%s | Staff workspace" } };

export default function StaffLayout({ children }: LayoutProps<"/staff">) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-surface">
      <StaffTopBar />
      <main id="main" className="flex-1">{children}</main>
    </div>
  );
}
