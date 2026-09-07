-- Beepa Phase 2: workforce, attendance, leave, documents

-- Enums
create type public.employment_status as enum (
  'active', 'on_leave', 'suspended', 'terminated', 'resigned'
);
create type public.employment_type as enum (
  'regular', 'probationary', 'contractual', 'part_time', 'intern'
);
create type public.department_status as enum ('active', 'inactive');
create type public.assignment_type as enum ('internal', 'client');
create type public.assignment_status as enum (
  'active', 'pending', 'completed', 'cancelled'
);
create type public.schedule_type as enum ('fixed', 'flexible');
create type public.attendance_event_type as enum (
  'clock_in', 'break_start', 'break_end', 'clock_out'
);
create type public.attendance_source as enum ('pwa', 'web', 'admin');
create type public.attendance_record_status as enum (
  'present', 'late', 'absent', 'leave', 'rest_day', 'holiday', 'incomplete'
);
create type public.timesheet_approval_status as enum (
  'draft', 'employee_review', 'supervisor_review', 'client_review', 'finalized'
);
create type public.correction_request_status as enum (
  'pending', 'approved', 'rejected', 'cancelled'
);
create type public.overtime_request_status as enum (
  'pending', 'approved', 'rejected', 'cancelled'
);
create type public.shift_assignment_status as enum (
  'scheduled', 'in_progress', 'completed', 'cancelled', 'no_show'
);
create type public.shift_source as enum ('template', 'override', 'manual');
create type public.leave_unit as enum ('hours', 'days');
create type public.leave_request_status as enum (
  'pending', 'manager_approved', 'hr_approved', 'approved', 'rejected', 'cancelled'
);

create sequence if not exists public.employee_number_seq start 1;

-- Attendance policies (before assignments)
create table public.attendance_policies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  client_organization_id uuid references public.organizations (id) on delete cascade,
  name text not null,
  timezone text not null default 'Asia/Manila',
  schedule_type public.schedule_type not null default 'fixed',
  grace_minutes integer not null default 0,
  required_minutes_per_day integer,
  required_minutes_per_week integer,
  break_minutes integer not null default 60,
  auto_deduct_break boolean not null default true,
  overtime_enabled boolean not null default true,
  overtime_requires_approval boolean not null default true,
  client_timesheet_approval_required boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger attendance_policies_updated_at
  before update on public.attendance_policies
  for each row execute function extensions.moddatetime (updated_at);

create index attendance_policies_org_idx on public.attendance_policies (organization_id);
create index attendance_policies_client_idx on public.attendance_policies (client_organization_id);
create index attendance_policies_active_idx on public.attendance_policies (active);

-- Schedule templates
create table public.schedule_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  timezone text not null default 'Asia/Manila',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger schedule_templates_updated_at
  before update on public.schedule_templates
  for each row execute function extensions.moddatetime (updated_at);

create index schedule_templates_org_idx on public.schedule_templates (organization_id);

