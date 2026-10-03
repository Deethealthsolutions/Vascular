import type { Metadata } from "next";
import { ReferralDetail } from "./ReferralDetail";

export async function generateMetadata(props: PageProps<"/portal/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  return { title: `Referral ${id}` };
}

export default async function ReferralPage(props: PageProps<"/portal/[id]">) {
  const { id } = await props.params;
  return <ReferralDetail id={id} />;
}
