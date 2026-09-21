-- Seed principal marketing services (upsert by slug).
-- Keeps CMS in sync with lib/marketing/services-catalog.ts fallbacks.

insert into public.services (slug, title, summary, description, sort_order, status)
values
  (
    'customer-support',
    'Customer Support',
    'Frontline voice, chat, and email talent who represent your brand — placed on your team, paid through Beepa.',
    'We source and place support professionals who match your hours, tools, and tone. You manage the work; we handle employment pay.',
    10,
    'published'
  ),
  (
    'back-office',
    'Back Office Support',
    'Ops talent for accurate day-to-day work — data, admin, and process execution without fixed headcount drag.',
    'Tell us the workflows. We find people who can execute them reliably, then manage salary so your core team stays focused on growth.',
    20,
    'published'
  ),
  (
    'virtual-assistants',
    'Virtual Assistants',
    'Administrative partners for calendars, inboxes, research, and priority follow-through.',
    'VA roles filled through Beepa’s manpower model: screened talent, clear placement, salary handled on our side.',
    30,
    'published'
  ),
  (
    'sales-support',
    'Sales Support',
    'Research, outreach, and pipeline support that extends your revenue team.',
    'We place sales-support talent who fit your CRM and cadence. You own the pipeline; we own finding people and paying them.',
    40,
    'published'
  ),
  (
    'it-support',
    'IT Support',
    'Helpdesk and desktop support talent who keep tools running for your team.',
    'We place IT support professionals who know your stack and hours. You direct the tickets; we handle hiring and pay.',
    50,
    'published'
  ),
  (
    'marketing',
    'Marketing',
    'Content, campaign, and channel support that extends your marketing bench.',
    'Brief the workstreams. We source marketers who execute against your brand and calendar, with salary managed by Beepa.',
    60,
    'published'
  ),
  (
    'elearning-course-dev',
    'eLearning Course Development',
    'Instructional designers and course builders for modules your L&D team owns.',
    'We place eLearning talent who can structure content, build in your LMS, and ship on your schedule. Employment stays with Beepa.',
    70,
    'published'
  ),
  (
    'slide-creator',
    'Slide Creator',
    'Presentation specialists who turn briefs into clear, on-brand decks.',
    'Need slides for pitches, training, or leadership reviews? We find creators who match your templates and turnaround, then manage their pay.',
    80,
    'published'
  ),
  (
    'data-entry',
    'Data Entry',
    'Accurate, high-volume data work without adding permanent headcount.',
    'We place data entry professionals who follow your systems and QA rules. You own the data; we own staffing and salary.',
    90,
    'published'
  ),
  (
    'customer-relations',
    'Customer Relations',
    'Account and relationship talent who nurture clients after the first contact.',
    'Distinct from frontline support: we place people focused on retention, follow-ups, and relationship health. You set the playbook; we place and pay the team.',
    100,
    'published'
  )
on conflict (slug) do update
set
  title = excluded.title,
  summary = excluded.summary,
  description = excluded.description,
  sort_order = excluded.sort_order,
  status = 'published',
  updated_at = now();
