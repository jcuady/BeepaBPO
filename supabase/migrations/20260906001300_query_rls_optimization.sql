-- Indexes, RLS isolation, helper tightening, clock_event worked minutes.
-- query-missing-indexes / query-partial-indexes / security-rls-initplan

-- Hot RLS / dashboard paths
create index if not exists organization_memberships_user_status_idx
  on public.organization_memberships (user_id, status)
  include (organization_id, membership_type);

create index if not exists membership_roles_role_idx
  on public.membership_roles (role_id);

create unique index if not exists employees_profile_unique_idx
  on public.employees (profile_id)
  where profile_id is not null;

create index if not exists attendance_records_work_date_status_idx
  on public.attendance_records (work_date, status);

create index if not exists tickets_client_status_created_idx
  on public.tickets (client_organization_id, status, created_at desc);

create index if not exists leave_requests_pending_idx
  on public.leave_requests (status)
  where status = 'pending';

create index if not exists cash_advance_requests_open_idx
  on public.cash_advance_requests (status)
  where status in ('pending', 'hr_review', 'finance_review');

create index if not exists tickets_open_idx
  on public.tickets (status)
  where status not in ('resolved', 'closed');

create index if not exists job_posts_published_live_idx
  on public.job_posts (published_at desc)
  where status = 'published';

create index if not exists approval_requests_pending_org_idx
  on public.approval_requests (organization_id, created_at desc)
  where status = 'pending';

create index if not exists crm_leads_status_created_idx
  on public.crm_leads (status, created_at desc);

create index if not exists employee_assignments_client_active_idx
  on public.employee_assignments (client_organization_id, employee_id)
  where status = 'active' and assignment_type = 'client';

create index if not exists invoices_client_status_idx
  on public.invoices (client_organization_id, status, due_date);

create index if not exists shift_assignments_date_idx
  on public.shift_assignments (work_date, status);

-- Trigram search (pg_trgm lives in extensions)
create index if not exists profiles_display_name_trgm_idx
  on public.profiles using gin (display_name extensions.gin_trgm_ops);

create index if not exists job_posts_title_trgm_idx
  on public.job_posts using gin (title extensions.gin_trgm_ops);

create index if not exists tickets_subject_trgm_idx
  on public.tickets using gin (subject extensions.gin_trgm_ops);

-- Helpers: wrap auth.uid(), fixed search_path, applicant isolation
create or replace function public.current_uid()
returns uuid
language sql
stable
set search_path = public
as $$
  select (select auth.uid());
$$;

create or replace function public.is_internal_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_memberships m
    join public.organizations o on o.id = m.organization_id
    join public.membership_roles mr on mr.membership_id = m.id
    join public.roles r on r.id = mr.role_id
    where m.user_id = (select auth.uid())
      and m.status = 'active'
      and m.membership_type = 'internal'
      and o.type = 'internal'
      and o.status = 'active'
      and r.scope <> 'applicant'
  );
$$;

create or replace function public.is_assigned_to_current_client(p_employee_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.employee_assignments ea
    where ea.employee_id = p_employee_id
      and ea.assignment_type = 'client'
      and ea.status = 'active'
      and ea.client_organization_id is not null
      and public.is_client_member(ea.client_organization_id)
  );
$$;

