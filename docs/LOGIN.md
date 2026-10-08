# Staff log-in

**Screen:** `/login`
**Protected:** everything under `/clinical` and `/staff`. The public site (`/`, conditions, treatments, booking, referral) stays open.

**Code:**
- Page: `web/src/app/login/`
- Check: `web/src/app/api/auth/login/route.ts`, `logout/route.ts`
- Guard: `web/src/proxy.ts`
- Session: `web/src/lib/auth/session.ts`

**Database:** `supabase/migrations/20261007000000_app_users.sql`

## How it works

1. The user enters a username and password on `/login`.
2. The server calls the database function **`app_login()`**. It compares the password with the stored **bcrypt hash** and returns the user's name and role, never the hash.
3. If the password matches, the server sets a **signed session cookie** (`vc_session`) for **12 hours**:
   - `HttpOnly`, so page scripts can't read it
   - signed with `AUTH_SECRET`, so it can't be edited or forged
4. Before any `/clinical` or `/staff` page loads, `proxy.ts` checks the cookie. Without a valid one it redirects to `/login`, then back to the requested page after log-in.
5. **Log out** (sidebar, or the staff top bar) clears the cookie.

**Protections**
- **Lock-out:** 5 wrong passwords in a row lock the account for 15 minutes.
- **Same answer for every failure:** unknown usernames, wrong passwords and inactive accounts all get "Wrong username or password", and take the same time to answer.
- **Hidden table:** the `app_users` table can't be read with the public key; it has row-level security and no grants. Accounts are managed on the **Users** screen (admins only) or from the Supabase SQL editor.
- **Database sessions:** each log-in also gets a random session token (only its SHA-256 is stored, in `app_sessions`). The workspace checks it on every full page load, so a session ended by an admin stops working straight away.

**Demo role picker:** the sidebar's **Acting as (demo role)** selector is separate from the log-in. It lets one logged-in person view the screens as any staff role. Linking each account to its own role is the next step.

## Users screen (Admin only)

**Where:** sidebar → **Administration → Users** (`/clinical/users`). The link appears only for accounts with the **Admin** role. Anyone else who opens the address sees "access denied".

**What an admin can do:**
- **List everyone:** name, username, role, status (active / inactive / locked), last log-in and number of log-ins. Search by name, filter by role, hide inactive accounts.
- **Add a user:** full name, username (lower case; letters, numbers, `.` `-` `_`), role, and a password of at least 8 characters. **Generate** makes a random 12-character password to hand over securely.
- **Edit a user:** change the name, username or role, set a new password (leave blank to keep the current one), or mark them inactive.
- **Unlock** an account locked after 5 wrong passwords.

**Roles:**

| Role | Stored as |
|---|---|
| Front office | `front_office` |
| Nurse | `nurse` |
| Doctor | `doctor` |
| Research scientist | `research_scientist` |
| Director | `director` |
| Medical record executive | `medical_records` |
| Admin | `admin` |

**Safety rules (enforced by the database):**
- **Admins only:** every list, save and unlock passes the caller's session token. The database checks it belongs to an **active Admin**, so the public key alone can't read or change accounts.
- **No self-lockout:** an admin can't remove their own Admin role or deactivate themselves.
- **No deletion:** accounts are never deleted, so the log-in history stays complete. Mark them inactive instead.
- **Sessions end on change:** deactivating someone, resetting their password or changing their role ends their open sessions. Next time they load a page they go to the log-in screen with "Your session has ended".
- **Change log:** every change is recorded in `app_user_changes` (who, which account, what changed), never the password.

**What a role controls today:** the Users screen. The clinical screens still follow the **Acting as (demo role)** picker; linking each log-in role to the screens it may use is the next step.

**Who changed what** (SQL editor):
```sql
select at, actor, username, action, detail from public.app_user_changes order by at desc;
```

## Log-in counts

**Where:** the sidebar shows a label under the logged-in user, for example **3/5 users logged in · 42 log-ins · 6 today**.

**What counts:**
- **Users logged in:** active users who have logged in at least once, out of all active users.
- **Log-ins:** every successful log-in. Wrong passwords and locked accounts don't count.
- **Today:** India time.

**How it works:**
- Each successful log-in adds a row to `app_login_events` (migration `20261008000000_app_login_stats.sql`).
- `app_login_stats()` returns the counts only, with no names, so it is safe to call with the public key. The events table itself can't be read with that key.
- Users who logged in before the migration count once, at their last log-in.
- If the migration hasn't been run, the label is simply hidden.

**Who logged in, and when** (SQL editor):
```sql
select u.username, u.display_name, count(*) as logins, max(e.at) as last_login
from public.app_login_events e join public.app_users u on u.id = e.user_id
group by u.username, u.display_name order by last_login desc;
```

## Setup

1. **Supabase → SQL editor:** run, in order, `20261007000000_app_users.sql`, `20261008000000_app_login_stats.sql` and `20261009000000_app_user_admin.sql` from `supabase/migrations/`. After the last one, everyone logs in once more.
2. **Create the first account.** Also in the SQL editor:
   ```sql
   select public.app_create_user('admin', 'Administrator', 'admin', '<password>');
   ```
   The password is not in the repository, because the repository is public.
3. **Set `AUTH_SECRET`**, a random string of 32+ characters, in `web/.env.local` and in Hostinger's environment variables. Generate one with:
   ```
   node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
   ```
   Changing it logs everyone out.

Without `AUTH_SECRET` or the Supabase keys, log-in is refused with a message saying so.

## Managing accounts (SQL editor)

```sql
-- new account
select public.app_create_user('nurse.anitha', 'Anitha N.', 'nurse', 'temporary-pass');

-- reset a password (also unlocks)
select public.app_set_password('admin', 'new-password');

-- disable / re-enable
update public.app_users set active = false where username = 'nurse.anitha';

-- unlock without changing the password
update public.app_users set locked_until = null, failed_attempts = 0 where username = 'admin';

-- who is there, last log-in
select username, display_name, role, active, last_login_at, locked_until from public.app_users order by username;
```

**Usernames** are stored in lower case and matched case-insensitively. **Passwords** are case-sensitive and must be at least 6 characters.

## Limitations

- **Research register data is still open:** the log-in protects the pages, but the research register's Supabase tables still use the **demo access rules**, so someone holding the public key could reach that data directly. The next step is moving to role-based rules tied to these accounts.
- **No self-service:** there is no in-app "change password" or "forgot password" yet.
- **Offline export:** the single-file HTML export has no server, so it has no log-in.
