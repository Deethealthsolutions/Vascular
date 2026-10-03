import type { Metadata } from "next";
import { Nurse } from "./Nurse";

export const metadata: Metadata = { title: "Nurse observation entry" };

export default async function NursePage(props: PageProps<"/clinical/nurse">) {
  const q = await props.searchParams;
  return <Nurse pid={typeof q.pid === "string" ? q.pid : "P-4412"} />;
}
