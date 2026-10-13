-- Quick visit: a one-screen alternative to the step-by-step patient journey.
-- Captures what the hospital needs when the patient returns, in a shape that is ready for
-- research (later fed into the Research documents register).
-- Run after 20261009000000_app_user_admin.sql.
--
-- Access: the tables have row-level security on and no grants, so the public key cannot read
-- them. Every read and write goes through qv_* functions that check the caller's log-in
-- session (app_session_user) and role: Admin, Director and Medical record executive only.
-- Research scientists never see these identifiable records; research gets a de-identified extract later.

create sequence if not exists public.qv_patient_seq start 1;

create table if not exists public.qv_patients (
  id            uuid primary key default gen_random_uuid(),
  patient_no    text not null unique default ('PT-' || lpad(nextval('public.qv_patient_seq')::text, 6, '0')),
  hospital_id   text,                       -- the hospital's own UHID / MRN, if any
  name          text not null check (length(btrim(name)) >= 2),
  sex           text not null check (sex in ('Male', 'Female', 'Other')),
  dob           date,
  age_years     int check (age_years between 0 and 120),
  phone         text,
  area          text,
  city          text,
  abha          text,
  background    jsonb not null default '{}',  -- diabetes, HbA1c, BP, CKD, smoking, amputation, revascularisation, allergies, medicines
  created_at    timestamptz not null default now(),
  created_by    text not null,
  updated_at    timestamptz not null default now(),
  updated_by    text not null
);
create index if not exists qv_patients_phone on public.qv_patients (phone);
create index if not exists qv_patients_name on public.qv_patients (lower(name));

create table if not exists public.qv_visits (
  id                 uuid primary key default gen_random_uuid(),
  patient_id         uuid not null references public.qv_patients(id) on delete restrict,
  visit_date         date not null default (now() at time zone 'Asia/Kolkata')::date,
  location           text,
  visit_type         text not null default 'New' check (visit_type in ('New', 'Follow-up', 'Emergency')),
  -- Columns research will filter on; the full form is kept in `data`.
  diagnoses          text[] not null default '{}',
  wound_site         text,
  wound_area_cm2     numeric(7,2),
  wagner             int check (wagner between 0 and 5),
  infection          text,
  abi_right          numeric(4,2),
  abi_left           numeric(4,2),
  outcome            text,
  next_review        date,
  research_consent   text not null default 'Not asked' check (research_consent in ('Yes', 'No', 'Not asked')),
  research_score     int not null default 0 check (research_score between 0 and 100),
  data               jsonb not null default '{}',
  created_at         timestamptz not null default now(),
  created_by         text not null,
  updated_at         timestamptz not null default now(),
  updated_by         text not null
);
create index if not exists qv_visits_patient on public.qv_visits (patient_id, visit_date desc);
create index if not exists qv_visits_date on public.qv_visits (visit_date desc);

alter table public.qv_patients enable row level security;
alter table public.qv_visits enable row level security;
revoke all on public.qv_patients, public.qv_visits from anon, authenticated;
revoke all on sequence public.qv_patient_seq from anon, authenticated;

-- ------------------------------------------------------------------ access check

-- The logged-in user, if their role may use Quick visit (admin, director, medical records); raises otherwise.
create or replace function public.qv_caller(p_token text)
returns public.app_users
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare me public.app_users;
begin
  me := public.app_session_user(p_token);
  if me.id is null then raise exception 'not_logged_in' using errcode = '42501'; end if;
  if me.role not in ('admin', 'director', 'medical_records') then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return me;
end;
$$;
revoke all on function public.qv_caller(text) from public, anon, authenticated;

-- ------------------------------------------------------------------ read

