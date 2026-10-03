import type { Metadata } from "next";
import { BookingWizard, type VisitType } from "./BookingWizard";

export const metadata: Metadata = { title: "Book a visit" };

const visitTypes: VisitType[] = ["wound", "vascular", "hbot", "diabetic-foot"];

export default async function BookPage(props: PageProps<"/book">) {
  const { visit } = await props.searchParams;
  const initial = visitTypes.find((v) => v === visit);
  return (
    <div className="container-page max-w-3xl py-12">
      <p className="eyebrow">New patient</p>
      <h1 className="mt-2 text-3xl font-bold text-brand-dark">Book a visit</h1>
      <p className="mt-3 text-muted">
        Takes about 5 minutes. Filling out your intake now means less paperwork on the day.
      </p>
      <BookingWizard initialVisit={initial} />
    </div>
  );
}
