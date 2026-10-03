import type { Metadata } from "next";
import { Consult } from "./Consult";

export const metadata: Metadata = { title: "Doctor consultation" };

export default function ConsultPage() {
  return <Consult />;
}