-- Find patients by phone, name, patient number or hospital ID (at most 12).
create or replace function public.qv_search(p_token text, p_q text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare q text := lower(btrim(coalesce(p_q, ''))); digits text := regexp_replace(coalesce(p_q, ''), '\D', '', 'g');
begin
  perform public.qv_caller(p_token);
  if length(q) < 2 then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(r order by r->>'last_visit' desc nulls last) from (
      select jsonb_build_object(
        'id', p.id, 'patient_no', p.patient_no, 'hospital_id', p.hospital_id, 'name', p.name, 'sex', p.sex,
        'age_years', p.age_years, 'phone', p.phone, 'area', p.area, 'city', p.city,
        'visits', (select count(*) from public.qv_visits v where v.patient_id = p.id),
        'last_visit', (select max(v.visit_date) from public.qv_visits v where v.patient_id = p.id)) r
      from public.qv_patients p
      where lower(p.name) like '%' || q || '%'
         or lower(p.patient_no) = q or lower(coalesce(p.hospital_id, '')) = q
         or (length(digits) >= 4 and regexp_replace(coalesce(p.phone, ''), '\D', '', 'g') like '%' || digits || '%')
      limit 12) s), '[]'::jsonb);
end;
$$;

-- One patient with every visit (newest first).
create or replace function public.qv_patient(p_token text, p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
begin
  perform public.qv_caller(p_token);
  return (
    select to_jsonb(p) || jsonb_build_object('visits', coalesce((
      select jsonb_agg(to_jsonb(v) - 'patient_id' order by v.visit_date desc, v.created_at desc)
      from public.qv_visits v where v.patient_id = p.id), '[]'::jsonb))
    from public.qv_patients p where p.id = p_id);
end;
$$;

-- Recent visits (for the "today" list), optionally for one location.
create or replace function public.qv_recent(p_token text, p_location text, p_days int default 1)
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
      'id', v.id, 'patient_id', p.id, 'patient_no', p.patient_no, 'name', p.name, 'sex', p.sex, 'age_years', p.age_years,
      'visit_date', v.visit_date, 'visit_type', v.visit_type, 'location', v.location, 'diagnoses', v.diagnoses,
      'wound_area_cm2', v.wound_area_cm2, 'outcome', v.outcome, 'research_score', v.research_score,
      'research_consent', v.research_consent, 'created_by', v.created_by, 'created_at', v.created_at)
      order by v.created_at desc)
    from public.qv_visits v join public.qv_patients p on p.id = v.patient_id
    where v.visit_date >= (now() at time zone 'Asia/Kolkata')::date - (greatest(coalesce(p_days, 1), 1) - 1)
      and (p_location is null or p_location = '' or v.location = p_location)), '[]'::jsonb);
end;
$$;

-- ------------------------------------------------------------------ write

