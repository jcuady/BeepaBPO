// Batch 1: CMS re-seed — services, industries, testimonials, case_studies, blog_posts, faqs, site_settings.
// Idempotent upserts keyed on natural slugs / keys.
// Uses Supabase REST via service-role key.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  if (!line || line.trim().startsWith("#")) continue;
  const idx = line.indexOf("=");
  if (idx < 0) continue;
  let v = line.slice(idx + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  env[line.slice(0, idx).trim()] = v;
}
for (const [k, v] of Object.entries(env)) if (process.env[k] === undefined) process.env[k] = v;
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
process.env.SUPABASE_SECRET_KEY = "[redacted]";
process.env.SUPABASE_SERVICE_ROLE_KEY = "[redacted]";

const sb = createClient(URL, KEY, { auth: { persistSession: false } });

const TAG = "batch1-cms";
async function upsert(table, rows, conflict) {
  if (!rows.length) return { table, count: 0 };
  const { data, error } = await sb.from(table).upsert(rows, { onConflict: conflict, count: "exact" });
  if (error) {
    console.error(`[FAIL] ${table}:`, error.message);
    return { table, count: 0, error: error.message };
  }
  console.log(`[OK]   ${table.padEnd(16)} +${rows.length} rows (conflict: ${conflict})`);
  return { table, count: rows.length };
}

