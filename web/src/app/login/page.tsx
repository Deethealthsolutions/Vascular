import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { readSession, safeNext, SESSION_COOKIE } from "@/lib/auth/session";
import { site } from "@/lib/site";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Staff log-in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = safeNext(typeof sp.next === "string" ? sp.next : null);
  if (await readSession((await cookies()).get(SESSION_COOKIE)?.value)) redirect(next);

  return (
    <main id="main" className="flex flex-1 items-center justify-center bg-[radial-gradient(ellipse_at_top,#0e6f88_0%,#07404f_55%,#05303b_100%)] px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-3 text-white">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/15 text-xl font-bold ring-1 ring-white/25">V</span>
          <div>
            <div className="text-lg font-semibold leading-tight">Vascular &amp; Diabetic Foot</div>
            <div className="text-sm text-white/70">{site.name} · Staff workspace</div>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-7 shadow-2xl shadow-black/30">
          <h1 className="text-xl font-semibold text-ink">Log in</h1>
          <p className="mt-1 text-sm text-muted">Use the username and password the hospital gave you.</p>
          {sp.ended && <p className="mt-3 rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">Your session has ended — your account was changed by an administrator. Please log in again.</p>}
          <LoginForm next={next} />
        </div>

        <p className="mt-6 text-center text-xs text-white/60">
          5 wrong passwords lock the account for 15 minutes.<br />
          <Link href="/" className="underline hover:text-white">Back to the public site</Link>
        </p>
      </div>
    </main>
  );
}
