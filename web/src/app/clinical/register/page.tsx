import type { Metadata } from "next";
import { Register } from "./Register";

export const metadata: Metadata = { title: "Registration" };

export default function RegisterPage() {
  return <Register />;
}
