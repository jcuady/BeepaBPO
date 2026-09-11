-- Staff org-wide ticket access must be internal memberships.
-- Client portal continues via requester / tickets.self + can_access_client.

drop policy if exists tickets_select on public.tickets;
create policy tickets_select
  on public.tickets for select to authenticated
  using (
    requester_user_id = (select auth.uid())
    or (
      public.is_internal_user()
      and (
        public.has_permission('tickets.read')
        or public.has_permission('tickets.manage')
      )
    )
    or (
      client_organization_id is not null
      and public.can_access_client(client_organization_id)
      and public.has_permission('tickets.self')
    )
  );

drop policy if exists tickets_update on public.tickets;
create policy tickets_update
  on public.tickets for update to authenticated
  using (
    (
      public.is_internal_user()
      and (
        public.has_permission('tickets.manage')
        or assigned_user_id = (select auth.uid())
      )
    )
    or (
      requester_user_id = (select auth.uid())
      and public.has_permission('tickets.self')
    )
  )
  with check (
    (
      public.is_internal_user()
      and (
        public.has_permission('tickets.manage')
        or assigned_user_id = (select auth.uid())
      )
    )
    or requester_user_id = (select auth.uid())
  );

drop policy if exists ticket_sla_policies_select on public.ticket_sla_policies;
create policy ticket_sla_policies_select
  on public.ticket_sla_policies for select to authenticated
  using (
    public.is_internal_user()
    and (
      public.has_permission('tickets.read')
      or public.has_permission('tickets.manage')
    )
  );

drop policy if exists ticket_sla_policies_manage on public.ticket_sla_policies;
create policy ticket_sla_policies_manage
  on public.ticket_sla_policies for all to authenticated
  using (
    public.is_internal_user()
    and public.has_permission('tickets.manage')
  )
  with check (
    public.is_internal_user()
    and public.has_permission('tickets.manage')
  );
