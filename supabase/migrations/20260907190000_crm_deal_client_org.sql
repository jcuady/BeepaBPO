-- Link won CRM deals to onboarded client organizations.
alter table public.crm_deals
  add column if not exists client_organization_id uuid
  references public.organizations (id) on delete set null;

create index if not exists crm_deals_client_org_idx
  on public.crm_deals (client_organization_id)
  where client_organization_id is not null;

comment on column public.crm_deals.client_organization_id is
  'Set when a won deal is converted into a client organization.';
