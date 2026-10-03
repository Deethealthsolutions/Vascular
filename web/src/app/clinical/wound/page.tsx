import type { Metadata } from "next";
import { Wound } from "./Wound";

export const metadata: Metadata = { title: "Wound & HBOT" };

export default async function WoundPage(props: PageProps<"/clinical/wound">) {
  const q = await props.searchParams;
  return <Wound wid={typeof q.wid === "string" ? q.wid : "W-2201"} />;
}
