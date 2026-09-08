-- Harden SECURITY DEFINER helpers: revoke anon + pin search_path.
-- Advisors: anon_security_definer_function_executable, function_search_path_mutable.

revoke execute on function public.current_uid() from anon;
revoke execute on function public.is_internal_user() from anon;
revoke execute on function public.is_client_member(uuid) from anon;
revoke execute on function public.has_permission(text) from anon;
revoke execute on function public.has_any_permission(text[]) from anon;
revoke execute on function public.can_access_client(uuid) from anon;
revoke execute on function public.current_membership_ids() from anon;
revoke execute on function public.user_permission_codes() from anon;
revoke execute on function public.is_self_employee(uuid) from anon;
revoke execute on function public.is_assigned_to_current_client(uuid) from anon;
revoke execute on function public.can_read_assigned_attendance(uuid) from anon;
revoke execute on function public.generate_employee_number() from anon;
revoke execute on function public.generate_ticket_number() from anon;
revoke execute on function public.clock_event(uuid, text, numeric, numeric, numeric, text) from anon;
revoke execute on function public.calculate_payroll_record(uuid) from anon;
revoke execute on function public.handle_new_user() from anon;
revoke execute on function public.tickets_apply_sla() from anon;

alter function public.generate_employee_number() set search_path = public;
alter function public.generate_ticket_number() set search_path = public;

-- FK lookup helpers for common filters (tables with zero secondary indexes).
create index if not exists approval_actions_request_id_idx
  on public.approval_actions (request_id);

create index if not exists role_permissions_role_id_idx
  on public.role_permissions (role_id);

create index if not exists role_permissions_permission_id_idx
  on public.role_permissions (permission_id);
