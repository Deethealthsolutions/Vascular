import type { Metadata } from "next";
import { ResearchDocs } from "./ResearchDocs";

export const metadata: Metadata = { title: "Research documents" };

export default function ResearchDocsPage() {
  return <ResearchDocs />;
}
