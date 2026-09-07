-- Beepa Phase 2: ATS, CRM, CMS

-- Enums
create type public.job_post_status as enum ('draft', 'published', 'closed');
create type public.location_type as enum ('remote', 'onsite', 'hybrid');
create type public.application_stage as enum (
  'applied', 'screening', 'initial_interview', 'assessment',
  'client_endorsement', 'client_interview', 'offer', 'hired',
  'rejected', 'withdrawn', 'talent_pool', 'on_hold'
);
create type public.crm_lead_status as enum (
  'new', 'contacted', 'qualified', 'unqualified', 'converted', 'lost'
);
create type public.crm_deal_stage as enum (
  'new_lead', 'contacted', 'qualified', 'discovery', 'proposal',
  'negotiation', 'won', 'lost', 'on_hold', 'follow_up_later'
);
create type public.crm_activity_type as enum (
  'call', 'email', 'meeting', 'note', 'task', 'follow_up'
);
create type public.cms_content_status as enum ('draft', 'published', 'archived');

-- ATS: job posts
create table public.job_posts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  title text not null,
  slug text not null,
  department_id uuid references public.departments (id) on delete set null,
  employment_type public.employment_type not null default 'regular',
  location_type public.location_type not null default 'remote',
  location_text text,
  description text not null default '',
  responsibilities text not null default '',
  requirements text not null default '',
  nice_to_have text not null default '',
  salary_display text,
  status public.job_post_status not null default 'draft',
  published_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);

create trigger job_posts_updated_at
  before update on public.job_posts
  for each row execute function extensions.moddatetime (updated_at);

create index job_posts_org_idx on public.job_posts (organization_id);
create index job_posts_status_idx on public.job_posts (status);
create index job_posts_published_idx on public.job_posts (published_at desc);

