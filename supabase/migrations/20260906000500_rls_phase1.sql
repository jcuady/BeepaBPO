-- RLS for Phase 1 tables
alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.membership_roles enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.audit_logs enable row level security;
alter table public.approval_workflows enable row level security;
alter table public.approval_steps enable row level security;
alter table public.approval_requests enable row level security;
alter table public.approval_actions enable row level security;

-- Profiles
create policy profiles_select_own_or_internal
  on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or public.is_internal_user()
  );

create policy profiles_update_own
  on public.profiles for update to authenticated
  using (id = (select auth.uid()) or public.has_permission('users.manage'))
  with check (id = (select auth.uid()) or public.has_permission('users.manage'));

-- Organizations
create policy organizations_select
  on public.organizations for select to authenticated
  using (
    public.is_client_member(id)
    or public.is_internal_user()
    or public.has_permission('system.manage')
  );

create policy organizations_manage
  on public.organizations for all to authenticated
  using (public.has_permission('system.manage') or public.has_permission('clients.manage'))
  with check (public.has_permission('system.manage') or public.has_permission('clients.manage'));

-- Memberships
create policy memberships_select
  on public.organization_memberships for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.has_permission('users.manage')
    or public.has_permission('system.manage')
    or public.can_access_client(organization_id)
  );

create policy memberships_manage
  on public.organization_memberships for all to authenticated
  using (public.has_permission('users.manage') or public.has_permission('system.manage'))
  with check (public.has_permission('users.manage') or public.has_permission('system.manage'));

-- Roles / permissions (read for authenticated; manage for system)
create policy roles_select on public.roles for select to authenticated using (true);
create policy permissions_select on public.permissions for select to authenticated using (true);
create policy role_permissions_select on public.role_permissions for select to authenticated using (true);

create policy membership_roles_select
  on public.membership_roles for select to authenticated
  using (
    membership_id in (select public.current_membership_ids())
    or public.has_permission('roles.manage')
    or public.has_permission('system.manage')
  );

create policy membership_roles_manage
  on public.membership_roles for all to authenticated
  using (public.has_permission('roles.manage') or public.has_permission('system.manage'))
  with check (public.has_permission('roles.manage') or public.has_permission('system.manage'));

-- Notifications
create policy notifications_select_own
  on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));

create policy notifications_update_own
  on public.notifications for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy notifications_insert_system
  on public.notifications for insert to authenticated
  with check (
    user_id = (select auth.uid())
    or public.has_permission('system.manage')
    or public.has_permission('system.audit.read')
  );

create policy notification_prefs_own
  on public.notification_preferences for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy push_subs_own
  on public.push_subscriptions for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Audit: append-only for privileged, readable by system.audit.read
create policy audit_select
  on public.audit_logs for select to authenticated
  using (public.has_permission('system.audit.read') or public.has_permission('system.manage'));

create policy audit_insert
  on public.audit_logs for insert to authenticated
  with check (true);

-- Approvals
create policy approval_workflows_select
  on public.approval_workflows for select to authenticated
  using (public.is_internal_user() or public.is_client_member(organization_id));

create policy approval_steps_select
  on public.approval_steps for select to authenticated
  using (true);

create policy approval_requests_select
  on public.approval_requests for select to authenticated
  using (
    requester_user_id = (select auth.uid())
    or public.is_internal_user()
    or (organization_id is not null and public.can_access_client(organization_id))
  );

create policy approval_requests_insert
  on public.approval_requests for insert to authenticated
  with check (requester_user_id = (select auth.uid()));

create policy approval_requests_update
  on public.approval_requests for update to authenticated
  using (
    requester_user_id = (select auth.uid())
    or public.is_internal_user()
  );

create policy approval_actions_select
  on public.approval_actions for select to authenticated
  using (
    exists (
      select 1 from public.approval_requests r
      where r.id = request_id
        and (
          r.requester_user_id = (select auth.uid())
          or public.is_internal_user()
        )
    )
  );

create policy approval_actions_insert
  on public.approval_actions for insert to authenticated
  with check (actor_user_id = (select auth.uid()));
