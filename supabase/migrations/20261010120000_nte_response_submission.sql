-- Let an employee file their Notice to Explain response, and nothing else.
--
-- WHY THIS EXISTS
--
-- `submitNteResponse` (lib/hr/nte-actions.ts) inserts into `nte_responses` and then
-- runs `update nte_cases set status = 'under_review'`. The insert succeeds: the
-- employee holds `nte.self`, and `nte_responses_insert` allows exactly that. The
-- update does not.
--
-- `nte_cases` has only two policies (`20260906001000_hr_payroll.sql:343,351`):
--
--   nte_cases_select   for select,  is_self_employee(employee_id) or nte.read/manage
--   nte_cases_manage   for all,     nte.manage
--
-- An employee holds `nte.self`, not `nte.manage`, so RLS rejects the update. The
-- action did not check the error, so it returned "Response submitted." anyway. The
-- measured result on the demo tenant: the response text was stored, the case stayed
-- at `issued`, and the employee was told it had been filed.
--
-- The obvious fix -- a `for update` policy scoped to `is_self_employee(employee_id)`
-- -- is NOT acceptable. RLS cannot restrict *columns*, so that policy would let any
-- employee set `resolution_type`, `resolved_by`, `resolved_at` and `resolution_notes`
-- on their own Notice to Explain: mark it cleared, or record a dismissal against
-- themselves. That turns a status bug into a privilege escalation.
--
-- So the write is moved into a SECURITY DEFINER function that does both halves and
-- checks ownership itself. The function is the only thing granted execute, and the
-- employee still has no direct UPDATE on the table.
--
-- The function is intentionally narrow: it inserts the response, flips the status
-- from an open status, and returns the resulting status. It cannot resolve a case.
--
-- USAGE FROM THE APP:
--
--   const { data, error } = await supabase.rpc("submit_nte_response", {
--     p_nte_case_id: <uuid>,
--     p_response_text: <text>,
--   });
--
-- Error codes: 'NTE_NOT_FOUND_OR_NOT_OWNED', 'CASE_NOT_OPEN', 'EMPTY_RESPONSE'.

create or replace function public.submit_nte_response(
  p_nte_case_id uuid,
  p_response_text text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee_id uuid;
  v_current public.nte_case_status;
  v_updated integer;
begin
  if p_response_text is null or length(trim(p_response_text)) < 10 then
    raise exception 'EMPTY_RESPONSE' using errcode = '22023';
  end if;

  select e.id into v_employee_id
  from public.employees e
  where e.profile_id = auth.uid()
    and e.employment_status = 'active';

  if v_employee_id is null then
    raise exception 'NTE_NOT_FOUND_OR_NOT_OWNED' using errcode = '42501';
  end if;

  select c.status into v_current
  from public.nte_cases c
  where c.id = p_nte_case_id
    and c.employee_id = v_employee_id
  for update;

  if v_current is null then
    raise exception 'NTE_NOT_FOUND_OR_NOT_OWNED' using errcode = '42501';
  end if;

  -- Only an open case can be answered. Once resolved there is nothing to respond to,
  -- and a late response must not reopen the case or overwrite the resolution.
  if v_current not in ('issued', 'awaiting_response') then
    raise exception 'CASE_NOT_OPEN' using errcode = '22023';
  end if;

  insert into public.nte_responses (nte_case_id, employee_id, response_text)
  values (p_nte_case_id, v_employee_id, trim(p_response_text));

  update public.nte_cases
  set status = 'under_review'
  where id = p_nte_case_id
    and status in ('issued', 'awaiting_response');

  get diagnostics v_updated = row_count;

  if v_updated <> 1 then
    raise exception 'CASE_NOT_OPEN' using errcode = '22023';
  end if;

  return 'under_review';
end;
$$;

comment on function public.submit_nte_response(uuid, text) is
  'Files an employee''s own NTE response and moves their case to under_review. SECURITY DEFINER because nte_cases UPDATE is gated on nte.manage, which an employee deliberately does not hold. Cannot resolve a case.';

revoke all on function public.submit_nte_response(uuid, text) from public;
grant execute on function public.submit_nte_response(uuid, text) to authenticated;