create or replace function public.can_read_assigned_attendance(p_employee_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_self_employee(p_employee_id)
    or (
      public.is_internal_user()
      and public.has_permission('attendance.read')
    )
    or (
      public.is_assigned_to_current_client(p_employee_id)
      and public.has_permission('attendance.read')
    );
$$;

revoke all on function public.current_uid() from public;
revoke all on function public.is_internal_user() from public;
revoke all on function public.is_client_member(uuid) from public;
revoke all on function public.has_permission(text) from public;
revoke all on function public.has_any_permission(text[]) from public;
revoke all on function public.can_access_client(uuid) from public;
revoke all on function public.current_membership_ids() from public;
revoke all on function public.user_permission_codes() from public;
revoke all on function public.is_self_employee(uuid) from public;
revoke all on function public.is_assigned_to_current_client(uuid) from public;
revoke all on function public.can_read_assigned_attendance(uuid) from public;
revoke all on function public.generate_employee_number() from public;
revoke all on function public.clock_event(uuid, text, numeric, numeric, numeric, text) from public;

grant execute on function public.current_uid() to authenticated;
grant execute on function public.is_internal_user() to authenticated;
grant execute on function public.is_client_member(uuid) to authenticated;
grant execute on function public.has_permission(text) to authenticated;
grant execute on function public.has_any_permission(text[]) to authenticated;
grant execute on function public.can_access_client(uuid) to authenticated;
grant execute on function public.current_membership_ids() to authenticated;
grant execute on function public.user_permission_codes() to authenticated;
grant execute on function public.is_self_employee(uuid) to authenticated;
grant execute on function public.is_assigned_to_current_client(uuid) to authenticated;
grant execute on function public.can_read_assigned_attendance(uuid) to authenticated;
grant execute on function public.generate_employee_number() to authenticated;
grant execute on function public.clock_event(uuid, text, numeric, numeric, numeric, text) to authenticated;

-- Clock-out must persist worked minutes (overnight-safe via timestamptz delta)
create or replace function public.clock_event(
  p_employee_id uuid,
  p_event_type text,
  p_lat numeric default null,
  p_lng numeric default null,
  p_accuracy numeric default null,
  p_device_id text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_work_date date;
  v_now timestamptz := now();
  v_record_id uuid;
  v_tz text;
  v_event public.attendance_event_type;
  v_clock_in timestamptz;
  v_break integer;
begin
  if not (
    public.is_self_employee(p_employee_id)
    or public.has_permission('attendance.manage')
  ) then
    raise exception 'Not authorized to record attendance for this employee';
  end if;

  v_event := p_event_type::public.attendance_event_type;

  select coalesce(e.default_timezone, 'Asia/Manila')
  into v_tz
  from public.employees e
  where e.id = p_employee_id;

  if v_tz is null then
    raise exception 'Employee not found';
  end if;

  v_work_date := (v_now at time zone v_tz)::date;

  insert into public.attendance_events (
    employee_id,
    event_type,
    server_recorded_at,
    latitude,
    longitude,
    accuracy_meters,
    device_id,
    source,
    created_by
  ) values (
    p_employee_id,
    v_event,
    v_now,
    p_lat,
    p_lng,
    p_accuracy,
    p_device_id,
    'pwa',
    (select auth.uid())
  )
  returning id into v_event_id;

  insert into public.attendance_records (employee_id, work_date, status)
  values (p_employee_id, v_work_date, 'incomplete')
  on conflict (employee_id, work_date) do nothing;

  select id, clock_in_at, coalesce(break_minutes, 0)
  into v_record_id, v_clock_in, v_break
  from public.attendance_records
  where employee_id = p_employee_id
    and work_date = v_work_date;

  update public.attendance_records
  set
    clock_in_at = case
      when v_event = 'clock_in' and clock_in_at is null then v_now
      else clock_in_at
    end,
    clock_out_at = case
      when v_event = 'clock_out' then v_now
      else clock_out_at
    end,
    worked_minutes = case
      when v_event = 'clock_out' and coalesce(clock_in_at, v_clock_in) is not null then
        greatest(
          0,
          (extract(epoch from (v_now - coalesce(clock_in_at, v_clock_in))) / 60)::int
            - v_break
        )
      else worked_minutes
    end,
    status = case
      when v_event = 'clock_out' and coalesce(clock_in_at, v_clock_in) is not null
        then 'present'::public.attendance_record_status
      when v_event = 'clock_in' then coalesce(
        nullif(status, 'absent'::public.attendance_record_status),
        'present'::public.attendance_record_status
      )
      else status
    end
  where id = v_record_id;

  return v_event_id;
end;
$$;

drop view if exists public.client_attendance_summary cascade;
create view public.client_attendance_summary
with (security_invoker = true)
as
select
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

-- Profiles: clients may see names of assigned staff only
drop policy if exists profiles_select_assigned_client on public.profiles;
create policy profiles_select_assigned_client
  on public.profiles for select to authenticated
  using (
    exists (
      select 1
      from public.employees e
      where e.profile_id = profiles.id
        and public.is_assigned_to_current_client(e.id)
        and public.has_permission('clients.employee_visibility')
    )
  );

drop policy if exists employees_select on public.employees;
create policy employees_select
  on public.employees for select to authenticated
  using (
    public.is_self_employee(id)
    or (
      public.is_internal_user()
      and (
        public.has_permission('employees.read')
        or public.has_permission('employees.manage')
      )
    )
    or (
      public.is_assigned_to_current_client(id)
      and public.has_permission('clients.employee_visibility')
    )
  );

drop policy if exists attendance_records_select on public.attendance_records;
create policy attendance_records_select
  on public.attendance_records for select to authenticated
  using (public.can_read_assigned_attendance(employee_id));

drop policy if exists shift_assignments_select on public.shift_assignments;
create policy shift_assignments_select
  on public.shift_assignments for select to authenticated
  using (public.can_read_assigned_attendance(employee_id));

drop policy if exists performance_kpis_select on public.performance_kpis;
create policy performance_kpis_select
  on public.performance_kpis for select to authenticated
  using (
    public.is_self_employee(employee_id)
    or (
      public.is_internal_user()
      and public.has_permission('performance.read')
    )
    or (
      visibility in ('client_visible', 'public')
      and public.is_assigned_to_current_client(employee_id)
      and public.has_permission('performance.read')
    )
  );

drop policy if exists invoices_select on public.invoices;
create policy invoices_select
  on public.invoices for select to authenticated
  using (
    (
      public.is_internal_user()
      and (
        public.has_permission('billing.read')
        or public.has_permission('billing.manage')
      )
    )
    or (
      public.is_client_member(client_organization_id)
      and status not in ('draft', 'void')
    )
  );

drop policy if exists payroll_periods_select on public.payroll_periods;
create policy payroll_periods_select
  on public.payroll_periods for select to authenticated
  using (
    public.is_internal_user()
    and (
      public.has_permission('payroll.read')
      or public.has_permission('payroll.manage')
      or public.has_permission('payroll.self')
    )
  );

-- Applicant memberships: isolate from staff login
update public.organization_memberships m
set membership_type = 'applicant'
where m.membership_type = 'internal'
  and not exists (
    select 1
    from public.membership_roles mr
    join public.roles r on r.id = mr.role_id
    where mr.membership_id = m.id
      and r.scope <> 'applicant'
  )
  and exists (
    select 1
    from public.membership_roles mr
    join public.roles r on r.id = mr.role_id
    where mr.membership_id = m.id
      and r.code = 'applicant'
  );