-- Save a visit in one call: creates or updates the patient (details + background), then
-- creates the visit (or updates it when p_visit.id is given).
create or replace function public.qv_save(p_token text, p_patient jsonb, p_visit jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  me public.app_users;
  pid uuid := nullif(p_patient->>'id', '')::uuid;
  vid uuid := nullif(p_visit->>'id', '')::uuid;
  pno text;
begin
  me := public.qv_caller(p_token);

  if length(btrim(coalesce(p_patient->>'name', ''))) < 2 then raise exception 'Enter the patient''s name.'; end if;
  if coalesce(p_patient->>'sex', '') not in ('Male', 'Female', 'Other') then raise exception 'Choose the patient''s sex.'; end if;
  if nullif(p_patient->>'age_years', '') is null and nullif(p_patient->>'dob', '') is null then raise exception 'Enter age or date of birth.'; end if;

  if pid is null then
    insert into public.qv_patients (hospital_id, name, sex, dob, age_years, phone, area, city, abha, background, created_by, updated_by)
    values (nullif(btrim(p_patient->>'hospital_id'), ''), btrim(p_patient->>'name'), p_patient->>'sex',
            nullif(p_patient->>'dob', '')::date, nullif(p_patient->>'age_years', '')::int,
            nullif(btrim(p_patient->>'phone'), ''), nullif(btrim(p_patient->>'area'), ''), nullif(btrim(p_patient->>'city'), ''),
            nullif(btrim(p_patient->>'abha'), ''), coalesce(p_patient->'background', '{}'), me.username, me.username)
    returning id, patient_no into pid, pno;
  else
    update public.qv_patients set
      hospital_id = nullif(btrim(p_patient->>'hospital_id'), ''), name = btrim(p_patient->>'name'), sex = p_patient->>'sex',
      dob = nullif(p_patient->>'dob', '')::date, age_years = nullif(p_patient->>'age_years', '')::int,
      phone = nullif(btrim(p_patient->>'phone'), ''), area = nullif(btrim(p_patient->>'area'), ''),
      city = nullif(btrim(p_patient->>'city'), ''), abha = nullif(btrim(p_patient->>'abha'), ''),
      background = coalesce(p_patient->'background', background), updated_at = now(), updated_by = me.username
    where id = pid returning patient_no into pno;
    if pno is null then raise exception 'That patient record no longer exists.'; end if;
  end if;

  if vid is null then
    insert into public.qv_visits (patient_id, visit_date, location, visit_type, diagnoses, wound_site, wound_area_cm2, wagner, infection,
      abi_right, abi_left, outcome, next_review, research_consent, research_score, data, created_by, updated_by)
    values (pid, coalesce(nullif(p_visit->>'visit_date', '')::date, (now() at time zone 'Asia/Kolkata')::date), p_visit->>'location',
      coalesce(nullif(p_visit->>'visit_type', ''), 'New'),
      coalesce(array(select jsonb_array_elements_text(coalesce(p_visit->'diagnoses', '[]'))), '{}'),
      nullif(p_visit->>'wound_site', ''), nullif(p_visit->>'wound_area_cm2', '')::numeric, nullif(p_visit->>'wagner', '')::int,
      nullif(p_visit->>'infection', ''), nullif(p_visit->>'abi_right', '')::numeric, nullif(p_visit->>'abi_left', '')::numeric,
      nullif(p_visit->>'outcome', ''), nullif(p_visit->>'next_review', '')::date,
      coalesce(nullif(p_visit->>'research_consent', ''), 'Not asked'), coalesce(nullif(p_visit->>'research_score', '')::int, 0),
      coalesce(p_visit->'data', '{}'), me.username, me.username)
    returning id into vid;
  else
    update public.qv_visits set
      visit_date = coalesce(nullif(p_visit->>'visit_date', '')::date, visit_date), location = p_visit->>'location',
      visit_type = coalesce(nullif(p_visit->>'visit_type', ''), visit_type),
      diagnoses = coalesce(array(select jsonb_array_elements_text(coalesce(p_visit->'diagnoses', '[]'))), '{}'),
      wound_site = nullif(p_visit->>'wound_site', ''), wound_area_cm2 = nullif(p_visit->>'wound_area_cm2', '')::numeric,
      wagner = nullif(p_visit->>'wagner', '')::int, infection = nullif(p_visit->>'infection', ''),
      abi_right = nullif(p_visit->>'abi_right', '')::numeric, abi_left = nullif(p_visit->>'abi_left', '')::numeric,
      outcome = nullif(p_visit->>'outcome', ''), next_review = nullif(p_visit->>'next_review', '')::date,
      research_consent = coalesce(nullif(p_visit->>'research_consent', ''), 'Not asked'),
      research_score = coalesce(nullif(p_visit->>'research_score', '')::int, 0),
      data = coalesce(p_visit->'data', '{}'), updated_at = now(), updated_by = me.username
    where id = vid and patient_id = pid;
    if not found then raise exception 'That visit no longer exists.'; end if;
  end if;

  return jsonb_build_object('ok', true, 'patient_id', pid, 'patient_no', pno, 'visit_id', vid);
end;
$$;

revoke all on function public.qv_search(text, text) from public;
revoke all on function public.qv_patient(text, uuid) from public;
revoke all on function public.qv_recent(text, text, int) from public;
revoke all on function public.qv_save(text, jsonb, jsonb) from public;
grant execute on function public.qv_search(text, text) to anon, authenticated;
grant execute on function public.qv_patient(text, uuid) to anon, authenticated;
grant execute on function public.qv_recent(text, text, int) to anon, authenticated;
grant execute on function public.qv_save(text, jsonb, jsonb) to anon, authenticated;
