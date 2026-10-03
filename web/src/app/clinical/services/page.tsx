import type { Metadata } from "next";
import { Services } from "./Services";

export const metadata: Metadata = { title: "Tests & procedures" };

export default function ServicesPage() {
  return <Services />;
}
