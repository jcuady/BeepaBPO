-- Seed: Beepa internal org, roles, permissions, role_permissions matrix
insert into public.organizations (id, type, name, slug, legal_name, country, timezone, status)
values (
  '11111111-1111-1111-1111-111111111111',
  'internal',
  'Beepa BPO',
  'beepa',
  'Beepa Business Process Outsourcing',
  'PH',
  'Asia/Manila',
  'active'
)
on conflict (slug) do nothing;

insert into public.roles (code, name, scope, description) values
  ('owner', 'Owner / CEO', 'system', 'Business-wide oversight'),
  ('super_admin', 'Super Admin', 'system', 'System administration'),
  ('hr', 'HR', 'internal', 'Human resources'),
  ('recruiter', 'Recruiter', 'internal', 'Talent acquisition'),
  ('sales', 'Sales', 'internal', 'CRM and sales'),
  ('marketing', 'Marketing', 'internal', 'CMS and marketing'),
  ('operations', 'Operations Manager', 'internal', 'Client operations'),
  ('account_manager', 'Account Manager', 'internal', 'Client relationship'),
  ('team_lead', 'Team Leader', 'internal', 'Team supervision'),
  ('finance', 'Finance / Payroll', 'internal', 'Payroll and billing'),
  ('employee', 'Employee', 'internal', 'Employee self-service'),
  ('client_admin', 'Client Admin', 'client', 'Client portal admin'),
  ('client_viewer', 'Client Viewer', 'client', 'Client portal read-only'),
  ('applicant', 'Applicant', 'applicant', 'Job applicant')
on conflict (code) do nothing;

insert into public.permissions (code, description) values
  ('system.manage', 'Full system administration'),
  ('system.audit.read', 'Read audit logs'),
  ('system.settings.manage', 'Manage system settings'),
  ('users.manage', 'Manage users and memberships'),
  ('roles.manage', 'Manage roles and permissions'),
  ('permissions.manage', 'Manage permission definitions'),
  ('employees.read', 'Read employee records'),
  ('employees.manage', 'Manage employees'),
  ('employees.documents.read', 'Read employee documents'),
  ('employees.documents.manage', 'Manage employee documents'),
  ('attendance.self', 'Own attendance'),
  ('attendance.read', 'Read attendance'),
  ('attendance.manage', 'Manage attendance'),
  ('attendance.approve', 'Approve attendance corrections'),
  ('attendance.correct', 'Correct attendance'),
  ('leave.self', 'Own leave'),
  ('leave.read', 'Read leave'),
  ('leave.manage', 'Manage leave'),
  ('leave.approve', 'Approve leave'),
  ('nte.self', 'Own NTE'),
  ('nte.read', 'Read NTE'),
  ('nte.manage', 'Manage NTE'),
  ('cash_advance.self', 'Own cash advances'),
  ('cash_advance.read', 'Read cash advances'),
  ('cash_advance.manage', 'Manage cash advances'),
  ('cash_advance.approve', 'Approve cash advances'),
  ('payroll.self', 'Own payroll/payslips'),
  ('payroll.read', 'Read payroll'),
  ('payroll.manage', 'Manage payroll'),
  ('payroll.approve', 'Approve payroll'),
  ('crm.read', 'Read CRM'),
  ('crm.manage', 'Manage CRM'),
  ('crm.reports', 'CRM reports'),
  ('recruitment.read', 'Read recruitment'),
  ('recruitment.manage', 'Manage recruitment'),
  ('clients.read', 'Read clients'),
  ('clients.manage', 'Manage clients'),
  ('clients.employee_visibility', 'View client-assigned employees'),
  ('tickets.self', 'Own tickets'),
  ('tickets.read', 'Read tickets'),
  ('tickets.manage', 'Manage tickets'),
  ('billing.read', 'Read billing'),
  ('billing.manage', 'Manage billing'),
  ('performance.self', 'Own performance'),
  ('performance.read', 'Read performance'),
  ('performance.manage', 'Manage performance'),
  ('reports.read', 'Read reports'),
  ('reports.export', 'Export reports'),
  ('cms.manage', 'Manage CMS content'),
  ('approvals.act', 'Act on approval queues')
on conflict (code) do nothing;

-- Helper: assign all listed permission codes to a role
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

-- Owner: broad internal oversight (not every system toggle)
select public._seed_role_perms('owner', array[
  'system.manage','system.audit.read','system.settings.manage','users.manage','roles.manage',
  'employees.read','employees.manage','employees.documents.read','employees.documents.manage',
  'attendance.read','attendance.manage','attendance.approve',
  'leave.read','leave.manage','leave.approve',
  'nte.read','nte.manage',
  'cash_advance.read','cash_advance.manage','cash_advance.approve',
  'payroll.read','payroll.manage','payroll.approve',
  'crm.read','crm.manage','crm.reports',
  'recruitment.read','recruitment.manage',
  'clients.read','clients.manage','clients.employee_visibility',
  'tickets.read','tickets.manage',
  'billing.read','billing.manage',
  'performance.read','performance.manage',
  'reports.read','reports.export','approvals.act',
  'attendance.self','leave.self','nte.self','cash_advance.self','payroll.self','tickets.self','performance.self'
]);

