-- Log-in counts for the sidebar label: every successful log-in is recorded, and
-- app_login_stats() returns how many users have logged in and how many log-ins there were.
-- Run after 20261007000000_app_users.sql.

create table if not exists public.app_login_events (
  id       bigint generated always as identity primary key,
  user_id  uuid not null references public.app_users(id) on delete cascade,
  at       timestamptz not null default now()
);
create index if not exists app_login_events_at on public.app_login_events (at);

alter table public.app_login_events enable row level security;
revoke all on public.app_login_events from anon, authenticated;

-- Users who logged in before this table existed count once, at their last log-in.
insert into public.app_login_events (user_id, at)
select u.id, u.last_login_at from public.app_users u
where u.last_login_at is not null
  and not exists (select 1 from public.app_login_events e where e.user_id = u.id);

-- app_login(): same as before, plus one event row per successful log-in.
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

  return jsonb_build_object('ok', true, 'user',
    jsonb_build_object('id', u.id, 'username', u.username, 'display_name', u.display_name, 'role', u.role));
end;
$$;

revoke all on function public.app_login(text, text) from public;
grant execute on function public.app_login(text, text) to anon, authenticated;

-- Counts only (no names): safe to call with the public key.
create or replace function public.app_login_stats()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'users_logged_in', (select count(distinct user_id) from public.app_login_events),
    'total_users',     (select count(*) from public.app_users where active),
    'logins_total',    (select count(*) from public.app_login_events),
    'logins_today',    (select count(*) from public.app_login_events
                         where (at at time zone 'Asia/Kolkata')::date = (now() at time zone 'Asia/Kolkata')::date)
  );
$$;

revoke all on function public.app_login_stats() from public;
grant execute on function public.app_login_stats() to anon, authenticated;
