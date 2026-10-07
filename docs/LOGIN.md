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
- **Hidden table:** the `app_users` table can't be read with the public key; it has row-level security and no grants. Accounts can only be created or reset from the Supabase SQL editor.

**Demo role picker:** the sidebar's **Acting as (demo role)** selector is separate from the log-in. It lets one logged-in person view the screens as any staff role. Linking each account to its own role is the next step.

## Setup

1. **Supabase → SQL editor:** run `supabase/migrations/20261007000000_app_users.sql`.
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
