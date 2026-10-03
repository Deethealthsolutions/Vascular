import type { Metadata } from "next";
import { Graph } from "./Graph";

export const metadata: Metadata = { title: "Knowledge graph" };

export default function GraphPage() {
  return <Graph />;
}
