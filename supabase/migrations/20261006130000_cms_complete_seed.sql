-- 2026-10-06 — CMS complete seed (Batch 1)
-- Re-seeds services, industries, testimonials, case_studies, blog_posts, faqs, site_settings.
-- All upserts keyed on natural slugs/keys — safe to re-run.

-- 1) services: re-apply the 10 marketing roles (also covered by 20260921100000 if not present).
insert into public.services (slug, title, summary, description, sort_order, status, icon)
values
  ('customer-support',  'Customer Support',           'Frontline voice, chat, and email talent who represent your brand — placed on your team, paid through Beepa.',  'We source and place support professionals who match your hours, tools, and tone. You manage the work; we handle employment pay.',                10, 'published', 'headset'),
  ('back-office',       'Back Office Support',        'Ops talent for accurate day-to-day work — data, admin, and process execution without fixed headcount drag.',         'Tell us the workflows. We find people who can execute them reliably, then manage salary so your core team stays focused on growth.',           20, 'published', 'file-description'),
  ('virtual-assistants','Virtual Assistants',         'Administrative partners for calendars, inboxes, research, and priority follow-through.',                            'VA roles filled through Beepa’s manpower model: screened talent, clear placement, salary handled on our side.',                                30, 'published', 'users'),
  ('sales-support',     'Sales Support',              'Research, outreach, and pipeline support that extends your revenue team.',                                            'We place sales-support talent who fit your CRM and cadence. You own the pipeline; we own finding people and paying them.',                  40, 'published', 'chart-bar'),
  ('it-support',        'IT Support',                 'Helpdesk and desktop support talent who keep tools running for your team.',                                         'We place IT support professionals who know your stack and hours. You direct the tickets; we handle hiring and pay.',                      50, 'published', 'device-desktop'),
  ('marketing',         'Marketing',                  'Content, campaign, and channel support that extends your marketing bench.',                                          'Brief the workstreams. We source marketers who execute against your brand and calendar, with salary managed by Beepa.',                    60, 'published', 'speakerphone'),
  ('elearning-course-dev','eLearning Course Development','Instructional designers and course builders for modules your L&D team owns.',                                    'We place eLearning talent who can structure content, build in your LMS, and ship on your schedule. Employment stays with Beepa.',          70, 'published', 'school'),
  ('slide-creator',     'Slide Creator',              'Presentation specialists who turn briefs into clear, on-brand decks.',                                             'Need slides for pitches, training, or leadership reviews? We find creators who match your templates and turnaround, then manage their pay.',80, 'published', 'presentation'),
  ('data-entry',        'Data Entry',                 'Accurate, high-volume data work without adding permanent headcount.',                                                'We place data entry professionals who follow your systems and QA rules. You own the data; we own staffing and salary.',                   90, 'published', 'keyboard'),
  ('customer-relations','Customer Relations',         'Account and relationship talent who nurture clients after the first contact.',                                      'Distinct from frontline support: we place people focused on retention, follow-ups, and relationship health. You set the playbook; we place and pay the team.', 100, 'published', 'heart-handshake')
on conflict (slug) do update
set
  title = excluded.title,
  summary = excluded.summary,
  description = excluded.description,
  sort_order = excluded.sort_order,
  status = excluded.status,
  icon = excluded.icon,
  updated_at = now();

-- 2) industries — used by /about and case_studies joins.
insert into public.industries (slug, name, description, sort_order, status, icon)
values
  ('saas',         'SaaS & Tech',          'Customer support, onboarding, and QA pods for product teams shipping software at speed.',            10, 'published', 'device-desktop'),
  ('ecommerce',    'E-commerce & Retail',  'CX, returns, marketplace ops, and order management for online sellers and omnichannel brands.',     20, 'published', 'shopping-cart'),
  ('fintech',      'Fintech & Finance',    'Back-office ops, KYC support, and customer service for financial product teams.',                   30, 'published', 'coin'),
  ('logistics',    'Logistics & Supply',   'Dispatcher support, appointment scheduling, and shipment case management for 3PLs and carriers.',  40, 'published', 'truck'),
  ('healthtech',   'Healthtech & Clinics', 'Patient intake, scheduling, and after-hours coverage for clinics and digital health platforms.',     50, 'published', 'heartbeat'),
  ('media',        'Media & Agencies',     'Research, slide production, and account coordination for agencies and publishers.',                 60, 'published', 'speakerphone')