async function main() {
  console.log(`\n=== BATCH 1 — CMS re-seed (${TAG}) ===\n`);

  // 1) services (10 rows)
  await upsert("services", [
    { slug: "customer-support", title: "Customer Support", summary: "Frontline voice, chat, and email talent who represent your brand — placed on your team, paid through Beepa.", description: "We source and place support professionals who match your hours, tools, and tone. You manage the work; we handle employment pay.", sort_order: 10, status: "published", icon: "headset" },
    { slug: "back-office", title: "Back Office Support", summary: "Ops talent for accurate day-to-day work — data, admin, and process execution without fixed headcount drag.", description: "Tell us the workflows. We find people who can execute them reliably, then manage salary so your core team stays focused on growth.", sort_order: 20, status: "published", icon: "file-description" },
    { slug: "virtual-assistants", title: "Virtual Assistants", summary: "Administrative partners for calendars, inboxes, research, and priority follow-through.", description: "VA roles filled through Beepa's manpower model: screened talent, clear placement, salary handled on our side.", sort_order: 30, status: "published", icon: "users" },
    { slug: "sales-support", title: "Sales Support", summary: "Research, outreach, and pipeline support that extends your revenue team.", description: "We place sales-support talent who fit your CRM and cadence. You own the pipeline; we own finding people and paying them.", sort_order: 40, status: "published", icon: "chart-bar" },
    { slug: "it-support", title: "IT Support", summary: "Helpdesk and desktop support talent who keep tools running for your team.", description: "We place IT support professionals who know your stack and hours. You direct the tickets; we handle hiring and pay.", sort_order: 50, status: "published", icon: "device-desktop" },
    { slug: "marketing", title: "Marketing", summary: "Content, campaign, and channel support that extends your marketing bench.", description: "Brief the workstreams. We source marketers who execute against your brand and calendar, with salary managed by Beepa.", sort_order: 60, status: "published", icon: "speakerphone" },
    { slug: "elearning-course-dev", title: "eLearning Course Development", summary: "Instructional designers and course builders for modules your L&D team owns.", description: "We place eLearning talent who can structure content, build in your LMS, and ship on your schedule. Employment stays with Beepa.", sort_order: 70, status: "published", icon: "school" },
    { slug: "slide-creator", title: "Slide Creator", summary: "Presentation specialists who turn briefs into clear, on-brand decks.", description: "Need slides for pitches, training, or leadership reviews? We find creators who match your templates and turnaround, then manage their pay.", sort_order: 80, status: "published", icon: "presentation" },
    { slug: "data-entry", title: "Data Entry", summary: "Accurate, high-volume data work without adding permanent headcount.", description: "We place data entry professionals who follow your systems and QA rules. You own the data; we own staffing and salary.", sort_order: 90, status: "published", icon: "keyboard" },
    { slug: "customer-relations", title: "Customer Relations", summary: "Account and relationship talent who nurture clients after the first contact.", description: "Distinct from frontline support: we place people focused on retention, follow-ups, and relationship health. You set the playbook; we place and pay the team.", sort_order: 100, status: "published", icon: "heart-handshake" },
  ], "slug");

  // 2) industries (6 rows)
  await upsert("industries", [
    { slug: "saas", name: "SaaS & Tech", description: "Customer support, onboarding, and QA pods for product teams shipping software at speed.", sort_order: 10, status: "published", icon: "device-desktop" },
    { slug: "ecommerce", name: "E-commerce & Retail", description: "CX, returns, marketplace ops, and order management for online sellers and omnichannel brands.", sort_order: 20, status: "published", icon: "shopping-cart" },
    { slug: "fintech", name: "Fintech & Finance", description: "Back-office ops, KYC support, and customer service for financial product teams.", sort_order: 30, status: "published", icon: "coin" },
    { slug: "logistics", name: "Logistics & Supply", description: "Dispatcher support, appointment scheduling, and shipment case management for 3PLs and carriers.", sort_order: 40, status: "published", icon: "truck" },
    { slug: "healthtech", name: "Healthtech & Clinics", description: "Patient intake, scheduling, and after-hours coverage for clinics and digital health platforms.", sort_order: 50, status: "published", icon: "heartbeat" },
    { slug: "media", name: "Media & Agencies", description: "Research, slide production, and account coordination for agencies and publishers.", sort_order: 60, status: "published", icon: "speakerphone" },
  ], "slug");

  // 3) testimonials (4 rows)
  await upsert("testimonials", [
    { client_name: "Ana Reyes", client_title: "VP Customer Experience", company_name: "CloudPeak", quote: "Beepa staffed a 6-person support pod in three weeks. Our first-response time dropped 41% and the team feels like our own.", rating: 5, sort_order: 10, status: "published" },
    { client_name: "Marcus Lin", client_title: "Head of Operations", company_name: "Northwind", quote: "What I needed was payroll-backed people on my tools. Beepa delivered, and the salary admin disappeared from my week.", rating: 5, sort_order: 20, status: "published" },
    { client_name: "Priya Anand", client_title: "Director of CX", company_name: "Lumen Labs", quote: "The onboarding playbook was tight — the agents ramped in days, not months. Quality scores held above 90 from week one.", rating: 5, sort_order: 30, status: "published" },
    { client_name: "Jordan Hale", client_title: "Founder", company_name: "Saltworks", quote: "Briefs in, people out. Beepa runs the back-office so I can stay in the room with customers.", rating: 4, sort_order: 40, status: "published" },
  ], "id");

  // 4) case_studies (3 rows)
  const days = (d) => new Date(Date.now() - d * 86400000).toISOString();
  await upsert("case_studies", [
    {
      slug: "cloudpeak-support-pod",
      title: "CloudPeak doubled support capacity without doubling headcount cost",
      client_name: "CloudPeak",
      industry: "SaaS & Tech",
      summary: "A four-agent evening shift gave CloudPeak 16-hour coverage while keeping monthly cost flat.",
      body: "## The problem\nCloudPeak, a US-based SaaS team, was missing evening tickets and burning out the in-house team. Hiring locally took 3+ months and burned cash.\n\n## What Beepa did\nBriefed the role, sourced 6 candidates, ran two interview rounds, and placed a 4-agent pod in 18 days. Beepa owns salary, employment admin, and timekeeping.\n\n## What changed\nFirst-response time on evening tickets dropped from 9 hours to 38 minutes. CSAT held at 4.7/5 across the rollout quarter. The internal team got their evenings back.",
      results: [{ label: "First-response time", before: "9h 12m", after: "38m" }, { label: "Evening coverage", before: "0%", after: "100%" }, { label: "CSAT (90d)", before: "4.2", after: "4.7" }, { label: "Time to first placement", before: "3+ months", after: "18 days" }],
      status: "published",
      published_at: days(45),
    },
    {
      slug: "northwind-dispatcher-coverage",
      title: "Northwind covered 24/7 dispatch without paying overtime premiums",
      client_name: "Northwind Logistics",
      industry: "Logistics & Supply",
      summary: "Beepa placed a 3-person dispatcher team on US Mountain hours, eliminating after-hours overtime.",
      body: "## The problem\nNorthwind's in-house dispatchers were burning out on 14-hour rotations. Each new dispatcher cost $58k fully loaded.\n\n## What Beepa did\nSourced dispatch-experienced talent in PH on a night schedule overlapping Mountain Time. Three placements, payroll under Beepa, schedules in Northwind's TMS.\n\n## What changed\nAfter-hours overtime dropped to zero. On-time dispatch held at 96%. Northwind reallocated the saved budget to driver hiring instead.",
      results: [{ label: "After-hours overtime", before: "$11k/mo", after: "$0" }, { label: "On-time dispatch", before: "89%", after: "96%" }, { label: "Cost per dispatcher", before: "$58k", after: "$34k" }],
      status: "published",
      published_at: days(30),
    },
    {
      slug: "lumen-ramp-quality",
      title: "Lumen held 90+ QA scores from week one across a 12-person ramp",
      client_name: "Lumen Labs",
      industry: "Fintech & Finance",
      summary: "A 12-agent KYC-support pod with QA score above 90 from day seven.",
      body: "## The problem\nLumen needed to scale KYC support for a new product launch. Previous vendors averaged 60% QA pass at week one.\n\n## What Beepa did\nBuilt a custom interview rubric with Lumen, ran 4 days of role-play, and placed 12 agents in two cohorts. QA scripts and escalation paths were documented in week one.\n\n## What changed\nWeek-1 QA pass rate hit 91% — the team's first time above 90 at launch. Ramp-to-target was 11 days, half their previous record.",
      results: [{ label: "Week-1 QA pass", before: "60%", after: "91%" }, { label: "Time to ramp", before: "22 days", after: "11 days" }, { label: "Attrition (90d)", before: "18%", after: "6%" }],
      status: "published",
      published_at: days(14),
    },
  ], "slug");

  // 5) blog_posts (5 rows)
  await upsert("blog_posts", [
    { slug: "how-we-source-in-18-days", title: "How Beepa places a support pod in 18 days", excerpt: "The sourcing-to-start playbook we use for every BPO engagement, and what to expect from each step.", body: "## Day 0–2: Brief\nWe sit with the client team, define the role, the tools, the schedule, and the must-haves. The brief becomes the scorecard.\n\n## Day 3–7: Sourcing\nWe open sourcing across our talent pool and partner networks. Every candidate is screened against the scorecard before they reach the client.\n\n## Day 8–12: Interviews\nThe client runs one or two interview rounds. We coordinate scheduling and provide structured feedback templates.\n\n## Day 13–18: Placement\nThe chosen candidates sign with Beepa, complete HR onboarding, and start on the client's tools with a documented ramp plan.", tags: ["sourcing", "operations"], status: "published", published_at: days(20) },
    { slug: "us-hours-without-overtime", title: "US hours without overtime: the shift math that actually works", excerpt: "How to plan a PH-based team for US business hours without paying overtime premiums.", body: "## The math\nA 9-hour US Eastern workday lines up with a 21:00–06:00 PH schedule. That is overnight, but it is not overtime — it is a fixed schedule.\n\n## The trade-off\nOvernight shifts need a higher base and a clear cadence for handoff. We pair every overnight pod with a daytime lead in the same client team to keep the handoff warm.\n\n## When it works\n- Voice support, chat, ticket triage\n- Async-heavy roles (data, research, slide production)\n- 24/7 dispatch or NOC coverage", tags: ["scheduling", "operations"], status: "published", published_at: days(12) },
    { slug: "payroll-back-vs-payroll-build", title: "Payroll-backed vs payroll-built: which model fits your stage", excerpt: "A short guide to choosing between Beepa's payroll-backed model and building your own employment layer.", body: "## Payroll-backed (Beepa)\nBest for: companies scaling from 1 to 50 outsourced seats, with no in-country HR.\nYou get: people on your tools, salary on our books, employment admin off your plate.\n\n## Payroll-built (own entity)\nBest for: 50+ seats, multi-country, or compliance-heavy verticals.\nYou get: full control, but also full responsibility for filings, benefits, and local labor law.\n\nMost of our clients start on the payroll-backed model and migrate to a built entity at the 30–50 seat mark. We help with that handoff.", tags: ["payroll", "strategy"], status: "published", published_at: days(7) },
    { slug: "qa-from-day-one", title: "Why QA scores matter on day one, not day thirty", excerpt: "The hidden cost of launching a BPO pod without a quality framework — and how to avoid it.", body: "A pod that starts at 60% QA pass and ramps to 90% over 30 days is not the same as a pod that starts at 90%. The first 30 days are the impression window — clients judge the entire engagement by what they see in week one.\n\nWe structure every ramp with a documented QA rubric, a sample-day review in week one, and a weekly feedback loop until the pod hits target.", tags: ["quality", "ramp"], status: "draft", published_at: null },
    { slug: "when-not-to-outsource", title: "When NOT to outsource a role", excerpt: "A short, honest list of roles that are usually better kept in-house.", body: "Some roles do not outsource well — even with great partners. Here is the short list we use with prospective clients:\n\n1. Founder-facing executive assistance for a new CEO\n2. Anything requiring physical presence (hardware, in-person sales)\n3. Roles that depend on undocumented tribal knowledge\n4. Roles where the cost of context-switching exceeds the savings\n\nIf you are in one of these, Beepa is probably not the right fit. We will say so in the first call.", tags: ["strategy"], status: "published", published_at: days(3) },
  ], "slug");

  // 6) faqs (7 rows)
  await upsert("faqs", [
    { category: "general", question: "What roles can Beepa help us hire?", answer: "Beepa supports customer support, back office, virtual assistants, sales support, IT, marketing, eLearning course development, slide production, data entry, and customer relations. If you have a BPO-shaped role that is not on this list, we will still source — the list is not exhaustive.", sort_order: 10, status: "published" },
    { category: "sourcing", question: "How does Beepa select professionals?", answer: "We define requirements with you, source candidates who fit the brief, and run a structured interview loop. Clients run the final round before any placement.", sort_order: 20, status: "published" },
    { category: "hours", question: "Can Beepa support US business hours?", answer: "Yes. PH-based teams cover US Eastern, Central, and Mountain hours through fixed overnight schedules. We plan shifts around how your business actually runs.", sort_order: 30, status: "published" },
    { category: "onboarding", question: "How does onboarding work?", answer: "Once a hire is confirmed, Beepa runs HR onboarding, payroll setup, and a documented ramp with your team. Most pods hit target metrics within 11 days.", sort_order: 40, status: "published" },
    { category: "scaling", question: "Can we scale our team later?", answer: "Yes. Beepa is built for flexible growth — you can add roles in weeks, not months, and the same brief format works for each new seat.", sort_order: 50, status: "published" },
    { category: "support", question: "How do clients communicate with Beepa?", answer: "You work with Beepa through a dedicated account contact. Approved clients also use the Beepa platform for ticket visibility, attendance, and approvals.", sort_order: 60, status: "published" },
    { category: "getting-started", question: "How do we start?", answer: "Share what your business needs. We begin with a 30-minute discovery call, then move into a written brief, sourcing, and placement together.", sort_order: 70, status: "published" },
  ], "id");

  // 7) site_settings (3 keys)
  await upsert("site_settings", [
    { key: "public_contact", value: { email: "hello@beepabpo.com", phone: "+63 (2) 8123 4567", address_line1: "Beepa BPO", address_line2: "Makati City, Metro Manila, Philippines" }, description: "Public contact info shown in footer and /contact page." },
    { key: "public_social", value: { linkedin: "https://www.linkedin.com/company/beepa", facebook: "https://www.facebook.com/beepa", instagram: "https://www.instagram.com/beepa", youtube: "https://www.youtube.com/@beepa" }, description: "Public social URLs shown in footer." },
    { key: "public_seo", value: { title: "BeepoBPO | People-First BPO Outsourcing Partner", description: "BeepoBPO is a people-first BPO partner for dependable support, ops, and talent teams. Scale with confidence.", og_image: "/images/og.png", twitter_handle: "@beepabpo" }, description: "Default SEO overrides for the public site." },
  ], "key");

  console.log("\n=== BATCH 1 DONE ===\n");
}

main().catch((e) => {
  console.error("FATAL", e.message);
  process.exit(1);
});