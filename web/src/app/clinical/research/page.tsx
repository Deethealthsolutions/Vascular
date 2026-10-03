import type { Metadata } from "next";
import { Research } from "./Research";

export const metadata: Metadata = { title: "Research workspace" };

export default async function ResearchPage(props: PageProps<"/clinical/research">) {
  const q = await props.searchParams;
  return <Research study={typeof q.study === "string" ? q.study : "HBOT-DFU-2026"} />;
}
