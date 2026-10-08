-- User administration (Users screen, Admin role only) and database-checked sessions.
-- Run after 20261008000000_app_login_stats.sql.
--
-- Sessions: app_login() now also issues a random session token (only its SHA-256 is stored).
-- The app keeps the token inside its signed, HttpOnly cookie. Every admin action passes the
-- token, and the database checks it belongs to an unexpired, unrevoked session of an ACTIVE
-- user with role 'admin' — so the public key alone cannot list, create or change users.
-- Deactivating a user or resetting their password ends their sessions.

-- ------------------------------------------------------------------ roles

-- Existing rows keep their role (NOT VALID); every new or changed row must use one of these.
alter table public.app_users drop constraint if exists app_users_role_check;
alter table public.app_users add constraint app_users_role_check
  check (role in ('front_office', 'nurse', 'doctor', 'research_scientist', 'director', 'medical_records', 'admin')) not valid;

-- ------------------------------------------------------------------ sessions

create table if not exists public.app_sessions (
  id          uuid primary key default gen_random_uuid(),
  token_hash  text not null unique,
  user_id     uuid not null references public.app_users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  revoked_at  timestamptz
);
create index if not exists app_sessions_user on public.app_sessions (user_id);
alter table public.app_sessions enable row level security;
revoke all on public.app_sessions from anon, authenticated;

-- Who changed which account, and how (never the password itself).
create table if not exists public.app_user_changes (
  id        bigint generated always as identity primary key,
  at        timestamptz not null default now(),
  actor     text not null,
  username  text not null,
  action    text not null,
  detail    text
);
alter table public.app_user_changes enable row level security;
revoke all on public.app_user_changes from anon, authenticated;

-- Internal: the active user behind a session token, or no row. Not callable with the public key.
create or replace function public.app_session_user(p_token text)
returns public.app_users
language sql
stable
security definer
set search_path = public, extensions
as $$
  select u.* from public.app_sessions s join public.app_users u on u.id = s.user_id
  where s.token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex')
    and s.revoked_at is null and s.expires_at > now() and u.active;
$$;
revoke all on function public.app_session_user(text) from public, anon, authenticated;

-- ------------------------------------------------------------------ log in (now issues a token)

create or replace function public.app_login(p_username text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  u public.app_users;
  max_attempts constant int := 5;
  lock_for constant interval := interval '15 minutes';
  tok text;
begin
  select * into u from public.app_users where username = lower(btrim(p_username));

  if not found or not u.active then
    perform crypt(coalesce(p_password, ''), gen_salt('bf', 10));
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;

  if u.locked_until is not null and u.locked_until > now() then
    return jsonb_build_object('ok', false, 'error', 'locked', 'locked_until', u.locked_until);
  end if;

  if u.password_hash <> crypt(coalesce(p_password, ''), u.password_hash) then
    update public.app_users
       set failed_attempts = case when u.failed_attempts + 1 >= max_attempts then 0 else u.failed_attempts + 1 end,
           locked_until    = case when u.failed_attempts + 1 >= max_attempts then now() + lock_for else null end,
           updated_at      = now()
     where id = u.id;
    return case when u.failed_attempts + 1 >= max_attempts
      then jsonb_build_object('ok', false, 'error', 'locked', 'locked_until', now() + lock_for)
      else jsonb_build_object('ok', false, 'error', 'invalid') end;
  end if;

  update public.app_users
     set failed_attempts = 0, locked_until = null, last_login_at = now(), updated_at = now()
   where id = u.id;
  insert into public.app_login_events (user_id) values (u.id);

  tok := encode(gen_random_bytes(32), 'hex');
  insert into public.app_sessions (token_hash, user_id, expires_at)
  values (encode(digest(tok, 'sha256'), 'hex'), u.id, now() + interval '12 hours');
  delete from public.app_sessions where expires_at < now() - interval '30 days';

  return jsonb_build_object('ok', true, 'token', tok, 'user',
    jsonb_build_object('id', u.id, 'username', u.username, 'display_name', u.display_name, 'role', u.role));
end;
$$;
revoke all on function public.app_login(text, text) from public;
grant execute on function public.app_login(text, text) to anon, authenticated;

-- Current user (fresh name and role) plus the log-in counts; ok=false if the session has ended.
create or replace function public.app_session(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare u public.app_users;
begin
  u := public.app_session_user(p_token);
  if u.id is null then return jsonb_build_object('ok', false); end if;
  return jsonb_build_object('ok', true,
    'user', jsonb_build_object('id', u.id, 'username', u.username, 'display_name', u.display_name, 'role', u.role),
    'stats', public.app_login_stats());
end;
$$;
revoke all on function public.app_session(text) from public;
grant execute on function public.app_session(text) to anon, authenticated;

create or replace function public.app_logout(p_token text)
returns void
language sql
security definer
set search_path = public, extensions
as $$
  update public.app_sessions set revoked_at = now()
  where token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex') and revoked_at is null;
$$;
revoke all on function public.app_logout(text) from public;
grant execute on function public.app_logout(text) to anon, authenticated;

-- ------------------------------------------------------------------ admin: list and save users

create or replace function public.app_admin_list_users(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare me public.app_users;
begin
  me := public.app_session_user(p_token);
  if me.id is null or me.role <> 'admin' then raise exception 'not_admin' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', u.id, 'username', u.username, 'display_name', u.display_name, 'role', u.role, 'active', u.active,
      'locked', u.locked_until is not null and u.locked_until > now(), 'locked_until', u.locked_until,
      'last_login_at', u.last_login_at, 'created_at', u.created_at, 'updated_at', u.updated_at,
      'logins', (select count(*) from public.app_login_events e where e.user_id = u.id)
    ) order by u.active desc, u.display_name)
    from public.app_users u), '[]'::jsonb);
