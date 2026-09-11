-- Future-proof CRM + tickets list/search performance.
-- Supports ordered hubs and ilike filters used by sales/marketing UIs.

create index if not exists crm_leads_created_at_idx
  on public.crm_leads (created_at desc);

create index if not exists crm_leads_status_created_idx
  on public.crm_leads (status, created_at desc);

create index if not exists crm_deals_updated_at_idx
  on public.crm_deals (updated_at desc);

create index if not exists crm_deals_stage_updated_idx
  on public.crm_deals (stage, updated_at desc);

create index if not exists crm_proposals_updated_at_idx
  on public.crm_proposals (updated_at desc);

create index if not exists crm_proposals_status_updated_idx
  on public.crm_proposals (status, updated_at desc);

create index if not exists tickets_created_at_idx
  on public.tickets (created_at desc);

create index if not exists tickets_status_created_idx
  on public.tickets (status, created_at desc);

-- Trigram search for lead/deal filters (pg_trgm already installed).
create index if not exists crm_leads_company_trgm_idx
  on public.crm_leads using gin (company_name extensions.gin_trgm_ops);

create index if not exists crm_leads_contact_name_trgm_idx
  on public.crm_leads using gin (contact_name extensions.gin_trgm_ops);

create index if not exists crm_leads_contact_email_trgm_idx
  on public.crm_leads using gin (contact_email extensions.gin_trgm_ops);

create index if not exists crm_deals_title_trgm_idx
  on public.crm_deals using gin (title extensions.gin_trgm_ops);

create index if not exists tickets_subject_trgm_idx
  on public.tickets using gin (subject extensions.gin_trgm_ops);

create index if not exists tickets_number_trgm_idx
  on public.tickets using gin (ticket_number extensions.gin_trgm_ops);
