-- Quick visit: wound photographs, for follow-up comparison and later analysis.
-- Run after 20261013000000_quick_visits.sql.
--
-- Photos are shrunk in the browser (longest side 1600 px, JPEG, location/EXIF data removed by
-- re-encoding) and stored here, inside the same protected database as the visits: row-level
-- security on, no grants, and every call checks the log-in session and role (qv_caller:
-- Admin, Director, Medical record executive). Each photo keeps a SHA-256 fingerprint.
-- Photos are never deleted, only marked removed with a reason.

create table if not exists public.qv_photos (
  id           uuid primary key default gen_random_uuid(),
  visit_id     uuid not null references public.qv_visits(id) on delete restrict,
  patient_id   uuid not null references public.qv_patients(id) on delete restrict,
  label        text,                        -- e.g. "Right Heel"
  note         text,
  has_scale    boolean not null default false,  -- a ruler / scale is in the shot (needed to measure from the photo)
  consent      text not null default 'Care only' check (consent in ('Care only', 'Care + research')),
  mime         text not null check (mime in ('image/jpeg', 'image/png', 'image/webp')),
  width        int,
  height       int,
  bytes        int not null,
  sha256       text not null,
  image        bytea not null,
  created_at   timestamptz not null default now(),
  created_by   text not null,
  removed      boolean not null default false,
  removed_at   timestamptz,
  removed_by   text,
  removed_why  text
);
create index if not exists qv_photos_visit on public.qv_photos (visit_id);
create index if not exists qv_photos_patient on public.qv_photos (patient_id, created_at);

alter table public.qv_photos enable row level security;
revoke all on public.qv_photos from anon, authenticated;

-- Add one photo to a saved visit. p_image is base64 (no "data:" prefix).
create or replace function public.qv_add_photo(p_token text, p_visit_id uuid, p_image text, p_meta jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  me public.app_users;
  v public.qv_visits;
  img bytea;
  new_id uuid;
  mime text := coalesce(nullif(p_meta->>'mime', ''), 'image/jpeg');
begin
  me := public.qv_caller(p_token);
  select * into v from public.qv_visits where id = p_visit_id;
  if not found then raise exception 'Save the visit before adding photos.'; end if;
  if (select count(*) from public.qv_photos where visit_id = v.id and not removed) >= 6 then
    raise exception 'A visit can have at most 6 photos.';
  end if;
  begin
    img := decode(p_image, 'base64');
  exception when others then
    raise exception 'The photo could not be read.';
  end;
  if octet_length(img) < 1000 then raise exception 'The photo is empty or too small.'; end if;
  if octet_length(img) > 3 * 1024 * 1024 then raise exception 'The photo is larger than 3 MB.'; end if;

  insert into public.qv_photos (visit_id, patient_id, label, note, has_scale, consent, mime, width, height, bytes, sha256, image, created_by)
  values (v.id, v.patient_id, nullif(btrim(p_meta->>'label'), ''), nullif(btrim(p_meta->>'note'), ''),
          coalesce((p_meta->>'has_scale')::boolean, false), coalesce(nullif(p_meta->>'consent', ''), 'Care only'),
          mime, nullif(p_meta->>'width', '')::int, nullif(p_meta->>'height', '')::int,
          octet_length(img), encode(digest(img, 'sha256'), 'hex'), img, me.username)
  returning id into new_id;
  return jsonb_build_object('ok', true, 'id', new_id);
end;
$$;

-- Photo list for a patient (details only, no image data), oldest first.
create or replace function public.qv_photo_list(p_token text, p_patient_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
begin
  perform public.qv_caller(p_token);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', f.id, 'visit_id', f.visit_id, 'visit_date', v.visit_date, 'label', f.label, 'note', f.note, 'has_scale', f.has_scale,
      'consent', f.consent, 'width', f.width, 'height', f.height, 'bytes', f.bytes, 'sha256', f.sha256,
      'created_at', f.created_at, 'created_by', f.created_by) order by v.visit_date, f.created_at)
    from public.qv_photos f join public.qv_visits v on v.id = f.visit_id
    where f.patient_id = p_patient_id and not f.removed), '[]'::jsonb);
end;
$$;

-- One photo's image (base64) for display.
create or replace function public.qv_photo(p_token text, p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
begin
  perform public.qv_caller(p_token);
  return (select jsonb_build_object('mime', mime, 'image', encode(image, 'base64'), 'sha256', sha256)
          from public.qv_photos where id = p_id and not removed);
end;
$$;

-- Take a photo out of the record (kept for audit, hidden from the screen). A reason is required.
create or replace function public.qv_remove_photo(p_token text, p_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare me public.app_users;
begin
  me := public.qv_caller(p_token);
  if length(btrim(coalesce(p_reason, ''))) < 3 then raise exception 'Give a reason for removing the photo.'; end if;
  update public.qv_photos set removed = true, removed_at = now(), removed_by = me.username, removed_why = btrim(p_reason)
  where id = p_id and not removed;
  if not found then raise exception 'That photo no longer exists.'; end if;
end;
$$;

revoke all on function public.qv_add_photo(text, uuid, text, jsonb) from public;
revoke all on function public.qv_photo_list(text, uuid) from public;
revoke all on function public.qv_photo(text, uuid) from public;
revoke all on function public.qv_remove_photo(text, uuid, text) from public;
grant execute on function public.qv_add_photo(text, uuid, text, jsonb) to anon, authenticated;
grant execute on function public.qv_photo_list(text, uuid) to anon, authenticated;
grant execute on function public.qv_photo(text, uuid) to anon, authenticated;
grant execute on function public.qv_remove_photo(text, uuid, text) to anon, authenticated;
