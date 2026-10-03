import type { Metadata } from "next";
import { Overview } from "./Overview";

export const metadata: Metadata = { title: "Network overview" };

export default async function OverviewPage(props: PageProps<"/clinical">) {
  const q = await props.searchParams;
  const site = typeof q.site === "string" ? q.site.toUpperCase() : "ALL";
  const days = [7, 30, 90].includes(Number(q.days)) ? Number(q.days) : 30;
  const unit = q.unit === "icu" || q.unit === "ward" ? q.unit : "all";
  return <Overview site={site} days={days} unit={unit} />;
}