on conflict (slug) do update
set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  status = excluded.status,
  icon = excluded.icon,
  updated_at = now();

-- 3) testimonials — used by /about + home.
insert into public.testimonials (client_name, client_title, company_name, quote, rating, sort_order, status)
values
  ('Ana Reyes',         'VP Customer Experience',  'CloudPeak',  'Beepa staffed a 6-person support pod in three weeks. Our first-response time dropped 41% and the team feels like our own.', 5, 10, 'published'),
  ('Marcus Lin',        'Head of Operations',      'Northwind',  'What I needed was payroll-backed people on my tools. Beepa delivered, and the salary admin disappeared from my week.',     5, 20, 'published'),
  ('Priya Anand',       'Director of CX',          'Lumen Labs', 'The onboarding playbook was tight — the agents ramped in days, not months. Quality scores held above 90 from week one.',     5, 30, 'published'),
  ('Jordan Hale',       'Founder',                 'Saltworks',  'Briefs in, people out. Beepa runs the back-office so I can stay in the room with customers.',                            4, 40, 'published')
on conflict do nothing;

-- 4) case_studies — used by /case-studies + /case-studies/[slug].
insert into public.case_studies (slug, title, client_name, industry, summary, body, results, hero_image_url, status, published_at)
values
  (
    'cloudpeak-support-pod',
    'CloudPeak doubled support capacity without doubling headcount cost',
    'CloudPeak',
    'SaaS & Tech',
    'A four-agent evening shift gave CloudPeak 16-hour coverage while keeping monthly cost flat.',
    '## The problem\nCloudPeak, a US-based SaaS team, was missing evening tickets and burning out the in-house team. Hiring locally took 3+ months and burned cash.\n\n## What Beepa did\nBriefed the role, sourced 6 candidates, ran two interview rounds, and placed a 4-agent pod in 18 days. Beepa owns salary, employment admin, and timekeeping.\n\n## What changed\nFirst-response time on evening tickets dropped from 9 hours to 38 minutes. CSAT held at 4.7/5 across the rollout quarter. The internal team got their evenings back.',
    '[{"label":"First-response time","before":"9h 12m","after":"38m"},{"label":"Evening coverage","before":"0%","after":"100%"},{"label":"CSAT (90d)","before":"4.2","after":"4.7"},{"label":"Time to first placement","before":"3+ months","after":"18 days"}]'::jsonb,
    null,
    'published',
    now() - interval '45 days'
  ),
  (
    'northwind-dispatcher-coverage',
    'Northwind covered 24/7 dispatch without paying overtime premiums',
    'Northwind Logistics',
    'Logistics & Supply',
    'Beepa placed a 3-person dispatcher team on US Mountain hours, eliminating after-hours overtime.',
    '## The problem\nNorthwind''s in-house dispatchers were burning out on 14-hour rotations. Each new dispatcher cost $58k fully loaded.\n\n## What Beepa did\nSourced dispatch-experienced talent in PH on a night schedule overlapping Mountain Time. Three placements, payroll under Beepa, schedules in Northwind''s TMS.\n\n## What changed\nAfter-hours overtime dropped to zero. On-time dispatch held at 96%. Northwind reallocated the saved budget to driver hiring instead.',
    '[{"label":"After-hours overtime","before":"$11k/mo","after":"$0"},{"label":"On-time dispatch","before":"89%","after":"96%"},{"label":"Cost per dispatcher","before":"$58k","after":"$34k"}]'::jsonb,
    null,
    'published',
    now() - interval '30 days'
  ),
  (
    'lumen-ramp-quality',
    'Lumen held 90+ QA scores from week one across a 12-person ramp',
    'Lumen Labs',
    'Fintech & Finance',
    'A 12-agent KYC-support pod with QA score above 90 from day seven.',
    '## The problem\nLumen needed to scale KYC support for a new product launch. Previous vendors averaged 60% QA pass at week one.\n\n## What Beepa did\nBuilt a custom interview rubric with Lumen, ran 4 days of role-play, and placed 12 agents in two cohorts. QA scripts and escalation paths were documented in week one.\n\n## What changed\nWeek-1 QA pass rate hit 91% — the team''s first time above 90 at launch. Ramp-to-target was 11 days, half their previous record.',
    '[{"label":"Week-1 QA pass","before":"60%","after":"91%"},{"label":"Time to ramp","before":"22 days","after":"11 days"},{"label":"Attrition (90d)","before":"18%","after":"6%"}]'::jsonb,
    null,
    'published',
    now() - interval '14 days'
  )
