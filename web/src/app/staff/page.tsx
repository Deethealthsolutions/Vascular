import type { Metadata } from "next";
import { ClinicBoard } from "./ClinicBoard";

export const metadata: Metadata = { title: "Clinic board" };

export default function StaffHome() {
  return <ClinicBoard />;
}
