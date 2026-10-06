-- Research documents register
-- Run once in the Supabase SQL editor (or `supabase db push`).
--
-- What it creates
--   research_documents          one row per research record, with a database-issued running
--                               register number (RES-YYYY-NNNNN) for the physical file
--   research_document_files     each uploaded original (PDF, DOC/DOCX, XLS/XLSX, PNG, JPG, BMP),
--                               its storage path, SHA-256 fingerprint and extracted text
--   research_document_versions  every saved version of the record's text (extracted or edited)
--   research_document_events    append-only workflow and audit log
--   storage bucket research-files (private)
--
-- Workflow: draft -> in_review -> approved -> complete (in_review may return to draft).
-- The rules are enforced here as well as in the app, so they hold whatever client is used.

create extension if not exists pgcrypto;

-- ------------------------------------------------------------------ register number
create sequence if not exists research_register_seq start 1;

create table if not exists research_documents (
  id                     uuid primary key default gen_random_uuid(),
  register_no            text not null unique
                           default ('RES-' || to_char(now() at time zone 'Asia/Kolkata', 'YYYY') || '-' ||
                                    lpad(nextval('research_register_seq')::text, 5, '0')),
  title                  text not null check (length(trim(title)) > 2),
  principal_investigator text not null,
  co_authors             text,
  department             text,
  study_type             text,
  study_year             int,
  ethics_ref             text,
  keywords               text[] not null default '{}',
  status                 text not null default 'draft'
                           check (status in ('draft', 'in_review', 'approved', 'complete')),
  current_text           text not null default '',
  text_version           int  not null default 0,
  archive_location       text,
  created_by             text not null,
  created_at             timestamptz not null default now(),
  updated_by             text,
  updated_at             timestamptz not null default now(),
  submitted_by           text, submitted_at timestamptz,
  approved_by            text, approved_at  timestamptz,
  completed_by           text, completed_at timestamptz
);
create index if not exists research_documents_status_idx on research_documents (status, updated_at desc);

create table if not exists research_document_files (
  id                uuid primary key default gen_random_uuid(),
  document_id       uuid not null references research_documents (id) on delete restrict,
  file_name         text not null,
  mime_type         text,
  size_bytes        bigint,
  storage_path      text not null unique,
  sha256            text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  extracted_text    text,
  extraction_method text,
  pages             int,
  ocr_confidence    numeric,
  warnings          text[] not null default '{}',
  uploaded_by       text not null,
  uploaded_at       timestamptz not null default now(),
  removed           boolean not null default false,
  removed_by        text,
  removed_at        timestamptz
);
create index if not exists research_document_files_doc_idx on research_document_files (document_id);

create table if not exists research_document_versions (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null references research_documents (id) on delete restrict,
  version     int  not null,
  body        text not null,
  source      text not null check (source in ('extracted', 'edited', 'restored')),
  note        text,
  created_by  text not null,
  created_at  timestamptz not null default now(),
  unique (document_id, version)
);

create table if not exists research_document_events (
  id          bigint generated always as identity primary key,
  document_id uuid not null references research_documents (id) on delete restrict,
  at          timestamptz not null default now(),
  actor       text not null,
  actor_role  text,
  action      text not null,
  from_status text,
  to_status   text,
  comment     text
);
create index if not exists research_document_events_doc_idx on research_document_events (document_id, at);

-- ------------------------------------------------------------------ workflow guard
create or replace function research_documents_guard() returns trigger
language plpgsql as $$
begin
  if old.status = 'complete' then
    raise exception 'Completed research records are read-only (%).', old.register_no;
  end if;
  if new.register_no is distinct from old.register_no then
    raise exception 'The register number cannot be changed.';
  end if;
  if new.status <> old.status then
    if not ((old.status = 'draft'     and new.status = 'in_review')
         or (old.status = 'in_review' and new.status in ('approved', 'draft'))
         or (old.status = 'approved'  and new.status = 'complete')) then
      raise exception 'Invalid status change: % -> %.', old.status, new.status;
    end if;
    if new.status = 'approved' and new.approved_by is not distinct from old.submitted_by then
      raise exception 'The person who submitted the record cannot approve it.';
    end if;
    if new.status = 'complete' and coalesce(trim(new.archive_location), '') = '' then
      raise exception 'A physical archive location is required to complete the record.';
    end if;
  elsif old.status <> 'draft' and (new.current_text is distinct from old.current_text
         or new.title is distinct from old.title
         or new.principal_investigator is distinct from old.principal_investigator) then
    raise exception 'Only draft records can be edited (record is %).', old.status;
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists research_documents_guard on research_documents;
create trigger research_documents_guard before update on research_documents
  for each row execute function research_documents_guard();

