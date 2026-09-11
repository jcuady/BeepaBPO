-- Sales + Marketing: usable CRM and staff ticketing for both roles.
-- Idempotent grants (matches lib/permissions/role-modules.ts).

create or replace function public._seed_role_perms(p_role text, p_codes text[])
returns void
language plpgsql
as $$
begin
  insert into public.role_permissions (role_id, permission_id)
  select r.id, p.id
  from public.roles r
  cross join public.permissions p
  where r.code = p_role
    and p.code = any (p_codes)
  on conflict do nothing;
end;
$$;

select public._seed_role_perms('sales', array[
  'crm.read','crm.manage','crm.reports','clients.read','reports.read',
  'tickets.read','tickets.manage',
  'attendance.self','leave.self','nte.self','cash_advance.self','payroll.self','tickets.self','performance.self'
]);

select public._seed_role_perms('marketing', array[
  'cms.manage','reports.read',
  'crm.read','crm.manage',
  'tickets.read','tickets.manage',
  'attendance.self','leave.self','nte.self','cash_advance.self','payroll.self','tickets.self','performance.self'
]);

drop function public._seed_role_perms(text, text[]);
