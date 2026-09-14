-- heatmap CRUD: staff with attendance.manage can delete; super_admin can run the board

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.code = 'super_admin'
  and p.code in (
    'employees.read',
    'attendance.read',
    'attendance.manage',
    'attendance.approve',
    'attendance.correct'
  )
on conflict do nothing;

drop policy if exists attendance_records_delete on public.attendance_records;
create policy attendance_records_delete
  on public.attendance_records for delete to authenticated
  using (public.has_permission('attendance.manage'));
