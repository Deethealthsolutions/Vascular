"use client";

// Users (Administration): admins list, add and edit log-in accounts. Everything goes through
// /api/admin/users, and the database re-checks on every call that the caller is an active admin.

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Top } from "@/components/cx/Shell";
import { Card, Denied, Kpis, Modal, Pill, toast } from "@/components/cx/ui";
import { ROLES, roleLabel, type RoleId } from "@/lib/auth/roles";
import type { Account } from "@/lib/auth/session";

type User = {
  id: string; username: string; display_name: string; role: string; active: boolean; locked: boolean; locked_until: string | null;
  last_login_at: string | null; created_at: string; updated_at: string; logins: number;
};
type Form = { id: string | null; username: string; display_name: string; role: RoleId | ""; active: boolean; password: string };

const ROLE_TONE: Record<string, string> = { admin: "r", director: "v", doctor: "b", nurse: "g", front_office: "a", research_scientist: "o", medical_records: "n" };
const when = (s: string | null) => (s ? new Date(s).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" }) : "Never");
const USERNAME = /^[a-z0-9][a-z0-9._-]{2,31}$/;

export function UsersAdmin({ me, allowed, setUp }: { me: Account | null; allowed: boolean; setUp: boolean }) {
  const router = useRouter();
  const [users, setUsers] = useState<User[] | null>(null);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [showInactive, setShowInactive] = useState(true);
  const [form, setForm] = useState<Form | null>(null);

  useEffect(() => {
    if (!allowed || !setUp) return;
    let live = true;
    fetch("/api/admin/users").then(async (r) => {
      const body = await r.json().catch(() => ({}));
      if (!live) return;
      if (!r.ok) { setError(body.error ?? "Could not load users."); setUsers([]); return; }
      setError(""); setUsers(body as User[]);
    }).catch(() => live && setError("Could not reach the server."));
    return () => { live = false; };
  }, [allowed, setUp, tick]);

  const shown = useMemo(() => (users ?? []).filter((u) =>
    (showInactive || u.active) && (!role || u.role === role)
    && (!q.trim() || `${u.display_name} ${u.username} ${roleLabel(u.role)}`.toLowerCase().includes(q.trim().toLowerCase()))), [users, q, role, showInactive]);

  if (!allowed) {
    return (
      <>
        <Top title="Users" sub="Administration · log-in accounts" />
        <div className="wrap"><Denied why="Only users with the Admin role can see and manage log-in accounts." /></div>
      </>
    );
  }

  const all = users ?? [];
  const reload = () => setTick((t) => t + 1);

  async function unlock(u: User) {
    const r = await fetch("/api/admin/users/unlock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: u.id }) });
    const b = await r.json().catch(() => ({}));
    if (!r.ok) return toast(b.error ?? "Could not unlock.");
    toast(`${u.display_name} unlocked.`);
    reload();
  }

  return (
    <>
      <Top title="Users" sub="Administration · who can log in, and with which role"
        right={<button className="btn p" onClick={() => setForm({ id: null, username: "", display_name: "", role: "", active: true, password: "" })} disabled={!setUp}>+ Add user</button>} />
      <div className="wrap">
        {!setUp && (
          <div className="disc" style={{ marginBottom: 14 }}>
            User management needs the latest database update (<code>20261009000000_app_user_admin.sql</code>) and a fresh log-in.
            Run it in the Supabase SQL editor, then log out and log in again.
          </div>
        )}

        <Kpis cols={4} items={[
          { k: "Users", v: all.length, d: `${all.filter((u) => u.active).length} active` },
          { k: "Admins", v: all.filter((u) => u.role === "admin" && u.active).length, d: "active, can manage users" },
          { k: "Never logged in", v: all.filter((u) => u.active && !u.last_login_at).length, d: "active accounts" },
          { k: "Locked", v: all.filter((u) => u.locked).length, d: "5 wrong passwords · 15 min", tone: all.some((u) => u.locked) ? "warn" : "" },
        ]} />

        <Card title="All users" hint="click a row to edit" className="mt14" bodyClass={null}
          right={<span className="pill n">{shown.length} shown</span>}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid var(--line)" }}>
            <input className="gsearch" style={{ flex: "1 1 260px", padding: "8px 11px" }} placeholder="Search name, username or role" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search users" />
            <select className="gsearch" style={{ padding: "8px 10px" }} value={role} onChange={(e) => setRole(e.target.value)} aria-label="Filter by role">
              <option value="">All roles</option>
              {ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
            <label className="sm" style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> Show inactive
            </label>
          </div>
          {error && <div className="deny" style={{ margin: 16 }}>{error}</div>}
          {users === null && setUp && !error ? <div className="card-b mut sm">Loading users…</div> : shown.length === 0 ? (
            <div className="card-b mut sm">{all.length ? "No users match." : setUp ? "No users yet." : "—"}</div>
          ) : (
            <div style={{ overflowX: "auto", padding: "0 16px 6px" }}>
              <table className="t">
                <thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Status</th><th>Last log-in</th><th style={{ textAlign: "right" }}>Log-ins</th><th /></tr></thead>
                <tbody>
                  {shown.map((u) => (
                    <tr key={u.id} style={{ cursor: "pointer", opacity: u.active ? 1 : 0.6 }}
                      onClick={() => setForm({ id: u.id, username: u.username, display_name: u.display_name, role: (ROLES.some((r) => r.id === u.role) ? u.role : "") as RoleId | "", active: u.active, password: "" })}>
                      <td><b>{u.display_name}</b>{u.id === me?.id && <span className="mut xs"> · you</span>}</td>
                      <td className="num">{u.username}</td>
                      <td><Pill c={ROLE_TONE[u.role] ?? "n"}>{roleLabel(u.role)}</Pill></td>
                      <td>
                        {!u.active ? <Pill c="n">Inactive</Pill> : u.locked ? <Pill c="a" title={`Locked until ${when(u.locked_until)}`}>Locked</Pill> : <Pill c="g">Active</Pill>}
                      </td>
                      <td className="sm">{when(u.last_login_at)}</td>
                      <td className="num" style={{ textAlign: "right" }}>{u.logins}</td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        {u.locked && <button className="btn sm" style={{ marginRight: 6 }} onClick={(e) => { e.stopPropagation(); void unlock(u); }}>Unlock</button>}
                        <button className="btn sm">Edit</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <p className="xs mut" style={{ marginTop: 10 }}>
          Accounts are never deleted, so the log-in history stays complete — mark someone <b>inactive</b> instead.
          Deactivating, resetting a password or changing a role ends that person&apos;s current sessions. Every change is recorded with who made it.
        </p>
      </div>

      {form && <UserForm form={form} me={me} onClose={() => setForm(null)}
        onSaved={(msg, self) => { setForm(null); toast(msg); reload(); if (self) router.refresh(); }} />}
    </>
  );
}

function UserForm({ form, me, onClose, onSaved }: { form: Form; me: Account | null; onClose: () => void; onSaved: (msg: string, self: boolean) => void }) {
  const [f, setF] = useState<Form>(form);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const isNew = !f.id;
  const self = !!f.id && f.id === me?.id;
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));

  const uname = f.username.trim().toLowerCase();
  const missing = [
    f.display_name.trim().length < 2 && "full name",
    !USERNAME.test(uname) && "username (3–32: letters, numbers, . - _)",
    !f.role && "role",
    isNew && f.password.length < 8 && "password (at least 8 characters)",
    !isNew && f.password.length > 0 && f.password.length < 8 && "new password of at least 8 characters",
  ].filter(Boolean) as string[];

  function generate() {
    const abc = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const r = crypto.getRandomValues(new Uint32Array(12));
    set("password", Array.from(r, (n) => abc[n % abc.length]).join(""));
    setShow(true);
  }

  async function save() {
    setBusy(true); setErr("");
    const r = await fetch("/api/admin/users", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: f.id, username: uname, display_name: f.display_name.trim(), role: f.role, active: f.active, password: f.password || null }),
    }).catch(() => null);
    const b = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    if (!r || !r.ok) return setErr(b.error ?? "Could not save.");
    onSaved(isNew ? `${f.display_name.trim()} added as ${roleLabel(f.role)}. Share the password with them securely.` : `${f.display_name.trim()} updated.`, self);
  }

  return (
    <Modal title={isNew ? "Add user" : `Edit ${form.display_name}`} onClose={onClose} width={520}>
      <div className="ob xw"><label>Full name<b className="rq"> *</b><span>shown in the sidebar and records</span></label>
        <input value={f.display_name} onChange={(e) => set("display_name", e.target.value)} aria-label="Full name" autoFocus placeholder="e.g. Sr. Anitha N." /></div>
      <div className="ob xw"><label>Username<b className="rq"> *</b><span>used to log in · lower case</span></label>
        <input value={f.username} onChange={(e) => set("username", e.target.value.toLowerCase().replace(/\s/g, ""))} aria-label="Username" autoCapitalize="none" spellCheck={false} placeholder="e.g. anitha.n" /></div>
      <div className="ob xw"><label>Role<b className="rq"> *</b>{self && <span>you cannot change your own role</span>}</label>
        <select value={f.role} onChange={(e) => set("role", e.target.value as RoleId)} aria-label="Role" disabled={self}>
          <option value="">Select…</option>
          {ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
        </select></div>
      <div className="ob xw"><label>{isNew ? "Password" : "New password"}{isNew && <b className="rq"> *</b>}<span>{isNew ? "at least 8 characters" : "leave blank to keep the current one"}</span></label>
        <div style={{ display: "flex", gap: 6 }}>
          <input type={show ? "text" : "password"} value={f.password} onChange={(e) => set("password", e.target.value)} aria-label="Password" autoComplete="new-password" style={{ flex: 1, minWidth: 0 }} />
          <button type="button" className="btn sm" onClick={() => setShow((v) => !v)}>{show ? "Hide" : "Show"}</button>
          <button type="button" className="btn sm" onClick={generate}>Generate</button>
        </div></div>
      {!isNew && (
        <div className="ob xw"><label>Status{self && <span>you cannot deactivate yourself</span>}</label>
          <select value={f.active ? "1" : "0"} onChange={(e) => set("active", e.target.value === "1")} aria-label="Status" disabled={self}>
            <option value="1">Active — can log in</option>
            <option value="0">Inactive — cannot log in</option>
          </select></div>
      )}
      {!isNew && (f.password || !f.active || f.role !== form.role) && !self && (
        <div className="disc" style={{ margin: "4px 0 10px" }}>Saving will log {form.display_name} out of any open sessions.</div>
      )}
      {err && <div className="deny" style={{ margin: "4px 0 10px" }}>{err}</div>}
      {missing.length > 0 && <div className="xs mut" style={{ margin: "4px 0 8px" }}>Still needed: {missing.join(", ")}.</div>}
      <button className="btn p" style={{ width: "100%", padding: 11 }} disabled={busy || missing.length > 0} onClick={save}>
        {busy ? "Saving…" : isNew ? "Create user" : "Save changes"}
      </button>
    </Modal>
  );
}
