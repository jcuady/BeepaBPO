-- Permission / membership helper functions (security definer, fixed search_path)
create or replace function public.current_uid()
returns uuid
language sql
stable
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
    where m.user_id = (select auth.uid())
      and m.status = 'active'
      and m.membership_type = 'internal'
      and o.type = 'internal'
      and o.status = 'active'
  );
$$;

create or replace function public.is_client_member(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_memberships m
    where m.user_id = (select auth.uid())
      and m.organization_id = p_org_id
      and m.status = 'active'
      and m.membership_type = 'client'
  );
$$;

create or replace function public.has_permission(p_code text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_memberships m
    join public.membership_roles mr on mr.membership_id = m.id
    join public.role_permissions rp on rp.role_id = mr.role_id
    join public.permissions p on p.id = rp.permission_id
    where m.user_id = (select auth.uid())
      and m.status = 'active'
      and p.code = p_code
  );
$$;

create or replace function public.has_any_permission(p_codes text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_memberships m
    join public.membership_roles mr on mr.membership_id = m.id
    join public.role_permissions rp on rp.role_id = mr.role_id
    join public.permissions p on p.id = rp.permission_id
    where m.user_id = (select auth.uid())
      and m.status = 'active'
      and p.code = any (p_codes)
  );
$$;

create or replace function public.can_access_client(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_client_member(p_org_id)
    or public.has_permission('clients.read')
    or public.has_permission('clients.manage')
    or public.has_permission('system.manage');
$$;

create or replace function public.current_membership_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select m.id
  from public.organization_memberships m
  where m.user_id = (select auth.uid())
    and m.status = 'active';
$$;

create or replace function public.user_permission_codes()
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select distinct p.code
  from public.organization_memberships m
  join public.membership_roles mr on mr.membership_id = m.id
  join public.role_permissions rp on rp.role_id = mr.role_id
  join public.permissions p on p.id = rp.permission_id
  where m.user_id = (select auth.uid())
    and m.status = 'active';
$$;

grant execute on function public.current_uid() to authenticated;
grant execute on function public.is_internal_user() to authenticated;
grant execute on function public.is_client_member(uuid) to authenticated;
grant execute on function public.has_permission(text) to authenticated;
grant execute on function public.has_any_permission(text[]) to authenticated;
grant execute on function public.can_access_client(uuid) to authenticated;
grant execute on function public.current_membership_ids() to authenticated;
grant execute on function public.user_permission_codes() to authenticated;
