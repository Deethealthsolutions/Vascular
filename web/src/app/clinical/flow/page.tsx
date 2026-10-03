import type { Metadata } from "next";
import { Flow } from "./Flow";

export const metadata: Metadata = { title: "Today's patient flow" };

export default function FlowPage() {
  return <Flow />;
}