create table public.schedule_template_days (
  id uuid primary key default gen_random_uuid(),
  schedule_template_id uuid not null references public.schedule_templates (id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  is_rest_day boolean not null default false,
  start_time time,
  end_time time,
  break_minutes integer not null default 60,
  unique (schedule_template_id, day_of_week)
);

create index schedule_template_days_template_idx
  on public.schedule_template_days (schedule_template_id);

-- Departments / teams (manager FKs added after employees)
create table public.departments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  code text not null,
  manager_employee_id uuid,
  status public.department_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create trigger departments_updated_at
  before update on public.departments
  for each row execute function extensions.moddatetime (updated_at);

create index departments_org_idx on public.departments (organization_id);
create index departments_status_idx on public.departments (status);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  department_id uuid references public.departments (id) on delete set null,
  name text not null,
  team_lead_employee_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger teams_updated_at
  before update on public.teams
  for each row execute function extensions.moddatetime (updated_at);

create index teams_org_idx on public.teams (organization_id);
create index teams_department_idx on public.teams (department_id);

-- Employees
create table public.employees (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  profile_id uuid references public.profiles (id) on delete set null,
  employee_number text not null unique,
  work_email text,
  personal_email text,
  employment_status public.employment_status not null default 'active',
  employment_type public.employment_type not null default 'regular',
  job_title text not null default '',
  department_id uuid references public.departments (id) on delete set null,
  team_id uuid references public.teams (id) on delete set null,
  manager_employee_id uuid references public.employees (id) on delete set null,
  hire_date date,
  regularization_date date,
  termination_date date,
  default_timezone text not null default 'Asia/Manila',
  payroll_profile_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger employees_updated_at
  before update on public.employees
  for each row execute function extensions.moddatetime (updated_at);

create index employees_org_idx on public.employees (organization_id);
create index employees_profile_idx on public.employees (profile_id);
create index employees_department_idx on public.employees (department_id);
create index employees_team_idx on public.employees (team_id);
create index employees_status_idx on public.employees (employment_status);
create index employees_manager_idx on public.employees (manager_employee_id);

alter table public.departments
  add constraint departments_manager_employee_fk
  foreign key (manager_employee_id) references public.employees (id) on delete set null;

alter table public.teams
  add constraint teams_team_lead_employee_fk
  foreign key (team_lead_employee_id) references public.employees (id) on delete set null;

-- Employee assignments
create table public.employee_assignments (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  client_organization_id uuid references public.organizations (id) on delete cascade,
  assignment_type public.assignment_type not null,
  role_title text not null default '',
  start_date date not null,
  end_date date,
  status public.assignment_status not null default 'active',
  attendance_policy_id uuid references public.attendance_policies (id) on delete set null,
  schedule_template_id uuid references public.schedule_templates (id) on delete set null,
  account_manager_employee_id uuid references public.employees (id) on delete set null,
  billable boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger employee_assignments_updated_at
  before update on public.employee_assignments
  for each row execute function extensions.moddatetime (updated_at);

create index employee_assignments_employee_idx on public.employee_assignments (employee_id);
create index employee_assignments_client_idx on public.employee_assignments (client_organization_id);
create index employee_assignments_status_idx on public.employee_assignments (status);
create index employee_assignments_dates_idx on public.employee_assignments (start_date, end_date);

-- Holiday calendars
create table public.holiday_calendars (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  client_organization_id uuid references public.organizations (id) on delete cascade,
  name text not null,
  timezone text not null default 'Asia/Manila',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger holiday_calendars_updated_at
  before update on public.holiday_calendars
  for each row execute function extensions.moddatetime (updated_at);

create index holiday_calendars_org_idx on public.holiday_calendars (organization_id);
create index holiday_calendars_client_idx on public.holiday_calendars (client_organization_id);

create table public.holidays (
  id uuid primary key default gen_random_uuid(),
  holiday_calendar_id uuid not null references public.holiday_calendars (id) on delete cascade,
  name text not null,
  holiday_date date not null,
  is_recurring boolean not null default false,
  created_at timestamptz not null default now(),
  unique (holiday_calendar_id, holiday_date)
);

create index holidays_calendar_date_idx on public.holidays (holiday_calendar_id, holiday_date);

-- Shift assignments
create table public.shift_assignments (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  assignment_id uuid references public.employee_assignments (id) on delete set null,
  work_date date not null,
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  status public.shift_assignment_status not null default 'scheduled',
  source public.shift_source not null default 'template',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, work_date)
);

create trigger shift_assignments_updated_at
  before update on public.shift_assignments
  for each row execute function extensions.moddatetime (updated_at);

create index shift_assignments_employee_date_idx
  on public.shift_assignments (employee_id, work_date);
create index shift_assignments_status_idx on public.shift_assignments (status);

-- Attendance events (immutable log)
create table public.attendance_events (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  shift_assignment_id uuid references public.shift_assignments (id) on delete set null,
  event_type public.attendance_event_type not null,
  server_recorded_at timestamptz not null default now(),
  client_reported_at timestamptz,
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  accuracy_meters numeric(8, 2),
  ip_address inet,
  device_id text,
  source public.attendance_source not null default 'pwa',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index attendance_events_employee_idx on public.attendance_events (employee_id);
create index attendance_events_employee_recorded_idx
  on public.attendance_events (employee_id, server_recorded_at desc);
create index attendance_events_shift_idx on public.attendance_events (shift_assignment_id);

-- Attendance records (daily summary)
create table public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  work_date date not null,
  shift_assignment_id uuid references public.shift_assignments (id) on delete set null,
  clock_in_at timestamptz,
  clock_out_at timestamptz,
  worked_minutes integer not null default 0,
  break_minutes integer not null default 0,
  late_minutes integer not null default 0,
  undertime_minutes integer not null default 0,
  overtime_minutes integer not null default 0,
  status public.attendance_record_status not null default 'incomplete',
  approval_status public.timesheet_approval_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, work_date)
);

create trigger attendance_records_updated_at
  before update on public.attendance_records
  for each row execute function extensions.moddatetime (updated_at);

create index attendance_records_employee_date_idx
  on public.attendance_records (employee_id, work_date desc);
create index attendance_records_status_idx on public.attendance_records (status);
create index attendance_records_approval_idx on public.attendance_records (approval_status);

-- Attendance correction requests
create table public.attendance_correction_requests (
  id uuid primary key default gen_random_uuid(),
  attendance_record_id uuid not null references public.attendance_records (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  requested_clock_in_at timestamptz,
  requested_clock_out_at timestamptz,
  reason text not null,
  attachment_url text,
  status public.correction_request_status not null default 'pending',
  reviewed_by uuid references public.profiles (id) on delete set null,
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger attendance_correction_requests_updated_at
  before update on public.attendance_correction_requests
  for each row execute function extensions.moddatetime (updated_at);

create index attendance_correction_requests_employee_idx
  on public.attendance_correction_requests (employee_id);
create index attendance_correction_requests_status_idx
  on public.attendance_correction_requests (status);

-- Overtime requests
create table public.overtime_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  work_date date not null,
  requested_minutes integer not null check (requested_minutes > 0),
  reason text not null,
  status public.overtime_request_status not null default 'pending',
  approved_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger overtime_requests_updated_at
  before update on public.overtime_requests
  for each row execute function extensions.moddatetime (updated_at);

create index overtime_requests_employee_idx on public.overtime_requests (employee_id);
create index overtime_requests_status_idx on public.overtime_requests (status);
create index overtime_requests_work_date_idx on public.overtime_requests (work_date);

-- Leave types
create table public.leave_types (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  code text not null,
  name text not null,
  paid boolean not null default true,
  unit public.leave_unit not null default 'days',
  requires_attachment boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create trigger leave_types_updated_at
  before update on public.leave_types
  for each row execute function extensions.moddatetime (updated_at);

create index leave_types_org_idx on public.leave_types (organization_id);
create index leave_types_active_idx on public.leave_types (active);

-- Leave balances
create table public.leave_balances (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  leave_type_id uuid not null references public.leave_types (id) on delete cascade,
  period_year integer not null,
  entitled_minutes integer not null default 0,
  used_minutes integer not null default 0,
  pending_minutes integer not null default 0,
  adjustment_minutes integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, leave_type_id, period_year)
);

create trigger leave_balances_updated_at
  before update on public.leave_balances
  for each row execute function extensions.moddatetime (updated_at);

create index leave_balances_employee_idx on public.leave_balances (employee_id);
create index leave_balances_year_idx on public.leave_balances (period_year);

-- Leave requests
create table public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  leave_type_id uuid not null references public.leave_types (id) on delete restrict,
  start_at timestamptz not null,
  end_at timestamptz not null,
  requested_minutes integer not null check (requested_minutes > 0),
  reason text not null default '',
  attachment_url text,
  status public.leave_request_status not null default 'pending',
  current_approver uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at > start_at)
);

create trigger leave_requests_updated_at
  before update on public.leave_requests
  for each row execute function extensions.moddatetime (updated_at);

create index leave_requests_employee_idx on public.leave_requests (employee_id);
create index leave_requests_status_idx on public.leave_requests (status);
create index leave_requests_dates_idx on public.leave_requests (start_at, end_at);

-- Documents metadata
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  employee_id uuid references public.employees (id) on delete cascade,
  client_organization_id uuid references public.organizations (id) on delete cascade,
  category text not null,
  title text not null,
  storage_bucket text not null,
  storage_path text not null,
  mime_type text,
  size_bytes bigint,
  visibility public.visibility not null default 'private',
  uploaded_by uuid references public.profiles (id) on delete set null,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger documents_updated_at
  before update on public.documents
  for each row execute function extensions.moddatetime (updated_at);

create index documents_org_idx on public.documents (organization_id);
create index documents_employee_idx on public.documents (employee_id);
create index documents_client_idx on public.documents (client_organization_id);
create index documents_category_idx on public.documents (category);

-- Helper functions
create or replace function public.generate_employee_number()
returns text
language plpgsql
as $$
begin
  return 'BEE-' || lpad(nextval('public.employee_number_seq')::text, 5, '0');
end;
$$;

create or replace function public.is_self_employee(p_employee_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.employees e
    where e.id = p_employee_id
      and e.profile_id = (select auth.uid())
  );
$$;

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

  select id into v_record_id
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
    status = case
      when v_event = 'clock_out' and clock_in_at is not null then 'present'::public.attendance_record_status
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

grant execute on function public.generate_employee_number() to authenticated;
grant execute on function public.is_self_employee(uuid) to authenticated;
grant execute on function public.clock_event(uuid, text, numeric, numeric, numeric, text) to authenticated;

-- RLS
alter table public.attendance_policies enable row level security;
alter table public.schedule_templates enable row level security;
alter table public.schedule_template_days enable row level security;
alter table public.departments enable row level security;
alter table public.teams enable row level security;
alter table public.employees enable row level security;
alter table public.employee_assignments enable row level security;
alter table public.holiday_calendars enable row level security;
alter table public.holidays enable row level security;
alter table public.shift_assignments enable row level security;
alter table public.attendance_events enable row level security;
alter table public.attendance_records enable row level security;
alter table public.attendance_correction_requests enable row level security;
alter table public.overtime_requests enable row level security;
alter table public.leave_types enable row level security;
alter table public.leave_balances enable row level security;
alter table public.leave_requests enable row level security;
alter table public.documents enable row level security;

-- Employees
create policy employees_select
  on public.employees for select to authenticated
  using (
    public.is_self_employee(id)
    or public.has_permission('employees.read')
    or public.has_permission('employees.manage')
  );

create policy employees_update
  on public.employees for update to authenticated
  using (
    public.is_self_employee(id)
    or public.has_permission('employees.manage')
  )
  with check (
    public.is_self_employee(id)
    or public.has_permission('employees.manage')
  );

create policy employees_insert
  on public.employees for insert to authenticated
  with check (public.has_permission('employees.manage'));

create policy employees_delete
  on public.employees for delete to authenticated
  using (public.has_permission('employees.manage'));

-- Departments / teams (internal HR)
create policy departments_select
  on public.departments for select to authenticated
  using (
    public.is_internal_user()
    or public.has_permission('employees.read')
  );

create policy departments_manage
  on public.departments for all to authenticated
  using (public.has_permission('employees.manage'))
  with check (public.has_permission('employees.manage'));

create policy teams_select
  on public.teams for select to authenticated
  using (
    public.is_internal_user()
    or public.has_permission('employees.read')
  );

create policy teams_manage
  on public.teams for all to authenticated
  using (public.has_permission('employees.manage'))
  with check (public.has_permission('employees.manage'));

-- Assignments
create policy employee_assignments_select
  on public.employee_assignments for select to authenticated
  using (
    public.is_self_employee(employee_id)
    or public.has_permission('employees.read')
    or (
      client_organization_id is not null
      and public.can_access_client(client_organization_id)
      and public.has_permission('clients.employee_visibility')
    )
  );

create policy employee_assignments_manage
  on public.employee_assignments for all to authenticated
  using (public.has_permission('employees.manage'))
  with check (public.has_permission('employees.manage'));

-- Attendance policies / schedules
create policy attendance_policies_select
  on public.attendance_policies for select to authenticated
  using (
    public.is_internal_user()
    or public.has_permission('attendance.read')
  );

create policy attendance_policies_manage
  on public.attendance_policies for all to authenticated
  using (public.has_permission('attendance.manage'))
  with check (public.has_permission('attendance.manage'));

create policy schedule_templates_select
  on public.schedule_templates for select to authenticated
  using (
    public.is_internal_user()
    or public.has_permission('attendance.read')
    or public.has_permission('attendance.self')
  );

create policy schedule_templates_manage
  on public.schedule_templates for all to authenticated
  using (public.has_permission('attendance.manage'))
  with check (public.has_permission('attendance.manage'));

create policy schedule_template_days_select
  on public.schedule_template_days for select to authenticated
  using (
    public.is_internal_user()
    or public.has_permission('attendance.read')
    or public.has_permission('attendance.self')
  );

create policy schedule_template_days_manage
  on public.schedule_template_days for all to authenticated
  using (public.has_permission('attendance.manage'))
  with check (public.has_permission('attendance.manage'));

-- Holidays
create policy holiday_calendars_select
  on public.holiday_calendars for select to authenticated
  using (public.is_internal_user() or public.has_permission('attendance.read'));

create policy holiday_calendars_manage
  on public.holiday_calendars for all to authenticated
  using (public.has_permission('attendance.manage'))
  with check (public.has_permission('attendance.manage'));

create policy holidays_select
  on public.holidays for select to authenticated
  using (public.is_internal_user() or public.has_permission('attendance.read'));

create policy holidays_manage
  on public.holidays for all to authenticated
  using (public.has_permission('attendance.manage'))
  with check (public.has_permission('attendance.manage'));

-- Shifts
create policy shift_assignments_select
  on public.shift_assignments for select to authenticated
  using (
    public.is_self_employee(employee_id)
    or public.has_permission('attendance.read')
  );

create policy shift_assignments_manage
  on public.shift_assignments for all to authenticated
  using (public.has_permission('attendance.manage'))
  with check (public.has_permission('attendance.manage'));

-- Attendance events (immutable — no update/delete policies)
create policy attendance_events_select
  on public.attendance_events for select to authenticated
  using (
    public.is_self_employee(employee_id)
    or public.has_permission('attendance.read')
  );

create policy attendance_events_insert
  on public.attendance_events for insert to authenticated
  with check (
    public.is_self_employee(employee_id)
    or public.has_permission('attendance.manage')
  );

-- Attendance records
create policy attendance_records_select
  on public.attendance_records for select to authenticated
  using (
    public.is_self_employee(employee_id)
    or public.has_permission('attendance.read')
  );

create policy attendance_records_insert
  on public.attendance_records for insert to authenticated
  with check (
    public.has_permission('attendance.manage')
    or public.has_permission('attendance.correct')
  );

create policy attendance_records_update
  on public.attendance_records for update to authenticated
  using (
    public.has_permission('attendance.manage')
    or public.has_permission('attendance.correct')
    or (
      public.is_self_employee(employee_id)
      and public.has_permission('attendance.self')
      and approval_status = 'draft'
    )
  )
  with check (
    public.has_permission('attendance.manage')
    or public.has_permission('attendance.correct')
    or (
      public.is_self_employee(employee_id)
      and public.has_permission('attendance.self')
    )
  );

-- Correction / overtime
create policy attendance_correction_requests_select
  on public.attendance_correction_requests for select to authenticated
  using (
    public.is_self_employee(employee_id)
    or public.has_permission('attendance.read')
    or public.has_permission('attendance.approve')
  );

create policy attendance_correction_requests_insert
  on public.attendance_correction_requests for insert to authenticated
  with check (
    public.is_self_employee(employee_id)
    and public.has_permission('attendance.self')
  );

create policy attendance_correction_requests_update
  on public.attendance_correction_requests for update to authenticated
  using (
    public.is_self_employee(employee_id)
    or public.has_permission('attendance.approve')
    or public.has_permission('attendance.manage')
  )
  with check (
    public.is_self_employee(employee_id)
    or public.has_permission('attendance.approve')
    or public.has_permission('attendance.manage')
  );

create policy overtime_requests_select
  on public.overtime_requests for select to authenticated
  using (
    public.is_self_employee(employee_id)
    or public.has_permission('attendance.read')
    or public.has_permission('attendance.approve')
  );

create policy overtime_requests_insert
  on public.overtime_requests for insert to authenticated
  with check (
    public.is_self_employee(employee_id)
    and public.has_permission('attendance.self')
  );

create policy overtime_requests_update
  on public.overtime_requests for update to authenticated
  using (
    public.is_self_employee(employee_id)
    or public.has_permission('attendance.approve')
    or public.has_permission('attendance.manage')
  )
  with check (
    public.is_self_employee(employee_id)
    or public.has_permission('attendance.approve')
    or public.has_permission('attendance.manage')
  );

-- Leave
create policy leave_types_select
  on public.leave_types for select to authenticated
  using (
    public.is_internal_user()
    or public.has_permission('leave.read')
    or public.has_permission('leave.self')
  );

create policy leave_types_manage
  on public.leave_types for all to authenticated
  using (public.has_permission('leave.manage'))
  with check (public.has_permission('leave.manage'));

create policy leave_balances_select
  on public.leave_balances for select to authenticated
  using (
    public.is_self_employee(employee_id)
    or public.has_permission('leave.read')
  );

create policy leave_balances_manage
  on public.leave_balances for all to authenticated
  using (public.has_permission('leave.manage'))
  with check (public.has_permission('leave.manage'));

create policy leave_requests_select
  on public.leave_requests for select to authenticated
  using (
    public.is_self_employee(employee_id)
    or public.has_permission('leave.read')
    or public.has_permission('leave.approve')
  );

create policy leave_requests_insert
  on public.leave_requests for insert to authenticated
  with check (
    public.is_self_employee(employee_id)
    and public.has_permission('leave.self')
  );

create policy leave_requests_update
  on public.leave_requests for update to authenticated
  using (
    public.is_self_employee(employee_id)
    or public.has_permission('leave.approve')
    or public.has_permission('leave.manage')
  )
  with check (
    public.is_self_employee(employee_id)
    or public.has_permission('leave.approve')
    or public.has_permission('leave.manage')
  );

-- Documents
create policy documents_select
  on public.documents for select to authenticated
  using (
    (
      employee_id is not null
      and public.is_self_employee(employee_id)
    )
    or public.has_permission('employees.documents.read')
    or public.has_permission('employees.documents.manage')
    or (
      client_organization_id is not null
      and public.can_access_client(client_organization_id)
      and visibility in ('client_visible', 'public')
    )
  );

create policy documents_insert
  on public.documents for insert to authenticated
  with check (
    public.has_permission('employees.documents.manage')
    or (
      employee_id is not null
      and public.is_self_employee(employee_id)
    )
  );

create policy documents_update
  on public.documents for update to authenticated
  using (public.has_permission('employees.documents.manage'))
  with check (public.has_permission('employees.documents.manage'));

create policy documents_delete
  on public.documents for delete to authenticated
  using (public.has_permission('employees.documents.manage'));

-- Seed: leave types + default attendance policy for Beepa
insert into public.leave_types (organization_id, code, name, paid, unit, requires_attachment)
values
  ('11111111-1111-1111-1111-111111111111', 'PTO', 'PTO', true, 'days', false),
  ('11111111-1111-1111-1111-111111111111', 'UPTO', 'UPTO', false, 'days', false),
  ('11111111-1111-1111-1111-111111111111', 'SICK', 'Sick Leave', true, 'days', true),
  ('11111111-1111-1111-1111-111111111111', 'VACATION', 'Vacation Leave', true, 'days', false),
  ('11111111-1111-1111-1111-111111111111', 'EMERGENCY', 'Emergency Leave', true, 'days', false),
  ('11111111-1111-1111-1111-111111111111', 'BEREAVEMENT', 'Bereavement Leave', true, 'days', false)
on conflict (organization_id, code) do nothing;

insert into public.attendance_policies (
  id,
  organization_id,
  name,
  timezone,
  schedule_type,
  grace_minutes,
  required_minutes_per_day,
  break_minutes,
  auto_deduct_break,
  overtime_enabled,
  overtime_requires_approval,
  client_timesheet_approval_required,
  active
)
values (
  '33333333-3333-3333-3333-333333333301',
  '11111111-1111-1111-1111-111111111111',
  'Beepa Default Attendance Policy',
  'Asia/Manila',
  'fixed',
  15,
  480,
  60,
  true,
  true,
  true,
  false,
  true
)
on conflict (id) do nothing;