select public._seed_role_perms('super_admin', array[
  'system.manage','system.audit.read','system.settings.manage','users.manage','roles.manage','permissions.manage',
  'reports.read','reports.export','approvals.act',
  'attendance.self','leave.self','nte.self','cash_advance.self','payroll.self','tickets.self','performance.self'
]);

select public._seed_role_perms('hr', array[
  'employees.read','employees.manage','employees.documents.read','employees.documents.manage',
  'attendance.read','attendance.manage','attendance.approve','attendance.correct',
  'leave.read','leave.manage','leave.approve',
  'nte.read','nte.manage',
  'cash_advance.read','cash_advance.manage',
  'performance.read','performance.manage',
  'reports.read','reports.export','approvals.act',
  'attendance.self','leave.self','nte.self','cash_advance.self','payroll.self','tickets.self','performance.self'
]);

select public._seed_role_perms('recruiter', array[
  'recruitment.read','recruitment.manage','reports.read',
  'attendance.self','leave.self','nte.self','cash_advance.self','payroll.self','tickets.self','performance.self'
]);

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

select public._seed_role_perms('operations', array[
  'clients.read','clients.manage','clients.employee_visibility',
  'attendance.read','tickets.read','tickets.manage',
  'performance.read','reports.read','reports.export','approvals.act',
  'attendance.self','leave.self','nte.self','cash_advance.self','payroll.self','tickets.self','performance.self'
]);

select public._seed_role_perms('account_manager', array[
  'clients.read','clients.employee_visibility',
  'attendance.read','tickets.read','tickets.manage',
  'performance.read','reports.read','approvals.act',
  'attendance.self','leave.self','nte.self','cash_advance.self','payroll.self','tickets.self','performance.self'
]);

select public._seed_role_perms('team_lead', array[
  'attendance.read','attendance.approve','leave.approve','leave.read',
  'performance.read','reports.read','approvals.act',
  'attendance.self','leave.self','nte.self','cash_advance.self','payroll.self','tickets.self','performance.self'
]);

select public._seed_role_perms('finance', array[
  'payroll.read','payroll.manage','payroll.approve',
  'cash_advance.read','cash_advance.approve',
  'billing.read','billing.manage',
  'reports.read','reports.export','approvals.act',
  'attendance.self','leave.self','nte.self','cash_advance.self','payroll.self','tickets.self','performance.self'
]);

select public._seed_role_perms('employee', array[
  'attendance.self','leave.self','nte.self','cash_advance.self','payroll.self',
  'tickets.self','performance.self','approvals.act'
]);

select public._seed_role_perms('client_admin', array[
  'clients.employee_visibility','attendance.read','attendance.approve',
  'tickets.self','tickets.read','tickets.manage',
  'performance.read','billing.read','reports.read','reports.export','approvals.act'
]);

select public._seed_role_perms('client_viewer', array[
  'clients.employee_visibility','attendance.read','tickets.read','performance.read','reports.read'
]);

select public._seed_role_perms('applicant', array[
  'recruitment.read'
]);

-- Default approval workflows for Beepa
insert into public.approval_workflows (id, organization_id, code, name, entity_type)
values
  ('22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111111', 'leave', 'Leave approval', 'leave_request'),
  ('22222222-2222-2222-2222-222222222202', '11111111-1111-1111-1111-111111111111', 'attendance_correction', 'Attendance correction', 'attendance_correction'),
  ('22222222-2222-2222-2222-222222222203', '11111111-1111-1111-1111-111111111111', 'cash_advance', 'Cash advance', 'cash_advance'),
  ('22222222-2222-2222-2222-222222222204', '11111111-1111-1111-1111-111111111111', 'payroll', 'Payroll approval', 'payroll_period')
on conflict do nothing;

insert into public.approval_steps (workflow_id, step_order, role_code, permission_code, name) values
  ('22222222-2222-2222-2222-222222222201', 1, 'team_lead', 'leave.approve', 'Team Lead'),
  ('22222222-2222-2222-2222-222222222201', 2, 'hr', 'leave.approve', 'HR'),
  ('22222222-2222-2222-2222-222222222202', 1, 'hr', 'attendance.approve', 'Supervisor / HR'),
  ('22222222-2222-2222-2222-222222222203', 1, 'hr', 'cash_advance.manage', 'HR'),
  ('22222222-2222-2222-2222-222222222203', 2, 'finance', 'cash_advance.approve', 'Finance'),
  ('22222222-2222-2222-2222-222222222204', 1, 'finance', 'payroll.manage', 'Finance'),
  ('22222222-2222-2222-2222-222222222204', 2, 'owner', 'payroll.approve', 'Owner')
on conflict do nothing;

drop function public._seed_role_perms(text, text[]);