create table public.applicants (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles (id) on delete set null,
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text,
  location text,
  resume_path text,
  linkedin_url text,
  portfolio_url text,
  source text not null default 'website',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger applicants_updated_at
  before update on public.applicants
  for each row execute function extensions.moddatetime (updated_at);

create index applicants_email_idx on public.applicants (email);
create index applicants_profile_idx on public.applicants (profile_id);

create table public.job_applications (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references public.applicants (id) on delete cascade,
  job_post_id uuid not null references public.job_posts (id) on delete cascade,
  stage public.application_stage not null default 'applied',
  assigned_recruiter_user_id uuid references public.profiles (id) on delete set null,
  salary_expectation numeric(14, 2),
  availability_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (applicant_id, job_post_id)
);

create trigger job_applications_updated_at
  before update on public.job_applications
  for each row execute function extensions.moddatetime (updated_at);

create index job_applications_applicant_idx on public.job_applications (applicant_id);
create index job_applications_job_idx on public.job_applications (job_post_id);
create index job_applications_stage_idx on public.job_applications (stage);
create index job_applications_recruiter_idx on public.job_applications (assigned_recruiter_user_id);

create table public.application_stage_history (
  id uuid primary key default gen_random_uuid(),
  job_application_id uuid not null references public.job_applications (id) on delete cascade,
  from_stage public.application_stage,
  to_stage public.application_stage not null,
  changed_by uuid references public.profiles (id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

create index application_stage_history_app_idx
  on public.application_stage_history (job_application_id, created_at);

create table public.interviews (
  id uuid primary key default gen_random_uuid(),
  job_application_id uuid not null references public.job_applications (id) on delete cascade,
  interviewer_user_id uuid references public.profiles (id) on delete set null,
  scheduled_at timestamptz not null,
  duration_minutes integer not null default 60,
  location text,
  meeting_url text,
  status text not null default 'scheduled',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger interviews_updated_at
  before update on public.interviews
  for each row execute function extensions.moddatetime (updated_at);

create index interviews_application_idx on public.interviews (job_application_id);
create index interviews_scheduled_idx on public.interviews (scheduled_at);

create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  job_application_id uuid not null references public.job_applications (id) on delete cascade,
  title text not null,
  assessment_type text not null default 'general',
  score numeric(5, 2),
  max_score numeric(5, 2),
  completed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger assessments_updated_at
  before update on public.assessments
  for each row execute function extensions.moddatetime (updated_at);

create index assessments_application_idx on public.assessments (job_application_id);

create table public.applicant_documents (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references public.applicants (id) on delete cascade,
  job_application_id uuid references public.job_applications (id) on delete set null,
  category text not null,
  title text not null,
  storage_path text not null,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index applicant_documents_applicant_idx on public.applicant_documents (applicant_id);

-- CRM
create table public.crm_leads (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  contact_name text,
  contact_email text,
  contact_phone text,
  country text,
  industry text,
  source text not null default 'website',
  status public.crm_lead_status not null default 'new',
  assigned_sales_user_id uuid references public.profiles (id) on delete set null,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger crm_leads_updated_at
  before update on public.crm_leads
  for each row execute function extensions.moddatetime (updated_at);

create index crm_leads_status_idx on public.crm_leads (status);
create index crm_leads_assigned_idx on public.crm_leads (assigned_sales_user_id);
create index crm_leads_source_idx on public.crm_leads (source);

create table public.crm_companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  website text,
  industry text,
  country text,
  size_range text,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger crm_companies_updated_at
  before update on public.crm_companies
  for each row execute function extensions.moddatetime (updated_at);

create index crm_companies_name_idx on public.crm_companies (name);

create table public.crm_contacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.crm_companies (id) on delete set null,
  lead_id uuid references public.crm_leads (id) on delete set null,
  name text not null,
  email text,
  phone text,
  job_title text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger crm_contacts_updated_at
  before update on public.crm_contacts
  for each row execute function extensions.moddatetime (updated_at);

create index crm_contacts_company_idx on public.crm_contacts (company_id);
create index crm_contacts_lead_idx on public.crm_contacts (lead_id);

create table public.crm_deals (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.crm_leads (id) on delete set null,
  company_id uuid references public.crm_companies (id) on delete set null,
  title text not null,
  stage public.crm_deal_stage not null default 'new_lead',
  estimated_value numeric(14, 2),
  currency text not null default 'USD',
  expected_close_date date,
  lost_reason text,
  owner_user_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger crm_deals_updated_at
  before update on public.crm_deals
  for each row execute function extensions.moddatetime (updated_at);

create index crm_deals_stage_idx on public.crm_deals (stage);
create index crm_deals_owner_idx on public.crm_deals (owner_user_id);
create index crm_deals_company_idx on public.crm_deals (company_id);

create table public.crm_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.crm_leads (id) on delete cascade,
  deal_id uuid references public.crm_deals (id) on delete cascade,
  contact_id uuid references public.crm_contacts (id) on delete set null,
  activity_type public.crm_activity_type not null,
  subject text not null,
  body text not null default '',
  due_at timestamptz,
  completed_at timestamptz,
  owner_user_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (lead_id is not null or deal_id is not null)
);

create trigger crm_activities_updated_at
  before update on public.crm_activities
  for each row execute function extensions.moddatetime (updated_at);

create index crm_activities_lead_idx on public.crm_activities (lead_id);
create index crm_activities_deal_idx on public.crm_activities (deal_id);
create index crm_activities_due_idx on public.crm_activities (due_at);

create table public.crm_proposals (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.crm_deals (id) on delete cascade,
  title text not null,
  amount numeric(14, 2),
  currency text not null default 'USD',
  document_path text,
  status text not null default 'draft',
  sent_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger crm_proposals_updated_at
  before update on public.crm_proposals
  for each row execute function extensions.moddatetime (updated_at);

create index crm_proposals_deal_idx on public.crm_proposals (deal_id);

create table public.crm_contracts (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid references public.crm_deals (id) on delete set null,
  client_organization_id uuid references public.organizations (id) on delete set null,
  title text not null,
  document_path text,
  start_date date,
  end_date date,
  value numeric(14, 2),
  currency text not null default 'USD',
  status text not null default 'draft',
  signed_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger crm_contracts_updated_at
  before update on public.crm_contracts
  for each row execute function extensions.moddatetime (updated_at);

create index crm_contracts_deal_idx on public.crm_contracts (deal_id);
create index crm_contracts_client_idx on public.crm_contracts (client_organization_id);

create table public.lead_attribution (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.crm_leads (id) on delete cascade,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  referrer_url text,
  landing_page text,
  gclid text,
  fbclid text,
  ip_address inet,
  user_agent text,
  attributed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index lead_attribution_lead_idx on public.lead_attribution (lead_id);
create index lead_attribution_campaign_idx on public.lead_attribution (utm_campaign);

-- CMS
create table public.services (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  summary text not null default '',
  description text not null default '',
  icon text,
  sort_order integer not null default 0,
  status public.cms_content_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger services_updated_at
  before update on public.services
  for each row execute function extensions.moddatetime (updated_at);

create index services_status_idx on public.services (status, sort_order);

create table public.industries (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null default '',
  icon text,
  sort_order integer not null default 0,
  status public.cms_content_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger industries_updated_at
  before update on public.industries
  for each row execute function extensions.moddatetime (updated_at);

create table public.testimonials (
  id uuid primary key default gen_random_uuid(),
  client_name text not null,
  client_title text,
  company_name text,
  quote text not null,
  avatar_url text,
  rating smallint check (rating is null or rating between 1 and 5),
  sort_order integer not null default 0,
  status public.cms_content_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger testimonials_updated_at
  before update on public.testimonials
  for each row execute function extensions.moddatetime (updated_at);

create table public.case_studies (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  client_name text,
  industry text,
  summary text not null default '',
  body text not null default '',
  hero_image_url text,
  results jsonb not null default '[]'::jsonb,
  status public.cms_content_status not null default 'draft',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger case_studies_updated_at
  before update on public.case_studies
  for each row execute function extensions.moddatetime (updated_at);

create index case_studies_status_idx on public.case_studies (status);

create table public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  excerpt text not null default '',
  body text not null default '',
  cover_image_url text,
  author_user_id uuid references public.profiles (id) on delete set null,
  tags text[] not null default '{}',
  status public.cms_content_status not null default 'draft',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger blog_posts_updated_at
  before update on public.blog_posts
  for each row execute function extensions.moddatetime (updated_at);

create index blog_posts_status_published_idx on public.blog_posts (status, published_at desc);

create table public.faqs (
  id uuid primary key default gen_random_uuid(),
  category text not null default 'general',
  question text not null,
  answer text not null,
  sort_order integer not null default 0,
  status public.cms_content_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger faqs_updated_at
  before update on public.faqs
  for each row execute function extensions.moddatetime (updated_at);

create index faqs_category_idx on public.faqs (category, sort_order);

create table public.site_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  description text,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

create trigger site_settings_updated_at
  before update on public.site_settings
  for each row execute function extensions.moddatetime (updated_at);

-- RLS
alter table public.job_posts enable row level security;
alter table public.applicants enable row level security;
alter table public.job_applications enable row level security;
alter table public.application_stage_history enable row level security;
alter table public.interviews enable row level security;
alter table public.assessments enable row level security;
alter table public.applicant_documents enable row level security;
alter table public.crm_leads enable row level security;
alter table public.crm_companies enable row level security;
alter table public.crm_contacts enable row level security;
alter table public.crm_deals enable row level security;
alter table public.crm_activities enable row level security;
alter table public.crm_proposals enable row level security;
alter table public.crm_contracts enable row level security;
alter table public.lead_attribution enable row level security;
alter table public.services enable row level security;
alter table public.industries enable row level security;
alter table public.testimonials enable row level security;
alter table public.case_studies enable row level security;
alter table public.blog_posts enable row level security;
alter table public.faqs enable row level security;
alter table public.site_settings enable row level security;

-- ATS: public read published jobs; recruiters manage
create policy job_posts_select_published
  on public.job_posts for select to authenticated
  using (
    status = 'published'
    or public.has_permission('recruitment.read')
    or public.has_permission('recruitment.manage')
  );

create policy job_posts_select_anon
  on public.job_posts for select to anon
  using (status = 'published');

create policy job_posts_manage
  on public.job_posts for all to authenticated
  using (public.has_permission('recruitment.manage'))
  with check (public.has_permission('recruitment.manage'));

create policy applicants_select
  on public.applicants for select to authenticated
  using (
    profile_id = (select auth.uid())
    or public.has_permission('recruitment.read')
    or public.has_permission('recruitment.manage')
  );

create policy applicants_insert
  on public.applicants for insert to authenticated
  with check (
    profile_id = (select auth.uid())
    or public.has_permission('recruitment.manage')
  );

create policy applicants_update
  on public.applicants for update to authenticated
  using (
    profile_id = (select auth.uid())
    or public.has_permission('recruitment.manage')
  )
  with check (
    profile_id = (select auth.uid())
    or public.has_permission('recruitment.manage')
  );

create policy job_applications_select
  on public.job_applications for select to authenticated
  using (
    exists (
      select 1 from public.applicants a
      where a.id = applicant_id and a.profile_id = (select auth.uid())
    )
    or public.has_permission('recruitment.read')
    or public.has_permission('recruitment.manage')
  );

create policy job_applications_insert
  on public.job_applications for insert to authenticated
  with check (
    exists (
      select 1 from public.applicants a
      where a.id = applicant_id and a.profile_id = (select auth.uid())
    )
    or public.has_permission('recruitment.manage')
  );

create policy job_applications_manage
  on public.job_applications for update to authenticated
  using (public.has_permission('recruitment.manage'))
  with check (public.has_permission('recruitment.manage'));

create policy application_stage_history_select
  on public.application_stage_history for select to authenticated
  using (
    exists (
      select 1
      from public.job_applications ja
      join public.applicants a on a.id = ja.applicant_id
      where ja.id = job_application_id
        and (
          a.profile_id = (select auth.uid())
          or public.has_permission('recruitment.read')
          or public.has_permission('recruitment.manage')
        )
    )
  );

create policy application_stage_history_insert
  on public.application_stage_history for insert to authenticated
  with check (public.has_permission('recruitment.manage'));

create policy interviews_select
  on public.interviews for select to authenticated
  using (
    public.has_permission('recruitment.read')
    or public.has_permission('recruitment.manage')
    or exists (
      select 1
      from public.job_applications ja
      join public.applicants a on a.id = ja.applicant_id
      where ja.id = job_application_id and a.profile_id = (select auth.uid())
    )
  );

create policy interviews_manage
  on public.interviews for all to authenticated
  using (public.has_permission('recruitment.manage'))
  with check (public.has_permission('recruitment.manage'));

create policy assessments_select
  on public.assessments for select to authenticated
  using (
    public.has_permission('recruitment.read')
    or public.has_permission('recruitment.manage')
    or exists (
      select 1
      from public.job_applications ja
      join public.applicants a on a.id = ja.applicant_id
      where ja.id = job_application_id and a.profile_id = (select auth.uid())
    )
  );

create policy assessments_manage
  on public.assessments for all to authenticated
  using (public.has_permission('recruitment.manage'))
  with check (public.has_permission('recruitment.manage'));

create policy applicant_documents_select
  on public.applicant_documents for select to authenticated
  using (
    public.has_permission('recruitment.read')
    or public.has_permission('recruitment.manage')
    or exists (
      select 1 from public.applicants a
      where a.id = applicant_id and a.profile_id = (select auth.uid())
    )
  );

create policy applicant_documents_insert
  on public.applicant_documents for insert to authenticated
  with check (
    public.has_permission('recruitment.manage')
    or exists (
      select 1 from public.applicants a
      where a.id = applicant_id and a.profile_id = (select auth.uid())
    )
  );

-- CRM (sales internal)
create policy crm_leads_select
  on public.crm_leads for select to authenticated
  using (
    public.has_permission('crm.read')
    or public.has_permission('crm.manage')
    or assigned_sales_user_id = (select auth.uid())
  );

create policy crm_leads_manage
  on public.crm_leads for all to authenticated
  using (public.has_permission('crm.manage'))
  with check (public.has_permission('crm.manage'));

create policy crm_companies_select
  on public.crm_companies for select to authenticated
  using (
    public.has_permission('crm.read')
    or public.has_permission('crm.manage')
  );

create policy crm_companies_manage
  on public.crm_companies for all to authenticated
  using (public.has_permission('crm.manage'))
  with check (public.has_permission('crm.manage'));

create policy crm_contacts_select
  on public.crm_contacts for select to authenticated
  using (
    public.has_permission('crm.read')
    or public.has_permission('crm.manage')
  );

create policy crm_contacts_manage
  on public.crm_contacts for all to authenticated
  using (public.has_permission('crm.manage'))
  with check (public.has_permission('crm.manage'));

create policy crm_deals_select
  on public.crm_deals for select to authenticated
  using (
    public.has_permission('crm.read')
    or public.has_permission('crm.manage')
    or owner_user_id = (select auth.uid())
  );

create policy crm_deals_manage
  on public.crm_deals for all to authenticated
  using (public.has_permission('crm.manage'))
  with check (public.has_permission('crm.manage'));

create policy crm_activities_select
  on public.crm_activities for select to authenticated
  using (
    public.has_permission('crm.read')
    or public.has_permission('crm.manage')
    or owner_user_id = (select auth.uid())
  );

create policy crm_activities_manage
  on public.crm_activities for all to authenticated
  using (public.has_permission('crm.manage'))
  with check (public.has_permission('crm.manage'));

create policy crm_proposals_select
  on public.crm_proposals for select to authenticated
  using (
    public.has_permission('crm.read')
    or public.has_permission('crm.manage')
  );

create policy crm_proposals_manage
  on public.crm_proposals for all to authenticated
  using (public.has_permission('crm.manage'))
  with check (public.has_permission('crm.manage'));

create policy crm_contracts_select
  on public.crm_contracts for select to authenticated
  using (
    public.has_permission('crm.read')
    or public.has_permission('crm.manage')
    or public.has_permission('clients.manage')
    or (
      client_organization_id is not null
      and public.can_access_client(client_organization_id)
    )
  );

create policy crm_contracts_manage
  on public.crm_contracts for all to authenticated
  using (
    public.has_permission('crm.manage')
    or public.has_permission('clients.manage')
  )
  with check (
    public.has_permission('crm.manage')
    or public.has_permission('clients.manage')
  );

create policy lead_attribution_select
  on public.lead_attribution for select to authenticated
  using (
    public.has_permission('crm.read')
    or public.has_permission('crm.manage')
  );

create policy lead_attribution_insert
  on public.lead_attribution for insert to authenticated
  with check (true);

-- CMS: public read published; marketing manages
create policy cms_services_select_published
  on public.services for select to authenticated
  using (status = 'published' or public.has_permission('cms.manage'));

create policy cms_services_select_anon
  on public.services for select to anon
  using (status = 'published');

create policy cms_services_manage
  on public.services for all to authenticated
  using (public.has_permission('cms.manage'))
  with check (public.has_permission('cms.manage'));

create policy cms_industries_select_published
  on public.industries for select to authenticated
  using (status = 'published' or public.has_permission('cms.manage'));

create policy cms_industries_select_anon
  on public.industries for select to anon
  using (status = 'published');

create policy cms_industries_manage
  on public.industries for all to authenticated
  using (public.has_permission('cms.manage'))
  with check (public.has_permission('cms.manage'));

create policy cms_testimonials_select_published
  on public.testimonials for select to authenticated
  using (status = 'published' or public.has_permission('cms.manage'));

create policy cms_testimonials_select_anon
  on public.testimonials for select to anon
  using (status = 'published');

create policy cms_testimonials_manage
  on public.testimonials for all to authenticated
  using (public.has_permission('cms.manage'))
  with check (public.has_permission('cms.manage'));

create policy cms_case_studies_select_published
  on public.case_studies for select to authenticated
  using (status = 'published' or public.has_permission('cms.manage'));

create policy cms_case_studies_select_anon
  on public.case_studies for select to anon
  using (status = 'published');

create policy cms_case_studies_manage
  on public.case_studies for all to authenticated
  using (public.has_permission('cms.manage'))
  with check (public.has_permission('cms.manage'));

create policy cms_blog_posts_select_published
  on public.blog_posts for select to authenticated
  using (status = 'published' or public.has_permission('cms.manage'));

create policy cms_blog_posts_select_anon
  on public.blog_posts for select to anon
  using (status = 'published');

create policy cms_blog_posts_manage
  on public.blog_posts for all to authenticated
  using (public.has_permission('cms.manage'))
  with check (public.has_permission('cms.manage'));

create policy cms_faqs_select_published
  on public.faqs for select to authenticated
  using (status = 'published' or public.has_permission('cms.manage'));

create policy cms_faqs_select_anon
  on public.faqs for select to anon
  using (status = 'published');

create policy cms_faqs_manage
  on public.faqs for all to authenticated
  using (public.has_permission('cms.manage'))
  with check (public.has_permission('cms.manage'));

create policy site_settings_select
  on public.site_settings for select to authenticated
  using (public.has_permission('cms.manage') or public.is_internal_user());

create policy site_settings_select_anon
  on public.site_settings for select to anon
  using (key in ('public_contact', 'public_social', 'public_seo'));

create policy site_settings_manage
  on public.site_settings for all to authenticated
  using (public.has_permission('cms.manage'))
  with check (public.has_permission('cms.manage'));
