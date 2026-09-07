-- Notifications, push, audit, approvals
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  title text not null,
  body text not null default '',
  action_url text,
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_created_idx
  on public.notifications (user_id, created_at desc);
create index notifications_user_unread_idx
  on public.notifications (user_id)
  where read_at is null;

create table public.notification_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  in_app_enabled boolean not null default true,
  push_enabled boolean not null default true,
  email_enabled boolean not null default true,
  category_preferences jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  device_label text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.profiles (id) on delete set null,
  organization_id uuid references public.organizations (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index audit_logs_org_created_idx
  on public.audit_logs (organization_id, created_at desc);
create index audit_logs_entity_idx
  on public.audit_logs (entity_type, entity_id);

create table public.approval_workflows (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete cascade,
  code text not null,
  name text not null,
  entity_type text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table public.approval_steps (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.approval_workflows (id) on delete cascade,
  step_order integer not null,
  role_code text,
  permission_code text,
  name text not null,
  unique (workflow_id, step_order)
);

create table public.approval_requests (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.approval_workflows (id),
  organization_id uuid references public.organizations (id) on delete set null,
  entity_type text not null,
  entity_id uuid not null,
  requester_user_id uuid not null references public.profiles (id),
  current_step integer not null default 1,
  status public.approval_status not null default 'pending',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger approval_requests_updated_at
  before update on public.approval_requests
  for each row execute function extensions.moddatetime (updated_at);

create index approval_requests_status_idx on public.approval_requests (status);
create index approval_requests_entity_idx on public.approval_requests (entity_type, entity_id);

create table public.approval_actions (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.approval_requests (id) on delete cascade,
  step_order integer not null,
  actor_user_id uuid not null references public.profiles (id),
  action text not null check (action in ('approve', 'reject', 'comment', 'escalate')),
  notes text,
  created_at timestamptz not null default now()
);
