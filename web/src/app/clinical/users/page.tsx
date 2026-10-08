import type { Metadata } from "next";
import { cookies } from "next/headers";
import { isAdmin } from "@/lib/auth/roles";
import { readSessionFull, SESSION_COOKIE } from "@/lib/auth/session";
import { sessionInfo } from "@/lib/auth/stats";
import { UsersAdmin } from "./UsersAdmin";

export const metadata: Metadata = { title: "Users" };

export default async function UsersPage() {
  const full = await readSessionFull((await cookies()).get(SESSION_COOKIE)?.value);
  const info = await sessionInfo(full?.token);
  const me = info.state === "ok" ? info.user : full?.account ?? null;
  // The database checks the admin role again on every action; this only decides what to show.
  return <UsersAdmin me={me} allowed={isAdmin(me)} setUp={info.state === "ok"} />;
}
