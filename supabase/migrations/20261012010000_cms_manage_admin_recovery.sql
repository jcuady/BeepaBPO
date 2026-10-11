-- Give `owner` and `super_admin` the `cms.manage` permission.
--
-- WHY. `cms.manage` gates every write to the marketing site: `services`, `industries`,
-- `testimonials`, `case_studies`, `blog_posts`, `faqs`, `site_settings`, and the
-- `marketing-media` storage bucket. After the full permission sweep it was held by exactly
-- ONE role -- `marketing`. Neither `owner` nor `super_admin` had it.
--
-- That is not a least-privilege win, it is a single point of failure with no recovery path.
-- If the marketing seat is vacant -- resigned, disabled, or never filled in the first place
-- -- then nobody can correct the public website. Not the owner, not the platform
-- administrator, and not via `system.manage`, because `has_permission()` resolves through
-- the role grants and this grant does not exist. The outage would be silent until someone
-- tried to publish a correction.
--
-- WHAT THIS DOES NOT DO. `marketing` KEEPS the permission. This is redundancy for the
-- administrator, not a reallocation: the day-to-day role still owns the content, and the
-- grant is deliberately the same one `owner` already holds for every other business domain
-- (crm, recruitment, tickets, clients, billing). Granting it to `super_admin` as well is
-- consistent with that role already carrying `roles.manage` and `permissions.manage` -- a
-- platform administrator who cannot manage one content area cannot recover it.
--
-- Written as a plain insert rather than via `_seed_role_perms(text, text[])`, which the
-- seed migrations drop after use. `on conflict do nothing` makes re-application a no-op.
--
-- Verify with:  node scripts/audit/audit-rbac.mjs
--               node scripts/audit/qa-inspect-super-admin-gaps.mjs

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.code in ('owner', 'super_admin')
  and p.code = 'cms.manage'
on conflict do nothing;

-- Fail the migration rather than apply it silently if a code is missing. Without this the
-- insert would simply match nothing and report success, which is the same class of quiet
-- no-op that made `hire-workflow` report "no published job" for a table that did not exist.
DO $$
DECLARE
  missing text[];
BEGIN
  SELECT array_agg(expected.code)
  INTO missing
  FROM (VALUES ('owner'), ('super_admin')) AS expected(code)
  WHERE NOT EXISTS (SELECT 1 FROM public.roles r WHERE r.code = expected.code);

  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'cms_manage_admin_recovery: role code(s) not found: %', missing;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.permissions WHERE code = 'cms.manage') THEN
    RAISE EXCEPTION 'cms_manage_admin_recovery: permission cms.manage not found';
  END IF;
END $$;