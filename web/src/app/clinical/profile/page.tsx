import type { Metadata } from "next";
import { ProfileMaster } from "./ProfileMaster";

export const metadata: Metadata = { title: "Patient master" };

export default async function ProfilePage(props: PageProps<"/clinical/profile">) {
  const q = await props.searchParams;
  const centre = typeof q.centre === "string" && ["CHN", "BLR", "HYD"].includes(q.centre.toUpperCase()) ? q.centre.toUpperCase() : "all";
  return <ProfileMaster centre={centre} />;
}
