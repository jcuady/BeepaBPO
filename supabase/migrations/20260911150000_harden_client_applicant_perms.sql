-- Harden staff-only permission misuse by client/applicant roles.
-- Clients access portal tickets via tickets.self + can_access_client RLS,
-- not org-wide tickets.read/manage.

delete from public.role_permissions rp
using public.roles r, public.permissions p
where rp.role_id = r.id
  and rp.permission_id = p.id
  and r.code in ('client_admin', 'client_viewer')
  and p.code in ('tickets.read', 'tickets.manage', 'reports.export');

-- Ensure client viewers can list their tenant tickets (self + org RLS path).
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.code = 'client_viewer'
  and p.code = 'tickets.self'
on conflict do nothing;

delete from public.role_permissions rp
using public.roles r, public.permissions p
where rp.role_id = r.id
  and rp.permission_id = p.id
  and r.code = 'applicant'
  and p.code = 'recruitment.read';

-- Staff corrections queue must not be readable/updatable by client_admin
-- who share attendance.approve for portal timesheet review.
drop policy if exists attendance_correction_requests_select
  on public.attendance_correction_requests;
create policy attendance_correction_requests_select
  on public.attendance_correction_requests for select to authenticated
  using (
    public.is_self_employee(employee_id)
    or (
      public.is_internal_user()
      and (
        public.has_permission('attendance.read')
        or public.has_permission('attendance.approve')
      )
    )
  );

drop policy if exists attendance_correction_requests_update
  on public.attendance_correction_requests;
create policy attendance_correction_requests_update
  on public.attendance_correction_requests for update to authenticated
  using (
    public.is_self_employee(employee_id)
    or (
      public.is_internal_user()
      and (
        public.has_permission('attendance.approve')
        or public.has_permission('attendance.manage')
      )
    )
  )
  with check (
    public.is_self_employee(employee_id)
    or (
      public.is_internal_user()
      and (
        public.has_permission('attendance.approve')
        or public.has_permission('attendance.manage')
      )
    )
  );
