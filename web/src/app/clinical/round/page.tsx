import type { Metadata } from "next";
import { Round, type Care } from "./Round";

export const metadata: Metadata = { title: "Ward round & clinics" };

export default async function RoundPage(props: PageProps<"/clinical/round">) {
  const q = await props.searchParams;
  const care = (["ip", "op", "ed", "dc"].includes(String(q.care)) ? q.care : "ip") as Care;
  const centre = typeof q.centre === "string" && ["CHN", "BLR", "HYD"].includes(q.centre.toUpperCase()) ? q.centre.toUpperCase() : "all";
  return <Round care={care} centre={centre} />;
}
