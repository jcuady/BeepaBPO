-- Beepa Phase 1: profiles, organizations, roles, permissions
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text not null default '',
  middle_name text,
  last_name text not null default '',
  display_name text not null default '',
  avatar_url text,
  phone text,
  timezone text not null default 'Asia/Manila',
  locale text not null default 'en-PH',
  status public.profile_status not null default 'active',
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function extensions.moddatetime (updated_at);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  type public.org_type not null,
  name text not null,
  slug text not null unique,
  legal_name text,
  country text,
  timezone text not null default 'Asia/Manila',
  status public.org_status not null default 'active',
  logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger organizations_updated_at
  before update on public.organizations
  for each row execute function extensions.moddatetime (updated_at);

create index organizations_type_idx on public.organizations (type);
create index organizations_status_idx on public.organizations (status);

create table public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  membership_type public.membership_type not null,
  status public.membership_status not null default 'invited',
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create trigger organization_memberships_updated_at
  before update on public.organization_memberships
  for each row execute function extensions.moddatetime (updated_at);

create index organization_memberships_user_idx
  on public.organization_memberships (user_id);
create index organization_memberships_org_status_idx
  on public.organization_memberships (organization_id, status);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  scope public.role_scope not null,
  description text not null default '',
  is_system boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text not null default '',
  created_at timestamptz not null default now()
);

create table public.role_permissions (
  role_id uuid not null references public.roles (id) on delete cascade,
  permission_id uuid not null references public.permissions (id) on delete cascade,
  primary key (role_id, permission_id)
);

create table public.membership_roles (
  membership_id uuid not null references public.organization_memberships (id) on delete cascade,
  role_id uuid not null references public.roles (id) on delete cascade,
  primary key (membership_id, role_id)
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  fn text := coalesce(new.raw_user_meta_data->>'first_name', split_part(coalesce(new.raw_user_meta_data->>'full_name', ''), ' ', 1));
  ln text := coalesce(new.raw_user_meta_data->>'last_name', nullif(regexp_replace(coalesce(new.raw_user_meta_data->>'full_name', ''), '^\S+\s*', ''), ''));
begin
  insert into public.profiles (id, first_name, last_name, display_name, status)
  values (
    new.id,
    coalesce(nullif(fn, ''), ''),
    coalesce(nullif(ln, ''), ''),
    coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), nullif(trim(both from coalesce(fn, '') || ' ' || coalesce(ln, '')), ''), split_part(new.email, '@', 1)),
    'active'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
