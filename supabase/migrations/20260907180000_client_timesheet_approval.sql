-- Client timesheet approval: expose record id on summary view for approve/reject actions.
-- Clients update via service role after authz (attendance.approve); view needs the PK.

drop view if exists public.client_attendance_summary cascade;
create view public.client_attendance_summary
with (security_invoker = true)
as
select
  ar.id as attendance_record_id,
  ea.client_organization_id,
  ar.employee_id,
  ar.work_date,
  ar.clock_in_at,
  ar.clock_out_at,
  ar.worked_minutes,
  ar.break_minutes,
  ar.late_minutes,
  ar.overtime_minutes,
  ar.status,
  ar.approval_status,
  e.employee_number,
  p.display_name,
  e.job_title,
  ea.role_title
from public.attendance_records ar
join public.employee_assignments ea on ea.employee_id = ar.employee_id
join public.employees e on e.id = ar.employee_id
join public.profiles p on p.id = e.profile_id
where ea.assignment_type = 'client'
  and ea.status = 'active'
  and ea.client_organization_id is not null
  and e.employment_status = 'active'
  and (ea.start_date is null or ar.work_date >= ea.start_date)
  and (ea.end_date is null or ar.work_date <= ea.end_date);

grant select on public.client_attendance_summary to authenticated;

-- Enable client timesheet approval on existing settings rows (ops can turn off per org).
update public.client_settings
set allow_timesheet_approval = true
where allow_timesheet_approval = false;
