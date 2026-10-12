import type { Metadata } from "next";
import { Top } from "@/components/cx/Shell";

export const metadata: Metadata = { title: "No screens assigned" };

export default function NoAccessPage() {
  return (
    <>
      <Top title="No screens assigned" sub="Your account does not have a role with workspace screens" />
      <div className="wrap">
        <div className="disc">
          Your log-in works, but your account&apos;s role does not give access to any screen yet.
          Ask an administrator to set your role on the <b>Users</b> screen (Front office, Nurse, Doctor, Research scientist, Director,
          Medical record executive or Admin), then log out and log in again.
        </div>
      </div>
    </>
  );
}
