-- Beepa Phase 2: HR relations, payroll, commissions

-- Enums
create type public.nte_case_status as enum (
  'draft', 'issued', 'awaiting_response', 'under_review', 'resolved'
);
create type public.cash_advance_status as enum (
  'pending', 'hr_review', 'finance_review', 'approved', 'rejected', 'released', 'completed', 'cancelled'
);
create type public.pay_frequency as enum ('semi_monthly', 'monthly', 'weekly', 'hourly');
create type public.compensation_type as enum ('monthly_salary', 'hourly', 'daily');
create type public.payroll_period_status as enum (
  'draft', 'preparing', 'review', 'approval', 'finalized', 'disbursed', 'closed'
);
create type public.payroll_record_status as enum (
  'draft', 'calculated', 'review', 'approved', 'finalized', 'paid', 'void'
);
create type public.payroll_component_type as enum ('earning', 'deduction', 'adjustment');
create type public.commission_record_status as enum (
  'draft', 'review', 'approved', 'included_in_payroll'
);

-- NTE / disciplinary
create table public.nte_cases (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  case_number text not null unique,
  incident_date date not null,
  incident_type text not null,
  subject text not null,
  description text not null,
  evidence_urls jsonb not null default '[]'::jsonb,
  issued_by uuid references public.profiles (id) on delete set null,
  issued_at timestamptz,
  response_due_at timestamptz,
  status public.nte_case_status not null default 'draft',
  resolution_type text,
  resolution_notes text,
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger nte_cases_updated_at
  before update on public.nte_cases
  for each row execute function extensions.moddatetime (updated_at);

create index nte_cases_employee_idx on public.nte_cases (employee_id);
create index nte_cases_status_idx on public.nte_cases (status);

create table public.nte_responses (
  id uuid primary key default gen_random_uuid(),
  nte_case_id uuid not null references public.nte_cases (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  response_text text not null,
  attachment_urls jsonb not null default '[]'::jsonb,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index nte_responses_case_idx on public.nte_responses (nte_case_id);
create index nte_responses_employee_idx on public.nte_responses (employee_id);

create table public.disciplinary_actions (
  id uuid primary key default gen_random_uuid(),
  nte_case_id uuid not null references public.nte_cases (id) on delete cascade,
  action_type text not null,
  effective_date date not null,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index disciplinary_actions_case_idx on public.disciplinary_actions (nte_case_id);

-- Cash advances
create table public.cash_advance_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  requested_amount numeric(14, 2) not null check (requested_amount > 0),
  approved_amount numeric(14, 2) check (approved_amount is null or approved_amount >= 0),
  reason text not null,
  requested_repayment_periods integer,
  status public.cash_advance_status not null default 'pending',
  hr_reviewed_by uuid references public.profiles (id) on delete set null,
  finance_reviewed_by uuid references public.profiles (id) on delete set null,
  approved_by uuid references public.profiles (id) on delete set null,
  released_at timestamptz,
  remaining_balance numeric(14, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger cash_advance_requests_updated_at
  before update on public.cash_advance_requests
  for each row execute function extensions.moddatetime (updated_at);

create index cash_advance_requests_employee_idx on public.cash_advance_requests (employee_id);
create index cash_advance_requests_status_idx on public.cash_advance_requests (status);

-- Payroll profiles
create table public.payroll_profiles (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null unique references public.employees (id) on delete cascade,
  pay_frequency public.pay_frequency not null default 'semi_monthly',
  compensation_type public.compensation_type not null default 'monthly_salary',
  base_salary numeric(14, 2),
  hourly_rate numeric(14, 2),
  daily_rate numeric(14, 2),
  currency text not null default 'PHP',
  overtime_multiplier numeric(6, 2) not null default 1.25,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger payroll_profiles_updated_at
  before update on public.payroll_profiles
  for each row execute function extensions.moddatetime (updated_at);

create index payroll_profiles_active_idx on public.payroll_profiles (active);

alter table public.employees
  add constraint employees_payroll_profile_fk
  foreign key (payroll_profile_id) references public.payroll_profiles (id) on delete set null;

-- Payroll periods
create table public.payroll_periods (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  start_date date not null,
  end_date date not null,
  pay_date date not null,
  status public.payroll_period_status not null default 'draft',
  created_by uuid references public.profiles (id) on delete set null,
  approved_by uuid references public.profiles (id) on delete set null,
  finalized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create trigger payroll_periods_updated_at
  before update on public.payroll_periods
  for each row execute function extensions.moddatetime (updated_at);

create index payroll_periods_org_idx on public.payroll_periods (organization_id);
create index payroll_periods_status_idx on public.payroll_periods (status);
create index payroll_periods_dates_idx on public.payroll_periods (start_date, end_date);

-- Payroll records
create table public.payroll_records (
  id uuid primary key default gen_random_uuid(),
  payroll_period_id uuid not null references public.payroll_periods (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  basic_pay numeric(14, 2) not null default 0,
  worked_minutes integer not null default 0,
  overtime_minutes integer not null default 0,
  overtime_pay numeric(14, 2) not null default 0,
  undertime_minutes integer not null default 0,
  undertime_deduction numeric(14, 2) not null default 0,
  absence_deduction numeric(14, 2) not null default 0,
  paid_leave_amount numeric(14, 2) not null default 0,
  unpaid_leave_deduction numeric(14, 2) not null default 0,
  allowances numeric(14, 2) not null default 0,
  bonuses numeric(14, 2) not null default 0,
  incentives numeric(14, 2) not null default 0,
  commissions numeric(14, 2) not null default 0,
  cash_advance_deduction numeric(14, 2) not null default 0,
  other_deductions numeric(14, 2) not null default 0,
  manual_adjustments numeric(14, 2) not null default 0,
  gross_pay numeric(14, 2) not null default 0,
  total_deductions numeric(14, 2) not null default 0,
  net_pay numeric(14, 2) not null default 0,
  status public.payroll_record_status not null default 'draft',
  calculation_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (payroll_period_id, employee_id)
);

create trigger payroll_records_updated_at
  before update on public.payroll_records
  for each row execute function extensions.moddatetime (updated_at);

create index payroll_records_period_idx on public.payroll_records (payroll_period_id);
create index payroll_records_employee_idx on public.payroll_records (employee_id);
create index payroll_records_status_idx on public.payroll_records (status);

create table public.payroll_components (
  id uuid primary key default gen_random_uuid(),
  payroll_record_id uuid not null references public.payroll_records (id) on delete cascade,
  type public.payroll_component_type not null,
  code text not null,
  label text not null,
  quantity numeric(12, 4),
  rate numeric(14, 2),
  amount numeric(14, 2) not null,
  source_type text,
  source_id uuid,
  created_at timestamptz not null default now()
);

create index payroll_components_record_idx on public.payroll_components (payroll_record_id);

create table public.payslips (
  id uuid primary key default gen_random_uuid(),
  payroll_record_id uuid not null unique references public.payroll_records (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  generated_at timestamptz not null default now(),
  pdf_path text,
  version integer not null default 1,
  created_at timestamptz not null default now()
);

create index payslips_employee_idx on public.payslips (employee_id);

-- Cash advance deductions (FK to payroll_records now possible)
create table public.cash_advance_deductions (
  id uuid primary key default gen_random_uuid(),
  cash_advance_id uuid not null references public.cash_advance_requests (id) on delete cascade,
  payroll_record_id uuid references public.payroll_records (id) on delete set null,
  amount numeric(14, 2) not null check (amount > 0),
  deducted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index cash_advance_deductions_advance_idx
  on public.cash_advance_deductions (cash_advance_id);
create index cash_advance_deductions_payroll_idx
  on public.cash_advance_deductions (payroll_record_id);

-- Commissions
create table public.commission_periods (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  start_date date not null,
  end_date date not null,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger commission_periods_updated_at
  before update on public.commission_periods
  for each row execute function extensions.moddatetime (updated_at);

create index commission_periods_org_idx on public.commission_periods (organization_id);

create table public.commission_records (
  id uuid primary key default gen_random_uuid(),
  commission_period_id uuid not null references public.commission_periods (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  basis_description text not null default '',
  base_amount numeric(14, 2),
  commission_rate numeric(8, 4),
  calculated_amount numeric(14, 2) not null default 0,
  adjustment_amount numeric(14, 2) not null default 0,
  final_amount numeric(14, 2) not null default 0,
  status public.commission_record_status not null default 'draft',
  approved_by uuid references public.profiles (id) on delete set null,
  payroll_record_id uuid references public.payroll_records (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger commission_records_updated_at
  before update on public.commission_records
  for each row execute function extensions.moddatetime (updated_at);

create index commission_records_period_idx on public.commission_records (commission_period_id);
create index commission_records_employee_idx on public.commission_records (employee_id);
create index commission_records_status_idx on public.commission_records (status);

-- ponytail: placeholder payroll calculation — full rules deferred to finance module
create or replace function public.calculate_payroll_record(p_payroll_record_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_record public.payroll_records%rowtype;
  v_profile public.payroll_profiles%rowtype;
begin
  if not public.has_permission('payroll.manage') then
    raise exception 'Not authorized to calculate payroll';
  end if;

  select * into v_record from public.payroll_records where id = p_payroll_record_id;
  if not found then
    raise exception 'Payroll record not found';
  end if;

  select * into v_profile from public.payroll_profiles where employee_id = v_record.employee_id;

  update public.payroll_records
  set
    basic_pay = coalesce(v_profile.base_salary, 0),
    gross_pay = coalesce(v_profile.base_salary, 0)
      + overtime_pay + paid_leave_amount + allowances + bonuses + incentives + commissions,
    total_deductions = undertime_deduction + absence_deduction + unpaid_leave_deduction
      + cash_advance_deduction + other_deductions,
    net_pay = greatest(
      coalesce(v_profile.base_salary, 0)
        + overtime_pay + paid_leave_amount + allowances + bonuses + incentives + commissions
        + manual_adjustments
        - undertime_deduction - absence_deduction - unpaid_leave_deduction
        - cash_advance_deduction - other_deductions,
      0
    ),
    status = 'calculated',
    calculation_snapshot = jsonb_build_object(
      'calculated_at', now(),
      'engine', 'stub_v1',
      'note', 'Full attendance/leave/OT integration not yet implemented',
      'profile', to_jsonb(v_profile)
    )
  where id = p_payroll_record_id;
end;
$$;

grant execute on function public.calculate_payroll_record(uuid) to authenticated;

-- RLS (clients NEVER see payroll)
alter table public.nte_cases enable row level security;
alter table public.nte_responses enable row level security;
alter table public.disciplinary_actions enable row level security;
alter table public.cash_advance_requests enable row level security;
alter table public.cash_advance_deductions enable row level security;
alter table public.payroll_profiles enable row level security;
alter table public.payroll_periods enable row level security;
alter table public.payroll_records enable row level security;
alter table public.payroll_components enable row level security;
alter table public.payslips enable row level security;
alter table public.commission_periods enable row level security;
alter table public.commission_records enable row level security;

-- NTE
create policy nte_cases_select
  on public.nte_cases for select to authenticated
  using (
    public.is_self_employee(employee_id)
    or public.has_permission('nte.read')
    or public.has_permission('nte.manage')
  );

create policy nte_cases_manage
  on public.nte_cases for all to authenticated
  using (public.has_permission('nte.manage'))
  with check (public.has_permission('nte.manage'));

create policy nte_responses_select
  on public.nte_responses for select to authenticated
  using (
    public.is_self_employee(employee_id)
    or public.has_permission('nte.read')
    or public.has_permission('nte.manage')
  );

create policy nte_responses_insert
  on public.nte_responses for insert to authenticated
  with check (
    public.is_self_employee(employee_id)
    and public.has_permission('nte.self')
  );

create policy disciplinary_actions_select
  on public.disciplinary_actions for select to authenticated
  using (
    public.has_permission('nte.read')
    or public.has_permission('nte.manage')
    or exists (
      select 1 from public.nte_cases c
      where c.id = nte_case_id and public.is_self_employee(c.employee_id)
    )
  );

create policy disciplinary_actions_manage
  on public.disciplinary_actions for all to authenticated
  using (public.has_permission('nte.manage'))
  with check (public.has_permission('nte.manage'));

-- Cash advances
create policy cash_advance_requests_select
  on public.cash_advance_requests for select to authenticated
  using (
    public.is_self_employee(employee_id)
    or public.has_permission('cash_advance.read')
    or public.has_permission('cash_advance.manage')
    or public.has_permission('cash_advance.approve')
  );

create policy cash_advance_requests_insert
  on public.cash_advance_requests for insert to authenticated
  with check (
    public.is_self_employee(employee_id)
    and public.has_permission('cash_advance.self')
  );

create policy cash_advance_requests_update
  on public.cash_advance_requests for update to authenticated
  using (
    public.is_self_employee(employee_id)
    or public.has_permission('cash_advance.manage')
    or public.has_permission('cash_advance.approve')
  )
  with check (
    public.is_self_employee(employee_id)
    or public.has_permission('cash_advance.manage')
    or public.has_permission('cash_advance.approve')
  );

create policy cash_advance_deductions_select
  on public.cash_advance_deductions for select to authenticated
  using (
    public.has_permission('cash_advance.read')
    or public.has_permission('payroll.read')
    or public.has_permission('payroll.manage')
    or exists (
      select 1 from public.cash_advance_requests r
      where r.id = cash_advance_id and public.is_self_employee(r.employee_id)
    )
  );

create policy cash_advance_deductions_manage
  on public.cash_advance_deductions for all to authenticated
  using (public.has_permission('payroll.manage'))
  with check (public.has_permission('payroll.manage'));

-- Payroll (internal only — block all client memberships explicitly via is_internal_user or permissions)
create policy payroll_profiles_select
  on public.payroll_profiles for select to authenticated
  using (
    public.is_internal_user()
    and (
      public.is_self_employee(employee_id)
      or public.has_permission('payroll.read')
      or public.has_permission('payroll.manage')
    )
  );

create policy payroll_profiles_manage
  on public.payroll_profiles for all to authenticated
  using (
    public.is_internal_user()
    and public.has_permission('payroll.manage')
  )
  with check (
    public.is_internal_user()
    and public.has_permission('payroll.manage')
  );

create policy payroll_periods_select
  on public.payroll_periods for select to authenticated
  using (
    public.is_internal_user()
    and (
      public.has_permission('payroll.read')
      or public.has_permission('payroll.manage')
    )
  );

create policy payroll_periods_manage
  on public.payroll_periods for all to authenticated
  using (
    public.is_internal_user()
    and public.has_permission('payroll.manage')
  )
  with check (
    public.is_internal_user()
    and public.has_permission('payroll.manage')
  );

create policy payroll_records_select
  on public.payroll_records for select to authenticated
  using (
    public.is_internal_user()
    and (
      public.is_self_employee(employee_id)
      or public.has_permission('payroll.read')
      or public.has_permission('payroll.manage')
    )
  );

create policy payroll_records_manage
  on public.payroll_records for all to authenticated
  using (
    public.is_internal_user()
    and public.has_permission('payroll.manage')
  )
  with check (
    public.is_internal_user()
    and public.has_permission('payroll.manage')
  );

create policy payroll_components_select
  on public.payroll_components for select to authenticated
  using (
    public.is_internal_user()
    and exists (
      select 1 from public.payroll_records pr
      where pr.id = payroll_record_id
        and (
          public.is_self_employee(pr.employee_id)
          or public.has_permission('payroll.read')
          or public.has_permission('payroll.manage')
        )
    )
  );

create policy payroll_components_manage
  on public.payroll_components for all to authenticated
  using (
    public.is_internal_user()
    and public.has_permission('payroll.manage')
  )
  with check (
    public.is_internal_user()
    and public.has_permission('payroll.manage')
  );

create policy payslips_select
  on public.payslips for select to authenticated
  using (
    public.is_internal_user()
    and (
      (
        public.is_self_employee(employee_id)
        and public.has_permission('payroll.self')
      )
      or public.has_permission('payroll.read')
      or public.has_permission('payroll.manage')
    )
  );

create policy payslips_manage
  on public.payslips for all to authenticated
  using (
    public.is_internal_user()
    and public.has_permission('payroll.manage')
  )
  with check (
    public.is_internal_user()
    and public.has_permission('payroll.manage')
  );

-- Commissions
create policy commission_periods_select
  on public.commission_periods for select to authenticated
  using (
    public.is_internal_user()
    and (
      public.has_permission('payroll.read')
      or public.has_permission('payroll.manage')
    )
  );

create policy commission_periods_manage
  on public.commission_periods for all to authenticated
  using (
    public.is_internal_user()
    and public.has_permission('payroll.manage')
  )
  with check (
    public.is_internal_user()
    and public.has_permission('payroll.manage')
  );

create policy commission_records_select
  on public.commission_records for select to authenticated
  using (
    public.is_internal_user()
    and (
      public.is_self_employee(employee_id)
      or public.has_permission('payroll.read')
      or public.has_permission('payroll.manage')
    )
  );

create policy commission_records_manage
  on public.commission_records for all to authenticated
  using (
    public.is_internal_user()
    and public.has_permission('payroll.manage')
  )
  with check (
    public.is_internal_user()
    and public.has_permission('payroll.manage')
  );
