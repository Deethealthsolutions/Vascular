import type { Metadata } from "next";
import { Visit } from "./Visit";

export const metadata: Metadata = { title: "Visit analysis" };

export default async function VisitPage(props: PageProps<"/clinical/visit">) {
  const q = await props.searchParams;
  return <Visit pid={typeof q.pid === "string" ? q.pid : "P-4412"} />;
}
