import type { Metadata } from "next";
import { Admit } from "./Admit";

export const metadata: Metadata = { title: "Admission" };

export default function AdmitPage() {
  return <Admit />;
}
