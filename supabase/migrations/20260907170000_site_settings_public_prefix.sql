-- Public marketing settings must be readable by anon and any authenticated role.
-- Previously anon only saw public_contact / public_social / public_seo, and
-- authenticated non-internal users could not read public_* keys at all.

drop policy if exists site_settings_select_anon on public.site_settings;
drop policy if exists site_settings_select on public.site_settings;

create policy site_settings_select_anon
  on public.site_settings for select to anon
  using (key like 'public_%');

create policy site_settings_select
  on public.site_settings for select to authenticated
  using (
    key like 'public_%'
    or public.has_permission('cms.manage')
    or public.is_internal_user()
  );
