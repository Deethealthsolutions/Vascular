// Log-in session: a signed cookie holding who logged in and when it expires.
// Signed with HMAC-SHA256 using AUTH_SECRET (server-only env var), so it cannot be forged or edited
// in the browser. Web Crypto only, so it works in the proxy and in route handlers alike.

export const SESSION_COOKIE = "vc_session";
export const SESSION_HOURS = 12;

export type Account = { id: string; username: string; display_name: string; role: string };
/** `t` is the database session token (app_sessions); it never leaves the server or the HttpOnly cookie. */
type Payload = Account & { exp: number; t?: string };

const enc = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function unb64url(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

/** The signing key, or null when AUTH_SECRET is missing or too short (log-in is then refused). */
async function key(): Promise<CryptoKey | null> {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) return null;
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export const authConfigured = () => (process.env.AUTH_SECRET?.length ?? 0) >= 32;

export async function signSession(account: Account, token?: string): Promise<string> {
  const k = await key();
  if (!k) throw new Error("AUTH_SECRET is not set (needs at least 32 characters).");
  const payload: Payload = { id: account.id, username: account.username, display_name: account.display_name, role: account.role, exp: Date.now() + SESSION_HOURS * 3600_000, ...(token ? { t: token } : {}) };
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(body)));
  return `${body}.${b64url(sig)}`;
}

/** Account and database session token from a cookie, or null if it is missing, tampered with or expired. Server only. */
export async function readSessionFull(cookie: string | undefined): Promise<{ account: Account; token: string | null } | null> {
  if (!cookie) return null;
  const k = await key();
  if (!k) return null;
  const [body, sig] = cookie.split(".");
  if (!body || !sig) return null;
  try {
    const ok = await crypto.subtle.verify("HMAC", k, unb64url(sig) as BufferSource, enc.encode(body));
    if (!ok) return null;
    const p = JSON.parse(new TextDecoder().decode(unb64url(body))) as Payload;
    if (typeof p.exp !== "number" || p.exp < Date.now()) return null;
    return { account: { id: p.id, username: p.username, display_name: p.display_name, role: p.role }, token: p.t ?? null };
  } catch {
    return null;
  }
}

/** The account in a session cookie (without the token, so it is safe to pass to client components). */
export async function readSession(cookie: string | undefined): Promise<Account | null> {
  return (await readSessionFull(cookie))?.account ?? null;
}

/** Only same-site paths are allowed as the post-log-in destination (no open redirects). */
export function safeNext(next: string | null | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/clinical/flow";
}