-- Files may only be added to drafts.
create or replace function research_files_guard() returns trigger
language plpgsql as $$
declare st text;
begin
  select status into st from research_documents where id = new.document_id;
  if st <> 'draft' then
    raise exception 'Files can only be added or removed while the record is a draft.';
  end if;
  if tg_op = 'UPDATE' and (new.sha256 is distinct from old.sha256 or new.storage_path is distinct from old.storage_path) then
    raise exception 'A file fingerprint cannot be changed; upload a new file instead.';
  end if;
  return new;
end $$;

drop trigger if exists research_files_guard on research_document_files;
create trigger research_files_guard before insert or update on research_document_files
  for each row execute function research_files_guard();

-- Versions and events are append-only.
create or replace function research_append_only() returns trigger
language plpgsql as $$
begin
  raise exception '% is append-only.', tg_table_name;
end $$;

drop trigger if exists research_versions_append_only on research_document_versions;
create trigger research_versions_append_only before update or delete on research_document_versions
  for each row execute function research_append_only();
drop trigger if exists research_events_append_only on research_document_events;
create trigger research_events_append_only before update or delete on research_document_events
  for each row execute function research_append_only();

-- ------------------------------------------------------------------ storage
insert into storage.buckets (id, name, public, file_size_limit)
values ('research-files', 'research-files', false, 52428800)   -- 50 MB per file
on conflict (id) do nothing;

-- ------------------------------------------------------------------ row-level security
alter table research_documents          enable row level security;
alter table research_document_files     enable row level security;
alter table research_document_versions  enable row level security;
alter table research_document_events    enable row level security;

-- DEMO POLICIES — the prototype has no real sign-in yet, so these allow the anon key to read
-- and write. Before real data is stored: switch the app to Supabase Auth and replace these with
-- role-based policies (e.g. using auth.jwt() -> 'app_metadata' ->> 'role'). No delete is allowed.
drop policy if exists demo_rd_select on research_documents;
create policy demo_rd_select on research_documents for select to anon, authenticated using (true);
drop policy if exists demo_rd_insert on research_documents;
create policy demo_rd_insert on research_documents for insert to anon, authenticated with check (status = 'draft');
drop policy if exists demo_rd_update on research_documents;
create policy demo_rd_update on research_documents for update to anon, authenticated using (true) with check (true);

drop policy if exists demo_rf_select on research_document_files;
create policy demo_rf_select on research_document_files for select to anon, authenticated using (true);
drop policy if exists demo_rf_insert on research_document_files;
create policy demo_rf_insert on research_document_files for insert to anon, authenticated with check (true);
drop policy if exists demo_rf_update on research_document_files;
create policy demo_rf_update on research_document_files for update to anon, authenticated using (true) with check (true);

drop policy if exists demo_rv_select on research_document_versions;
create policy demo_rv_select on research_document_versions for select to anon, authenticated using (true);
drop policy if exists demo_rv_insert on research_document_versions;
create policy demo_rv_insert on research_document_versions for insert to anon, authenticated with check (true);

drop policy if exists demo_re_select on research_document_events;
create policy demo_re_select on research_document_events for select to anon, authenticated using (true);
drop policy if exists demo_re_insert on research_document_events;
create policy demo_re_insert on research_document_events for insert to anon, authenticated with check (true);

drop policy if exists demo_rs_read on storage.objects;
create policy demo_rs_read on storage.objects for select to anon, authenticated using (bucket_id = 'research-files');
drop policy if exists demo_rs_write on storage.objects;
create policy demo_rs_write on storage.objects for insert to anon, authenticated with check (bucket_id = 'research-files');