on conflict (slug) do update
set
  title = excluded.title,
  client_name = excluded.client_name,
  industry = excluded.industry,
  summary = excluded.summary,
  body = excluded.body,
  results = excluded.results,
  status = excluded.status,
  published_at = excluded.published_at,
  updated_at = now();

-- 5) blog_posts — used by /resources.
insert into public.blog_posts (slug, title, excerpt, body, tags, status, published_at)
values
  (
    'how-we-source-in-18-days',
    'How Beepa places a support pod in 18 days',
    'The sourcing-to-start playbook we use for every BPO engagement, and what to expect from each step.',
    '## Day 0–2: Brief\nWe sit with the client team, define the role, the tools, the schedule, and the must-haves. The brief becomes the scorecard.\n\n## Day 3–7: Sourcing\nWe open sourcing across our talent pool and partner networks. Every candidate is screened against the scorecard before they reach the client.\n\n## Day 8–12: Interviews\nThe client runs one or two interview rounds. We coordinate scheduling and provide structured feedback templates.\n\n## Day 13–18: Placement\nThe chosen candidates sign with Beepa, complete HR onboarding, and start on the client''s tools with a documented ramp plan.',
    array['sourcing','operations'],
    'published',
    now() - interval '20 days'
  ),
  (
    'us-hours-without-overtime',
    'US hours without overtime: the shift math that actually works',
    'How to plan a PH-based team for US business hours without paying overtime premiums.',
    '## The math\nA 9-hour US Eastern workday lines up with a 21:00–06:00 PH schedule. That is overnight, but it is not overtime — it is a fixed schedule.\n\n## The trade-off\nOvernight shifts need a higher base and a clear cadence for handoff. We pair every overnight pod with a daytime lead in the same client team to keep the handoff warm.\n\n## When it works\n- Voice support, chat, ticket triage\n- Async-heavy roles (data, research, slide production)\n- 24/7 dispatch or NOC coverage',
    array['scheduling','operations'],
    'published',
    now() - interval '12 days'
  ),
  (
    'payroll-back-vs-payroll-build',
    'Payroll-backed vs payroll-built: which model fits your stage',
    'A short guide to choosing between Beepa''s payroll-backed model and building your own employment layer.',
    '## Payroll-backed (Beepa)\nBest for: companies scaling from 1 to 50 outsourced seats, with no in-country HR.\nYou get: people on your tools, salary on our books, employment admin off your plate.\n\n## Payroll-built (own entity)\nBest for: 50+ seats, multi-country, or compliance-heavy verticals.\nYou get: full control, but also full responsibility for filings, benefits, and local labor law.\n\nMost of our clients start on the payroll-backed model and migrate to a built entity at the 30–50 seat mark. We help with that handoff.',
    array['payroll','strategy'],
    'published',
    now() - interval '7 days'
  ),
  (
    'qa-from-day-one',
    'Why QA scores matter on day one, not day thirty',
    'The hidden cost of launching a BPO pod without a quality framework — and how to avoid it.',
    'A pod that starts at 60% QA pass and ramps to 90% over 30 days is not the same as a pod that starts at 90%. The first 30 days are the impression window — clients judge the entire engagement by what they see in week one.\n\nWe structure every ramp with a documented QA rubric, a sample-day review in week one, and a weekly feedback loop until the pod hits target.',
    array['quality','ramp'],
    'draft',
    null
  ),
  (
    'when-not-to-outsource',
    'When NOT to outsource a role',
    'A short, honest list of roles that are usually better kept in-house.',
    'Some roles do not outsource well — even with great partners. Here is the short list we use with prospective clients:\n\n1. Founder-facing executive assistance for a new CEO\n2. Anything requiring physical presence (hardware, in-person sales)\n3. Roles that depend on undocumented tribal knowledge\n4. Roles where the cost of context-switching exceeds the savings\n\nIf you are in one of these, Beepa is probably not the right fit. We will say so in the first call.',
    array['strategy'],
    'published',
    now() - interval '3 days'
  )
