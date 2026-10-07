"use client";

import { useState, type FormEvent } from "react";

export function LoginForm({ next }: { next: string }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "Log-in failed.");
        setBusy(false);
        return;
      }
      // Full navigation so the protected pages load with the new cookie.
      window.location.assign(next);
    } catch {
      setError("Could not reach the server. Check your connection.");
      setBusy(false);
    }
  }

  const field = "mt-1 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20";

  return (
    <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
      <div>
        <label htmlFor="username" className="text-sm font-medium text-ink">Username</label>
        <input id="username" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} autoFocus required
          value={username} onChange={(e) => setUsername(e.target.value)} className={field} />
      </div>
      <div>
        <label htmlFor="password" className="text-sm font-medium text-ink">Password</label>
        <div className="relative">
          <input id="password" name="password" type={show ? "text" : "password"} autoComplete="current-password" required
            value={password} onChange={(e) => setPassword(e.target.value)} className={`${field} pr-16`} />
          <button type="button" onClick={() => setShow((v) => !v)} aria-pressed={show}
            className="absolute right-2 top-1/2 mt-0.5 -translate-y-1/2 rounded px-2 py-1 text-xs font-medium text-brand hover:bg-brand-soft">
            {show ? "Hide" : "Show"}
          </button>
        </div>
      </div>

      {error && <p role="alert" className="rounded-lg bg-alert-soft px-3 py-2 text-sm text-alert">{error}</p>}

      <button type="submit" disabled={busy || !username.trim() || !password}
        className="w-full rounded-lg bg-brand px-4 py-2.5 font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60">
        {busy ? "Checking…" : "Log in"}
      </button>
    </form>
  );
}
