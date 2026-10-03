import type { Metadata } from "next";
import { VisitChart, type Tab } from "./VisitChart";

export const metadata: Metadata = { title: "Visit" };

const tabs: Tab[] = ["summary", "triage", "wounds", "provider", "lab", "checkout"];

export default async function VisitPage(props: PageProps<"/staff/visit/[id]">) {
  const { id } = await props.params;
  const { tab } = await props.searchParams;
  return <VisitChart id={id} initialTab={tabs.find((t) => t === tab) ?? "summary"} />;
}
