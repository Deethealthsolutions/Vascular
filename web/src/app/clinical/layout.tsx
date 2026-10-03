import type { Metadata } from "next";
import { Shell } from "@/components/cx/Shell";
import "./clinical.css";

export const metadata: Metadata = { title: { default: "Clinical workspace", template: "%s | Clinical workspace" } };

export default function ClinicalLayout({ children }: LayoutProps<"/clinical">) {
  return (
    <div className="cx" style={{ flex: 1 }}>
      <Shell>{children}</Shell>
    </div>
  );
}
