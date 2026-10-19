-- Correct the brand in the public `public_seo` setting.
--
-- WHY
-- ---
-- `public_seo` is one of three `site_settings` rows that the RLS policy lets
-- an ANONYMOUS visitor read (20260906001100_ats_crm_cms.sql). Probed with the
-- anon key on 2026-10-19, it returned:
--
--   {
--     "title": "BeepoBPO | People-First BPO Outsourcing Partner",
--     "description": "BeepoBPO is a people-first BPO partner for dependable
--                     support, ops, and talent teams. Scale with confidence.",
--     "og_image": "/images/og.png",
--     "twitter_handle": "@beepabpo"
--   }
--
-- That is the RETIRED brand spelling, published by the database, described in
-- its own `description` column as "Default SEO overrides for the public site",
-- and readable by anyone. The brand was corrected everywhere else on
-- 2026-10-19 -- `lib/site.ts`, the layout keywords, the services JSON-LD, the
-- favicon, the Open Graph card -- and this row was missed because it lives in
-- the database rather than in the source tree.
--
-- WHAT THIS DOES NOT CLAIM. The rendered metadata does NOT come from this row.
-- Every title and description the site serves is built in `lib/seo/metadata.ts`
-- from `lib/site.ts`, and `audit-seo-metadata.mjs` asserts them against raw
-- HTML for every URL in the sitemap. No application code reads `public_seo`:
-- the CMS page and the about page both read `ABOUT_SETTING_KEY`. So this is
-- not a case of Google being served the wrong title -- it is a public setting
-- that says the wrong thing, which is still a wrong thing to publish.
--
-- WHY A NEW MIGRATION AND NOT AN EDIT. `20261006130000_cms_complete_seed.sql`
-- seeded this value and has already been applied. Editing an applied
-- migration changes its contents behind the ledger's back, so the correction
-- is a forward migration instead, and the seed script is corrected alongside
-- it so a re-seed cannot put the old spelling back.
--
-- Verify with:  node scripts/audit/preflight-pending-migrations.mjs
--                node scripts/audit/audit-seo-metadata.mjs

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.site_settings WHERE key = 'public_seo') THEN
    RAISE EXCEPTION 'public_seo_brand: site_settings row "public_seo" not found';
  END IF;
END $$;

update public.site_settings
set
  value = jsonb_set(
    jsonb_set(
      coalesce(value, '{}'::jsonb),
      '{title}',
      to_jsonb('Beepa BPO | People-First Outsourcing in the Philippines'::text),
      true
    ),
    '{description}',
    to_jsonb(
      'Beepa BPO is a people-first outsourcing partner in the Philippines for customer support, operations and offshore teams. Tell us what you need.'::text
    ),
    true
  ),
  description = 'Default SEO overrides for the public site. Kept in step with the brand in lib/site.ts.',
  updated_at = now()
where key = 'public_seo';

-- The retired spelling must not survive anywhere in this row. If a future
-- seed re-introduces it, the value still matches the corrected one above
-- only if it was actually replaced -- so assert on the string, not on the
-- fact that a row was updated.
DO $$
DECLARE
  leftover text;
BEGIN
  SELECT string_agg(k, ', ')
  INTO leftover
  FROM public.site_settings s,
       LATERAL jsonb_each_text(s.value) AS e(k, v)
  WHERE s.key = 'public_seo'
    AND v ILIKE '%BeepoBPO%';

  IF leftover IS NOT NULL THEN
    RAISE EXCEPTION 'public_seo_brand: retired spelling still present in: %', leftover;
  END IF;
END $$;
