-- Research documents: assigned reviewer.
-- Run once in the Supabase SQL editor, after 20261005000000_research_documents.sql.
-- Safe to re-run. Existing records keep working (drafts simply have no reviewer yet).
--
-- Submitting a draft now requires an assigned reviewer (not the submitter). Only that reviewer can
-- approve the record; while it is in review it can be reassigned to someone else.

alter table research_documents add column if not exists assigned_reviewer      text;
alter table research_documents add column if not exists assigned_reviewer_role text;
alter table research_documents add column if not exists assigned_at            timestamptz;
alter table research_documents add column if not exists assigned_by            text;
create index if not exists research_documents_reviewer_idx on research_documents (assigned_reviewer) where status = 'in_review';

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
    if new.status = 'in_review' then
      if coalesce(trim(new.assigned_reviewer), '') = '' then
        raise exception 'Assign a reviewer before submitting for review.';
      end if;
      if new.assigned_reviewer = new.submitted_by then
        raise exception 'You cannot assign the review to yourself.';
      end if;
    end if;
    if new.status = 'approved' then
      if new.approved_by is not distinct from old.submitted_by then
        raise exception 'The person who submitted the record cannot approve it.';
      end if;
      if new.approved_by is distinct from old.assigned_reviewer then
        raise exception 'Only the assigned reviewer (%) can approve this record.', old.assigned_reviewer;
      end if;
    end if;
    if new.status = 'complete' and coalesce(trim(new.archive_location), '') = '' then
      raise exception 'A physical archive location is required to complete the record.';
    end if;
  elsif old.status <> 'draft' and (new.current_text is distinct from old.current_text
         or new.title is distinct from old.title
         or new.principal_investigator is distinct from old.principal_investigator) then
    raise exception 'Only draft records can be edited (record is %).', old.status;
  end if;
  -- Reassigning the reviewer is only possible while the record is in review, never to the submitter.
  if new.status = old.status and new.assigned_reviewer is distinct from old.assigned_reviewer then
    if old.status not in ('draft', 'in_review') then
      raise exception 'The reviewer can only be changed while the record is in review.';
    end if;
    if new.assigned_reviewer = old.submitted_by then
      raise exception 'The review cannot be assigned to the person who submitted it.';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