end;
$$;
revoke all on function public.app_admin_list_users(text) from public;
grant execute on function public.app_admin_list_users(text) to anon, authenticated;

-- Create (p_id null; password required) or update (password optional = reset).
create or replace function public.app_admin_save_user(
  p_token text, p_id uuid, p_username text, p_display_name text, p_role text, p_active boolean, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  me public.app_users;
  cur public.app_users;
  uname text := lower(btrim(coalesce(p_username, '')));
  dname text := btrim(coalesce(p_display_name, ''));
  pw text := nullif(p_password, '');
  new_id uuid;
  changes text[] := '{}';
begin
  me := public.app_session_user(p_token);
  if me.id is null or me.role <> 'admin' then raise exception 'not_admin' using errcode = '42501'; end if;

  if uname !~ '^[a-z0-9][a-z0-9._-]{2,31}$' then
    raise exception 'Username must be 3–32 characters: letters, numbers, dot, dash or underscore.';
  end if;
  if length(dname) < 2 then raise exception 'Enter the person''s full name.'; end if;
  if p_role not in ('front_office', 'nurse', 'doctor', 'research_scientist', 'director', 'medical_records', 'admin') then
    raise exception 'Choose a role from the list.';
  end if;
  if pw is not null and length(pw) < 8 then raise exception 'Password must be at least 8 characters.'; end if;
  if exists (select 1 from public.app_users where username = uname and (p_id is null or id <> p_id)) then
    raise exception 'The username "%" is already taken.', uname;
  end if;

  if p_id is null then
    if pw is null then raise exception 'Set a password for the new user.'; end if;
    insert into public.app_users (username, display_name, role, password_hash, active)
    values (uname, dname, p_role, crypt(pw, gen_salt('bf', 10)), coalesce(p_active, true))
    returning id into new_id;
    insert into public.app_user_changes (actor, username, action, detail)
    values (me.username, uname, 'created', format('role %s', p_role));
    return jsonb_build_object('ok', true, 'id', new_id);
  end if;

  select * into cur from public.app_users where id = p_id;
  if not found then raise exception 'That user no longer exists.'; end if;

  -- Never lock the hospital out: you cannot demote or deactivate yourself,
  -- and there must always be at least one active admin.
  if cur.id = me.id and (p_role <> 'admin' or not coalesce(p_active, true)) then
    raise exception 'You cannot remove your own admin role or deactivate yourself. Ask another admin.';
  end if;
  if cur.role = 'admin' and cur.active and (p_role <> 'admin' or not coalesce(p_active, true))
     and (select count(*) from public.app_users where role = 'admin' and active and id <> cur.id) = 0 then
    raise exception 'This is the last active admin. Make someone else an admin first.';
  end if;

  if cur.username <> uname then changes := changes || format('username %s → %s', cur.username, uname); end if;
  if cur.display_name <> dname then changes := changes || 'name changed'::text; end if;
  if cur.role <> p_role then changes := changes || format('role %s → %s', cur.role, p_role); end if;
  if cur.active <> coalesce(p_active, true) then changes := changes || (case when coalesce(p_active, true) then 'reactivated' else 'deactivated' end)::text; end if;
  if pw is not null then changes := changes || 'password reset'::text; end if;

  update public.app_users set
    username = uname, display_name = dname, role = p_role, active = coalesce(p_active, true),
    password_hash = case when pw is null then password_hash else crypt(pw, gen_salt('bf', 10)) end,
    failed_attempts = case when pw is null then failed_attempts else 0 end,
    locked_until = case when pw is null then locked_until else null end,
    updated_at = now()
  where id = cur.id;

  -- Deactivation, a password reset or a role change ends the person's current sessions.
  if pw is not null or not coalesce(p_active, true) or cur.role <> p_role then
    update public.app_sessions set revoked_at = now()
    where user_id = cur.id and revoked_at is null and (cur.id <> me.id or pw is null);
  end if;

  if array_length(changes, 1) > 0 then
    insert into public.app_user_changes (actor, username, action, detail)
    values (me.username, uname, 'updated', array_to_string(changes, '; '));
  end if;
  return jsonb_build_object('ok', true, 'id', cur.id);
end;
$$;
revoke all on function public.app_admin_save_user(text, uuid, text, text, text, boolean, text) from public;
grant execute on function public.app_admin_save_user(text, uuid, text, text, text, boolean, text) to anon, authenticated;

create or replace function public.app_admin_unlock(p_token text, p_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare me public.app_users; uname text;
begin
  me := public.app_session_user(p_token);
  if me.id is null or me.role <> 'admin' then raise exception 'not_admin' using errcode = '42501'; end if;
  update public.app_users set locked_until = null, failed_attempts = 0, updated_at = now() where id = p_id returning username into uname;
  if uname is not null then
    insert into public.app_user_changes (actor, username, action, detail) values (me.username, uname, 'unlocked', null);
  end if;
end;
$$;
revoke all on function public.app_admin_unlock(text, uuid) from public;
grant execute on function public.app_admin_unlock(text, uuid) to anon, authenticated;

-- SQL-editor helpers from the first migration accept the new role names too.
create or replace function public.app_create_user(p_username text, p_display_name text, p_role text, p_password text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare new_id uuid;
begin
  if length(coalesce(p_password, '')) < 6 then
    raise exception 'Password must be at least 6 characters';
  end if;
  insert into public.app_users (username, display_name, role, password_hash)
  values (lower(btrim(p_username)), p_display_name, coalesce(p_role, 'front_office'), crypt(p_password, gen_salt('bf', 10)))
  returning id into new_id;
  return new_id;
end;
$$;
revoke all on function public.app_create_user(text, text, text, text) from public, anon, authenticated;
