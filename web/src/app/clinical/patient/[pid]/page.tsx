import type { Metadata } from "next";
import { Chart } from "./Chart";

export const metadata: Metadata = { title: "Patient chart" };

export default async function PatientPage(props: PageProps<"/clinical/patient/[pid]">) {
  const { pid } = await props.params;
  const q = await props.searchParams;
  const range = [24, 48, 72].includes(Number(q.range)) ? Number(q.range) : 72;
  const zoom = typeof q.zoom === "string" ? q.zoom : null;
  const zwin = [6, 12, 24].includes(Number(q.zwin)) ? Number(q.zwin) : null;
  return <Chart pid={pid} range={range} zoom={zoom} zwin={zwin} />;
}
