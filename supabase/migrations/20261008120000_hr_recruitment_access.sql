-- HR must be able to run recruitment.
--
-- The seeded `hr` role had employees/attendance/leave/NTE/cash-advance/performance
-- permissions but no `recruitment.*`, so an HR officer had no route into
-- `/app/recruitment`: the nav item was filtered out by permission and the page
-- itself calls `requirePermission(workspace, "recruitment.read")`.
--
-- In a BPO, HR owns the pipeline. Job posting, applicant screening and
-- offer-to-hire are HR work; the separate `recruiter` role exists for
-- sourcing specialists, but HR being locked out of it means the people who
-- onboard the hire cannot post or advance the vacancy. Hires then have to be
-- created by hand in `/app/employees` with no link back to the application.
--
-- `recruitment.manage` is required, not just `recruitment.read`, because the
-- terminal steps (move a stage, convert an applicant to an employee) are gated
-- on it. `convertApplicantToEmployee` additionally requires `employees.manage`,
-- which the `hr` role already holds — so HR can now hire from the pipeline
-- without a second permission grant.
--
-- Deliberately NOT granted: `reports.export` is already present for hr, and no
-- client/applicant permission is touched here. The applicant role stays without
-- `recruitment.read`; `20260911150000_harden_client_applicant_perms.sql`
-- removed it on purpose, because an applicant must not be able to read the full
-- applicant table. Applicants reach published roles through the
-- `job_posts_select_published` RLS policy instead, which is scoped to
-- `status = 'published'` and grants no access to other applicants.
--
-- Idempotent: `on conflict do nothing` against the role_permissions PK.

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.code = 'hr'
  and p.code in ('recruitment.read', 'recruitment.manage')
on conflict do nothing;

-- Guard against the seed migration being re-applied over the top of this one:
-- `_seed_role_perms` only inserts, so it cannot remove the grant, but a future
-- rewrite of the seed that treats the hr list as authoritative would silently
-- revoke careers access again. Recorded here so the intent is discoverable.
comment on table public.role_permissions is
  'Role-to-permission grants. The hr role intentionally includes recruitment.read/manage — see 20261008120000_hr_recruitment_access.sql.';