on conflict (slug) do update
set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  tags = excluded.tags,
  status = excluded.status,
  published_at = excluded.published_at,
  updated_at = now();

-- 6) faqs — used by landing + /about.
insert into public.faqs (category, question, answer, sort_order, status)
values
  ('general',    'What roles can Beepa help us hire?',
               'Beepa supports customer support, back office, virtual assistants, sales support, IT, marketing, eLearning course development, slide production, data entry, and customer relations. If you have a BPO-shaped role that is not on this list, we will still source — the list is not exhaustive.',
               10, 'published'),
  ('sourcing',   'How does Beepa select professionals?',
               'We define requirements with you, source candidates who fit the brief, and run a structured interview loop. Clients run the final round before any placement.',
               20, 'published'),
  ('hours',      'Can Beepa support US business hours?',
               'Yes. PH-based teams cover US Eastern, Central, and Mountain hours through fixed overnight schedules. We plan shifts around how your business actually runs.',
               30, 'published'),
  ('onboarding', 'How does onboarding work?',
               'Once a hire is confirmed, Beepa runs HR onboarding, payroll setup, and a documented ramp with your team. Most pods hit target metrics within 11 days.',
               40, 'published'),
  ('scaling',    'Can we scale our team later?',
               'Yes. Beepa is built for flexible growth — you can add roles in weeks, not months, and the same brief format works for each new seat.',
               50, 'published'),
  ('support',    'How do clients communicate with Beepa?',
               'You work with Beepa through a dedicated account contact. Approved clients also use the Beepa platform for ticket visibility, attendance, and approvals.',
               60, 'published'),
  ('getting-started', 'How do we start?',
               'Share what your business needs. We begin with a 30-minute discovery call, then move into a written brief, sourcing, and placement together.',
               70, 'published')
on conflict do nothing;

-- 7) site_settings — anon-readable keys drive footer + contact.
insert into public.site_settings (key, value, description)
values
  ('public_contact', jsonb_build_object(
      'email', 'hello@beepabpo.com',
      'phone', '+63 (2) 8123 4567',
      'address_line1', 'Beepa BPO',
      'address_line2', 'Makati City, Metro Manila, Philippines'
    ),
    'Public contact info shown in footer and /contact page.'),
  ('public_social', jsonb_build_object(
      'linkedin',   'https://www.linkedin.com/company/beepa',
      'facebook',   'https://www.facebook.com/beepa',
      'instagram',  'https://www.instagram.com/beepa',
      'youtube',    'https://www.youtube.com/@beepa'
    ),
    'Public social URLs shown in footer.'),
  ('public_seo', jsonb_build_object(
      'title',          'BeepoBPO | People-First BPO Outsourcing Partner',
      'description',    'BeepoBPO is a people-first BPO partner for dependable support, ops, and talent teams. Scale with confidence.',
      'og_image',       '/images/og.png',
      'twitter_handle', '@beepabpo'
    ),
    'Default SEO overrides for the public site.')
on conflict (key) do update
set
  value = excluded.value,
  description = excluded.description,
  updated_at = now();
