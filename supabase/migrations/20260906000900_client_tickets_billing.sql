-- Beepa Phase 2: clients, tickets, billing, performance

-- Enums
create type public.ticket_category as enum (
  'employee_concern', 'attendance', 'schedule_change', 'performance',
  'replacement_request', 'additional_employee', 'payroll', 'billing',
  'hr', 'technical', 'implementation', 'general'
);
create type public.ticket_priority as enum ('low', 'normal', 'high', 'urgent');
create type public.ticket_status as enum (
  'new', 'assigned', 'in_progress', 'waiting_for_client',
  'resolved', 'closed'
);
create type public.performance_reviewer_type as enum ('self', 'manager', 'client', 'hr');
create type public.performance_review_status as enum (
  'draft', 'in_progress', 'submitted', 'approved', 'archived'
);
create type public.invoice_status as enum (
  'draft', 'issued', 'sent', 'partially_paid', 'paid', 'overdue', 'void'
);
create type public.billing_account_status as enum ('active', 'inactive', 'suspended');

create sequence if not exists public.ticket_number_seq start 1;

-- Client profiles
create table public.client_profiles (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  industry text,
  website text,
  primary_contact_name text,
  primary_contact_email text,
  relationship_start_date date,
  contract_start_date date,
  contract_end_date date,
  account_manager_employee_id uuid references public.employees (id) on delete set null,
  billing_currency text not null default 'USD',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger client_profiles_updated_at
  before update on public.client_profiles
  for each row execute function extensions.moddatetime (updated_at);

create index client_profiles_account_manager_idx
  on public.client_profiles (account_manager_employee_id);

create table public.client_contacts (
  id uuid primary key default gen_random_uuid(),
  client_organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  email text,
  phone text,
  job_title text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger client_contacts_updated_at
  before update on public.client_contacts
  for each row execute function extensions.moddatetime (updated_at);

create index client_contacts_client_idx on public.client_contacts (client_organization_id);

create table public.client_settings (
  client_organization_id uuid primary key references public.organizations (id) on delete cascade,
  allow_attendance_view boolean not null default true,
  allow_timesheet_approval boolean not null default false,
  allow_performance_view boolean not null default true,
  allow_billing_view boolean not null default false,
  allow_documents_view boolean not null default true,
  allow_ticketing boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger client_settings_updated_at
  before update on public.client_settings
  for each row execute function extensions.moddatetime (updated_at);

-- Ticket SLA policies
create table public.ticket_sla_policies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  priority public.ticket_priority not null,
  first_response_minutes integer not null,
  resolution_minutes integer not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger ticket_sla_policies_updated_at
  before update on public.ticket_sla_policies
  for each row execute function extensions.moddatetime (updated_at);

create index ticket_sla_policies_org_idx on public.ticket_sla_policies (organization_id);

-- Tickets
create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number text not null unique,
  client_organization_id uuid references public.organizations (id) on delete set null,
  requester_user_id uuid not null references public.profiles (id) on delete restrict,
  employee_id uuid references public.employees (id) on delete set null,
  category public.ticket_category not null default 'general',
  priority public.ticket_priority not null default 'normal',
  status public.ticket_status not null default 'new',
  assigned_team text,
  assigned_user_id uuid references public.profiles (id) on delete set null,
  subject text not null,
  description text not null default '',
  first_response_at timestamptz,
  resolved_at timestamptz,
  sla_due_at timestamptz,
  sla_policy_id uuid references public.ticket_sla_policies (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger tickets_updated_at
  before update on public.tickets
  for each row execute function extensions.moddatetime (updated_at);

create index tickets_client_idx on public.tickets (client_organization_id);
create index tickets_status_idx on public.tickets (status);
create index tickets_priority_idx on public.tickets (priority);
create index tickets_requester_idx on public.tickets (requester_user_id);
create index tickets_assigned_user_idx on public.tickets (assigned_user_id);
create index tickets_created_idx on public.tickets (created_at desc);

create table public.ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  author_user_id uuid not null references public.profiles (id) on delete restrict,
  body text not null,
  is_internal boolean not null default false,
  created_at timestamptz not null default now()
);

create index ticket_messages_ticket_idx on public.ticket_messages (ticket_id, created_at);
create index ticket_messages_author_idx on public.ticket_messages (author_user_id);

create table public.ticket_internal_notes (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  author_user_id uuid not null references public.profiles (id) on delete restrict,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger ticket_internal_notes_updated_at
  before update on public.ticket_internal_notes
  for each row execute function extensions.moddatetime (updated_at);

create index ticket_internal_notes_ticket_idx on public.ticket_internal_notes (ticket_id);

create table public.ticket_attachments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  message_id uuid references public.ticket_messages (id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index ticket_attachments_ticket_idx on public.ticket_attachments (ticket_id);

create table public.ticket_status_history (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  from_status public.ticket_status,
  to_status public.ticket_status not null,
  changed_by uuid references public.profiles (id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

create index ticket_status_history_ticket_idx
  on public.ticket_status_history (ticket_id, created_at);

-- Performance
create table public.performance_cycles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  start_date date not null,
  end_date date not null,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger performance_cycles_updated_at
  before update on public.performance_cycles
  for each row execute function extensions.moddatetime (updated_at);

create index performance_cycles_org_idx on public.performance_cycles (organization_id);
create index performance_cycles_dates_idx on public.performance_cycles (start_date, end_date);

create table public.performance_reviews (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  cycle_id uuid not null references public.performance_cycles (id) on delete cascade,
  reviewer_user_id uuid references public.profiles (id) on delete set null,
  reviewer_type public.performance_reviewer_type not null,
  visibility public.visibility not null default 'internal',
  overall_score numeric(5, 2),
  comments text not null default '',
  status public.performance_review_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger performance_reviews_updated_at
  before update on public.performance_reviews
  for each row execute function extensions.moddatetime (updated_at);

create index performance_reviews_employee_idx on public.performance_reviews (employee_id);
create index performance_reviews_cycle_idx on public.performance_reviews (cycle_id);
create index performance_reviews_visibility_idx on public.performance_reviews (visibility);

create table public.performance_goals (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  cycle_id uuid references public.performance_cycles (id) on delete set null,
  title text not null,
  description text not null default '',
  target_value numeric(12, 2),
  current_value numeric(12, 2),
  unit text,
  due_date date,
  status text not null default 'active',
  visibility public.visibility not null default 'employee_visible',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger performance_goals_updated_at
  before update on public.performance_goals
  for each row execute function extensions.moddatetime (updated_at);

create index performance_goals_employee_idx on public.performance_goals (employee_id);
create index performance_goals_cycle_idx on public.performance_goals (cycle_id);

create table public.performance_kpis (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  cycle_id uuid references public.performance_cycles (id) on delete set null,
  code text not null,
  label text not null,
  target_value numeric(12, 2),
  actual_value numeric(12, 2),
  weight numeric(5, 2) not null default 1,
  visibility public.visibility not null default 'internal',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger performance_kpis_updated_at
  before update on public.performance_kpis
  for each row execute function extensions.moddatetime (updated_at);

create index performance_kpis_employee_idx on public.performance_kpis (employee_id);

-- Billing
create table public.billing_accounts (
  id uuid primary key default gen_random_uuid(),
  client_organization_id uuid not null unique references public.organizations (id) on delete cascade,
  currency text not null default 'USD',
  payment_terms_days integer not null default 30,
  billing_email text,
  status public.billing_account_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger billing_accounts_updated_at
  before update on public.billing_accounts
  for each row execute function extensions.moddatetime (updated_at);

create index billing_accounts_status_idx on public.billing_accounts (status);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  client_organization_id uuid not null references public.organizations (id) on delete cascade,
  invoice_number text not null unique,
  period_start date not null,
  period_end date not null,
  issue_date date not null,
  due_date date not null,
  subtotal numeric(14, 2) not null default 0,
  adjustments numeric(14, 2) not null default 0,
  total numeric(14, 2) not null default 0,
  currency text not null default 'USD',
  status public.invoice_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger invoices_updated_at
  before update on public.invoices
  for each row execute function extensions.moddatetime (updated_at);

create index invoices_client_idx on public.invoices (client_organization_id);
create index invoices_status_idx on public.invoices (status);
create index invoices_due_date_idx on public.invoices (due_date);

create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  employee_assignment_id uuid references public.employee_assignments (id) on delete set null,
  description text not null,
  quantity numeric(12, 4) not null default 1,
  unit_rate numeric(14, 2) not null default 0,
  amount numeric(14, 2) not null default 0,
  created_at timestamptz not null default now()
);

create index invoice_items_invoice_idx on public.invoice_items (invoice_id);

create table public.invoice_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  amount numeric(14, 2) not null,
  paid_at timestamptz not null default now(),
  reference text,
  method text,
  created_at timestamptz not null default now()
);

create index invoice_payments_invoice_idx on public.invoice_payments (invoice_id);
create index invoice_payments_paid_at_idx on public.invoice_payments (paid_at);

-- Ticket number generator
create or replace function public.generate_ticket_number()
returns text
language plpgsql
as $$
begin
  return 'TKT-' || to_char(now() at time zone 'UTC', 'YYYYMMDD') || '-'
    || lpad(nextval('public.ticket_number_seq')::text, 5, '0');
end;
$$;

grant execute on function public.generate_ticket_number() to authenticated;

-- Client-visible views (security invoker — RLS on underlying tables applies)
create or replace view public.client_visible_employees
with (security_invoker = true)
as
select
  e.id as employee_id,
  ea.client_organization_id,
  e.employee_number,
  p.display_name,
  e.job_title,
  ea.role_title,
  ea.status as assignment_status,
  ea.start_date,
  ea.end_date,
  ea.billable
from public.employees e
join public.employee_assignments ea on ea.employee_id = e.id
join public.profiles p on p.id = e.profile_id
where ea.assignment_type = 'client'
  and ea.client_organization_id is not null
  and ea.status = 'active'
  and e.employment_status = 'active';

create or replace view public.client_attendance_summary
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
  ar.approval_status
from public.attendance_records ar
join public.employee_assignments ea on ea.employee_id = ar.employee_id
where ea.assignment_type = 'client'
  and ea.status = 'active'
  and ea.client_organization_id is not null
  and ar.approval_status in ('client_review', 'finalized');

grant select on public.client_visible_employees to authenticated;
grant select on public.client_attendance_summary to authenticated;

-- RLS
alter table public.client_profiles enable row level security;
alter table public.client_contacts enable row level security;
alter table public.client_settings enable row level security;
alter table public.ticket_sla_policies enable row level security;
alter table public.tickets enable row level security;
alter table public.ticket_messages enable row level security;
alter table public.ticket_internal_notes enable row level security;
alter table public.ticket_attachments enable row level security;
alter table public.ticket_status_history enable row level security;
alter table public.performance_cycles enable row level security;
alter table public.performance_reviews enable row level security;
alter table public.performance_goals enable row level security;
alter table public.performance_kpis enable row level security;
alter table public.billing_accounts enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.invoice_payments enable row level security;

-- Client profiles
create policy client_profiles_select
  on public.client_profiles for select to authenticated
  using (
    public.can_access_client(organization_id)
    or public.has_permission('clients.read')
    or public.has_permission('clients.manage')
  );

create policy client_profiles_manage
  on public.client_profiles for all to authenticated
  using (public.has_permission('clients.manage'))
  with check (public.has_permission('clients.manage'));

create policy client_contacts_select
  on public.client_contacts for select to authenticated
  using (
    public.can_access_client(client_organization_id)
    or public.has_permission('clients.read')
    or public.has_permission('clients.manage')
  );

create policy client_contacts_manage
  on public.client_contacts for all to authenticated
  using (public.has_permission('clients.manage'))
  with check (public.has_permission('clients.manage'));

create policy client_settings_select
  on public.client_settings for select to authenticated
  using (
    public.can_access_client(client_organization_id)
    or public.has_permission('clients.read')
    or public.has_permission('clients.manage')
  );

create policy client_settings_manage
  on public.client_settings for all to authenticated
  using (public.has_permission('clients.manage'))
  with check (public.has_permission('clients.manage'));

-- Tickets
create policy ticket_sla_policies_select
  on public.ticket_sla_policies for select to authenticated
  using (public.is_internal_user() or public.has_permission('tickets.read'));

create policy ticket_sla_policies_manage
  on public.ticket_sla_policies for all to authenticated
  using (public.has_permission('tickets.manage'))
  with check (public.has_permission('tickets.manage'));

create policy tickets_select
  on public.tickets for select to authenticated
  using (
    requester_user_id = (select auth.uid())
    or public.has_permission('tickets.read')
    or public.has_permission('tickets.manage')
    or (
      client_organization_id is not null
      and public.can_access_client(client_organization_id)
      and public.has_permission('tickets.self')
    )
  );

create policy tickets_insert
  on public.tickets for insert to authenticated
  with check (
    requester_user_id = (select auth.uid())
    and (
      public.has_permission('tickets.self')
      or public.has_permission('tickets.manage')
      or public.is_internal_user()
    )
  );

create policy tickets_update
  on public.tickets for update to authenticated
  using (
    public.has_permission('tickets.manage')
    or assigned_user_id = (select auth.uid())
    or (
      requester_user_id = (select auth.uid())
      and public.has_permission('tickets.self')
    )
  )
  with check (
    public.has_permission('tickets.manage')
    or assigned_user_id = (select auth.uid())
    or requester_user_id = (select auth.uid())
  );

create policy ticket_messages_select
  on public.ticket_messages for select to authenticated
  using (
    exists (
      select 1 from public.tickets t
      where t.id = ticket_id
        and (
          (
            public.is_internal_user()
            and (
              public.has_permission('tickets.read')
              or public.has_permission('tickets.manage')
            )
          )
          or (
            not is_internal
            and (
              t.requester_user_id = (select auth.uid())
              or (
                t.client_organization_id is not null
                and public.can_access_client(t.client_organization_id)
              )
            )
          )
        )
    )
  );

create policy ticket_messages_insert
  on public.ticket_messages for insert to authenticated
  with check (
    author_user_id = (select auth.uid())
    and exists (
      select 1 from public.tickets t
      where t.id = ticket_id
        and (
          t.requester_user_id = (select auth.uid())
          or public.has_permission('tickets.manage')
          or public.is_internal_user()
        )
    )
  );

-- Internal notes: NEVER visible to client memberships
create policy ticket_internal_notes_select
  on public.ticket_internal_notes for select to authenticated
  using (
    public.is_internal_user()
    and (
      public.has_permission('tickets.read')
      or public.has_permission('tickets.manage')
    )
  );

create policy ticket_internal_notes_insert
  on public.ticket_internal_notes for insert to authenticated
  with check (
    public.is_internal_user()
    and public.has_permission('tickets.manage')
    and author_user_id = (select auth.uid())
  );

create policy ticket_internal_notes_update
  on public.ticket_internal_notes for update to authenticated
  using (
    public.is_internal_user()
    and public.has_permission('tickets.manage')
  )
  with check (
    public.is_internal_user()
    and public.has_permission('tickets.manage')
  );

create policy ticket_attachments_select
  on public.ticket_attachments for select to authenticated
  using (
    exists (
      select 1 from public.tickets t
      where t.id = ticket_id
        and (
          t.requester_user_id = (select auth.uid())
          or public.has_permission('tickets.read')
          or public.has_permission('tickets.manage')
          or (
            t.client_organization_id is not null
            and public.can_access_client(t.client_organization_id)
          )
        )
    )
  );

create policy ticket_attachments_insert
  on public.ticket_attachments for insert to authenticated
  with check (
    uploaded_by = (select auth.uid())
    and exists (
      select 1 from public.tickets t
      where t.id = ticket_id
        and (
          t.requester_user_id = (select auth.uid())
          or public.has_permission('tickets.manage')
          or public.is_internal_user()
        )
    )
  );

create policy ticket_status_history_select
  on public.ticket_status_history for select to authenticated
  using (
    exists (
      select 1 from public.tickets t
      where t.id = ticket_id
        and (
          t.requester_user_id = (select auth.uid())
          or public.has_permission('tickets.read')
          or public.has_permission('tickets.manage')
          or (
            t.client_organization_id is not null
            and public.can_access_client(t.client_organization_id)
          )
        )
    )
  );

create policy ticket_status_history_insert
  on public.ticket_status_history for insert to authenticated
  with check (
    public.has_permission('tickets.manage')
    or public.is_internal_user()
  );

-- Performance
create policy performance_cycles_select
  on public.performance_cycles for select to authenticated
  using (
    public.is_internal_user()
    or public.has_permission('performance.read')
  );

create policy performance_cycles_manage
  on public.performance_cycles for all to authenticated
  using (public.has_permission('performance.manage'))
  with check (public.has_permission('performance.manage'));

create policy performance_reviews_select
  on public.performance_reviews for select to authenticated
  using (
    public.is_self_employee(employee_id)
    or public.has_permission('performance.read')
    or (
      visibility = 'client_visible'
      and exists (
        select 1 from public.employee_assignments ea
        where ea.employee_id = performance_reviews.employee_id
          and ea.client_organization_id is not null
          and public.can_access_client(ea.client_organization_id)
      )
    )
  );

create policy performance_reviews_manage
  on public.performance_reviews for all to authenticated
  using (public.has_permission('performance.manage'))
  with check (public.has_permission('performance.manage'));

create policy performance_goals_select
  on public.performance_goals for select to authenticated
  using (
    public.is_self_employee(employee_id)
    or public.has_permission('performance.read')
    or (
      visibility = 'client_visible'
      and exists (
        select 1 from public.employee_assignments ea
        where ea.employee_id = performance_goals.employee_id
          and ea.client_organization_id is not null
          and public.can_access_client(ea.client_organization_id)
      )
    )
  );

create policy performance_goals_manage
  on public.performance_goals for all to authenticated
  using (
    public.has_permission('performance.manage')
    or public.is_self_employee(employee_id)
  )
  with check (
    public.has_permission('performance.manage')
    or public.is_self_employee(employee_id)
  );

create policy performance_kpis_select
  on public.performance_kpis for select to authenticated
  using (
    public.is_self_employee(employee_id)
    or public.has_permission('performance.read')
    or (
      visibility = 'client_visible'
      and exists (
        select 1 from public.employee_assignments ea
        where ea.employee_id = performance_kpis.employee_id
          and ea.client_organization_id is not null
          and public.can_access_client(ea.client_organization_id)
      )
    )
  );

create policy performance_kpis_manage
  on public.performance_kpis for all to authenticated
  using (public.has_permission('performance.manage'))
  with check (public.has_permission('performance.manage'));

-- Billing (clients never see payroll; billing is separate)
create policy billing_accounts_select
  on public.billing_accounts for select to authenticated
  using (
    public.has_permission('billing.read')
    or public.has_permission('billing.manage')
    or public.can_access_client(client_organization_id)
  );

create policy billing_accounts_manage
  on public.billing_accounts for all to authenticated
  using (public.has_permission('billing.manage'))
  with check (public.has_permission('billing.manage'));

create policy invoices_select
  on public.invoices for select to authenticated
  using (
    public.has_permission('billing.read')
    or public.has_permission('billing.manage')
    or public.can_access_client(client_organization_id)
  );

create policy invoices_manage
  on public.invoices for all to authenticated
  using (public.has_permission('billing.manage'))
  with check (public.has_permission('billing.manage'));

create policy invoice_items_select
  on public.invoice_items for select to authenticated
  using (
    exists (
      select 1 from public.invoices i
      where i.id = invoice_id
        and (
          public.has_permission('billing.read')
          or public.has_permission('billing.manage')
          or public.can_access_client(i.client_organization_id)
        )
    )
  );

create policy invoice_items_manage
  on public.invoice_items for all to authenticated
  using (public.has_permission('billing.manage'))
  with check (public.has_permission('billing.manage'));

create policy invoice_payments_select
  on public.invoice_payments for select to authenticated
  using (
    exists (
      select 1 from public.invoices i
      where i.id = invoice_id
        and (
          public.has_permission('billing.read')
          or public.has_permission('billing.manage')
          or public.can_access_client(i.client_organization_id)
        )
    )
  );

create policy invoice_payments_manage
  on public.invoice_payments for all to authenticated
  using (public.has_permission('billing.manage'))
  with check (public.has_permission('billing.manage'));
