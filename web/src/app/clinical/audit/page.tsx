import type { Metadata } from "next";
import { Audit } from "./Audit";

export const metadata: Metadata = { title: "Access audit" };

export default async function AuditPage(props: PageProps<"/clinical/audit">) {
  const q = await props.searchParams;
  return <Audit subject={typeof q.subject === "string" ? q.subject : ""} />;
}
