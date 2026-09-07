-- Hardening: audit insert tightening, NTE composite index, hot FK indexes

-- Audit: only allow inserting rows as yourself
drop policy if exists audit_insert on public.audit_logs;
create policy audit_insert
  on public.audit_logs for insert to authenticated
  with check (actor_user_id = (select auth.uid()));

-- NTE hot path: employee + status filters
create index if not exists nte_cases_employee_status_idx
  on public.nte_cases (employee_id, status);

create index if not exists nte_cases_issued_by_idx
  on public.nte_cases (issued_by)
  where issued_by is not null;

create index if not exists nte_responses_case_employee_idx
  on public.nte_responses (nte_case_id, employee_id);

-- Application stage history lookups
create index if not exists application_stage_history_changed_by_idx
  on public.application_stage_history (changed_by)
  where changed_by is not null;

-- Payroll period detail
create index if not exists payroll_records_period_idx
  on public.payroll_records (payroll_period_id);

-- Ticket messages by ticket
create index if not exists ticket_messages_ticket_created_idx
  on public.ticket_messages (ticket_id, created_at);

-- Audit actor lookups
create index if not exists audit_logs_actor_created_idx
  on public.audit_logs (actor_user_id, created_at desc);
