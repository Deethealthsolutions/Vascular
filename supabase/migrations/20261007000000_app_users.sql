-- App log-in: user accounts for the staff workspace (/clinical, /staff).
--
-- Passwords are stored only as bcrypt hashes (pgcrypto). The table has row-level security
-- switched on and no policies, and the anon/authenticated roles have no grants on it, so the
-- public key cannot read it. The app checks a password only through app_login(), which returns
-- the user's name and role, never the hash.
--
-- Accounts are created or reset from the Supabase SQL editor with app_create_user() /
-- app_set_password(); those two are not callable with the public key.
--
-- Lock-out: 5 wrong passwords in a row lock the account for 15 minutes.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.app_users (
  id               uuid primary key default gen_random_uuid(),
  username         text not null unique check (username = lower(btrim(username)) and username <> ''),
  display_name     text not null,
  role             text not null default 'staff',
  password_hash    text not null,
  active           boolean not null default true,
  failed_attempts  int not null default 0,
  locked_until     timestamptz,
  last_login_at    timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.app_users enable row level security;
revoke all on public.app_users from anon, authenticated;

comment on table public.app_users is 'Log-in accounts for the staff workspace. Read only through app_login(); never expose password_hash.';

-- ------------------------------------------------------------------ log in

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
begin
  select * into u from public.app_users where username = lower(btrim(p_username));

  if not found or not u.active then
    -- Hash anyway so an unknown user takes as long as a wrong password.
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

  return jsonb_build_object('ok', true, 'user',
    jsonb_build_object('id', u.id, 'username', u.username, 'display_name', u.display_name, 'role', u.role));
end;
$$;

revoke all on function public.app_login(text, text) from public;
grant execute on function public.app_login(text, text) to anon, authenticated;

-- ------------------------------------------------------------------ account admin (SQL editor only)

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
  values (lower(btrim(p_username)), p_display_name, coalesce(p_role, 'staff'), crypt(p_password, gen_salt('bf', 10)))
  returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.app_set_password(p_username text, p_password text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if length(coalesce(p_password, '')) < 6 then
    raise exception 'Password must be at least 6 characters';
  end if;
  update public.app_users
     set password_hash = crypt(p_password, gen_salt('bf', 10)), failed_attempts = 0, locked_until = null, updated_at = now()
   where username = lower(btrim(p_username));
  if not found then
    raise exception 'No user %', p_username;
  end if;
end;
$$;

revoke all on function public.app_create_user(text, text, text, text) from public, anon, authenticated;
revoke all on function public.app_set_password(text, text) from public, anon, authenticated;

-- The first account is created by hand in the SQL editor (not in this file, because the
-- repository is public):
--   select public.app_create_user('admin', 'Administrator', 'admin', '<password>');
