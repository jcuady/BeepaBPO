#!/usr/bin/env node
// Seed realistic demo fixtures for the feature areas that currently render
// empty states for a signed-in user.
//
// WHY: `scripts/audit/audit-data-population.mjs` reported 594 rows across every
// table the app queries. attendance_records=2 for 10 employees, tickets=1,
// crm_activities=0, job_applications=1, invoices=1, documents=2. Those pages
// load cleanly and pass every reachability and console audit while showing
// "no records" — which is the first thing a real person would see and the last
// thing a green gate would notice.
//
// DELIBERATELY NOT SEEDED: payroll. payroll_periods/payroll_records/payslips
// were reconciled by `scripts/reconcile-payroll-period-overlap.mjs` and
// `scripts/seed-payroll-window.mjs`, and payslips exist only against finalized
// periods. Writing rows there would fight that invariant. Attendance and
// payroll already have enough rows for their pages to render.
//
// IDEMPOTENT: every insert is keyed on a natural column and skipped when a row
// already carries that key. Re-running --apply is a no-op, so this is safe to
// run twice and safe to leave in the repo.
//
// DRY RUN BY DEFAULT. Nothing is written without --apply.
//
// Usage:
//   node scripts/seed-qa-fixtures.mjs            # plan only
//   node scripts/seed-qa-fixtures.mjs --apply    # write
//   node scripts/seed-qa-fixtures.mjs --apply --only=tickets,attendance

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  if (!line || line.trim().startsWith("#")) continue;
  const i = line.indexOf("=");
  if (i < 0) continue;
  let v = line.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  env[line.slice(0, i).trim()] = v;
}

const APPLY = process.argv.includes("--apply");
const onlyArg = process.argv.find((a) => a.startsWith("--only="));
const ONLY = onlyArg ? onlyArg.slice("--only=".length).split(",").map((s) => s.trim()) : null;

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

/** Deterministic PRNG so repeated runs produce the same fixtures. */
let seed = 20261010;
function rnd() {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const between = (a, b) => a + Math.floor(rnd() * (b - a + 1));

const plan = [];
let inserted = 0;
let skipped = 0;
const failures = [];

/** Record an intent; write only when --apply. */
async function insert(table, row, keyCols) {
  // Idempotency: if a row already matches every key column, skip it.
  let q = db.from(table).select("id").limit(1);
  for (const k of keyCols) q = q.eq(k, row[k]);
  const { data: existing } = await q;
  if (existing && existing.length) { skipped += 1; return null; }

  plan.push(`${table}: ${JSON.stringify(row).slice(0, 150)}`);
  if (!APPLY) return null;

  const { data, error } = await db.from(table).insert(row).select("id").single();
  if (error) {
    failures.push(`${table}: ${error.message}`);
    return null;
  }
  inserted += 1;
  return data.id;
}

// ---------- load the world ----------
// Surface load failures. A select against a column that does not exist returns
// null with no throw, which is how the first draft of this script reported
// "0 candidate attendance rows" while employees was simply undefined.
async function load(label, table, select, { single = false, eq } = {}) {
  let q = db.from(table).select(select);
  if (eq) for (const [k, v] of Object.entries(eq)) q = q.eq(k, v);
  const { data, error } = single ? await q.maybeSingle() : await q;
  if (error) {
    console.error(`FATAL: could not load ${label} (${table}): ${error.message}`);
    process.exitCode = 1;
    throw new Error(`load ${table} failed: ${error.message}`);
  }
  return data;
}

const orgs = await load("organizations", "organizations", "id, name, type");
const employees = await load("employees", "employees",
  "id, profile_id, employee_number, job_title, organization_id, department_id, team_id, hire_date");
const departments = await load("departments", "departments", "id, name");
const leads = await load("leads", "crm_leads", "id, company_name");
const { data: users } = await db.auth.admin.listUsers({ page: 1, perPage: 200 });

const internalOrg = orgs?.find((o) => o.type === "internal") ?? orgs?.[0];
const clientOrgs = orgs?.filter((o) => o.type !== "internal") ?? [];

console.log(`world: ${orgs?.length} orgs, ${employees?.length} employees, ${leads?.length} leads, ${users?.users?.length} users`);
console.log(`mode: ${APPLY ? "APPLY (writes)" : "DRY RUN (no writes)"}`);
if (ONLY) console.log(`only: ${ONLY.join(", ")}`);
console.log();

const want = (area) => !ONLY || ONLY.includes(area);
const today = new Date();
const iso = (d) => d.toISOString().slice(0, 10);
const workday = (d) => d.getDay() !== 0 && d.getDay() !== 6;

// ---------- attendance ----------
if (want("attendance")) {
  let n = 0;
  for (const emp of employees ?? []) {
    for (let back = 28; back >= 1; back -= 1) {
      const d = new Date(today);
      d.setDate(d.getDate() - back);
      if (!workday(d)) continue;
      // Weekends off; the occasional leave/absent day so the list is not uniform.
      const roll = rnd();
      if (roll < 0.06) {
        await insert("attendance_records", {
          employee_id: emp.id, work_date: iso(d), worked_minutes: 0, break_minutes: 0,
          late_minutes: 0, undertime_minutes: 0, overtime_minutes: 0,
          status: "leave", approval_status: "finalized",
        }, ["employee_id", "work_date"]);
        n += 1;
        continue;
      }
      const late = roll > 0.88 ? between(5, 40) : 0;
      const lateMin = late || between(2, 12);
      const ot = rnd() > 0.82 ? between(15, 95) : 0;
      const clockIn = new Date(`${iso(d)}T${String(8 + (lateMin > 10 ? 1 : 0)).padStart(2, "0")}:${String(lateMin).padStart(2, "0")}:00.000Z`);
      const clockOut = new Date(clockIn.getTime() + (480 + ot) * 60000);
      await insert("attendance_records", {
        employee_id: emp.id,
        work_date: iso(d),
        clock_in_at: clockIn.toISOString(),
        clock_out_at: clockOut.toISOString(),
        worked_minutes: 480,
        break_minutes: 60,
        late_minutes: late,
        undertime_minutes: 0,
        overtime_minutes: ot,
        status: late > 0 ? "late" : "present",
        approval_status: "finalized",
      }, ["employee_id", "work_date"]);
      n += 1;
    }
  }
  console.log(`attendance: ${n} candidate rows (employee x weekday, last 4 weeks)`);
}

// ---------- tickets ----------
if (want("tickets")) {
  const SUBJECTS = [
    ["Payroll discrepancy — June", "payroll", "urgent"],
    ["Request additional headcount for support", "additional_employee", "high"],
    ["Attendance correction for last Monday", "attendance", "normal"],
    ["Schedule swap request", "schedule_change", "normal"],
    ["Cannot access client reporting portal", "technical", "high"],
    ["Performance review follow-up", "performance", "normal"],
    ["Employee replacement request", "replacement_request", "high"],
    ["Billing question on latest invoice", "billing", "normal"],
    ["New agent onboarding access needed", "hr", "normal"],
    ["Escalation — agent not reporting on time", "employee_concern", "urgent"],
    ["Implementation checklist status", "implementation", "low"],
    ["Request SOP update acknowledgement", "general", "low"],
  ];
  const STATUSES = ["new", "assigned", "in_progress", "waiting_for_client", "resolved", "closed"];
  let n = 0;
  for (const [subject, category, priority] of SUBJECTS) {
    const created = new Date(today);
    created.setDate(created.getDate() - between(1, 40));
    const status = STATUSES[n % STATUSES.length];
    const requester = pick(users?.users ?? []);
    const assignee = pick((users?.users ?? []).filter((u) => u.email?.includes("demo")));
    const ticketNumber = `TKT-${String(1000 + n)}`;
    const id = await insert("tickets", {
      ticket_number: ticketNumber,
      client_organization_id: clientOrgs[n % Math.max(clientOrgs.length, 1)]?.id ?? null,
      requester_user_id: requester?.id,
      employee_id: null,
      category,
      priority,
      status,
      assigned_team: pick(["Support", "Payroll", "HR", "Operations"]),
      assigned_user_id: assignee?.id ?? null,
      subject,
      description: `${subject}. Raised by ${requester?.email ?? "a client contact"} through the client portal. Please advise on the next step and expected turnaround.`,
      first_response_at: status === "new" ? null : new Date(created.getTime() + 3600_000 * between(1, 8)).toISOString(),
      resolved_at: status === "resolved" || status === "closed" ? new Date(created.getTime() + 3600_000 * between(24, 96)).toISOString() : null,
      sla_due_at: new Date(created.getTime() + 3600_000 * 48).toISOString(),
      created_at: created.toISOString(),
    }, ["ticket_number"]);

    if (id) {
      // A real thread, so the ticket detail page is not a single lonely row.
      const msgs = [
        [requester?.id, `Hi team — raising this to confirm we received it. ${subject}.`, false],
        [assignee?.id ?? requester?.id, "Thanks for flagging. We are reviewing this with the assigned team and will come back with specifics shortly.", false],
        [requester?.id, "Appreciate the quick turnaround. Please include the impact on our monthly report.", false],
      ];
      for (let m = 0; m < msgs.length; m += 1) {
        const [author, body, internal] = msgs[m];
        await insert("ticket_messages", {
          ticket_id: id,
          author_user_id: author,
          body,
          is_internal: internal,
          created_at: new Date(created.getTime() + 3600_000 * (m + 1)).toISOString(),
        }, ["ticket_id", "body"]);
      }
    }
    n += 1;
  }
  console.log(`tickets: ${n} tickets with message threads`);
}

// ---------- CRM ----------
if (want("crm")) {
  const DEALS = [
    ["CloudPeak — 8-seat support expansion", "negotiation", 640000],
    ["Northwind — finance & payroll outsourcing", "proposal", 420000],
    ["Atlas Retail — contact centre buildout", "discovery", 980000],
    ["Vertex Labs — 3-agent QA team", "qualified", 285000],
    ["Harbor Logistics — after-hours coverage", "won", 510000],
    ["Kibo Media — seasonal surge staff", "lost", 180000],
  ];
  for (let i = 0; i < DEALS.length; i += 1) {
    const [title, stage, value] = DEALS[i];
    const owner = pick(users?.users ?? []);
    const dealId = await insert("crm_deals", {
      lead_id: leads?.[i % Math.max(leads.length, 1)]?.id ?? null,
      title,
      stage,
      estimated_value: value,
      currency: "PHP",
      expected_close_date: iso(new Date(today.getTime() + 86400_000 * between(10, 90))),
      owner_user_id: owner?.id,
      client_organization_id: stage === "won" ? clientOrgs[i % Math.max(clientOrgs.length, 1)]?.id ?? null : null,
      created_at: new Date(today.getTime() - 86400_000 * between(20, 120)).toISOString(),
    }, ["title"]);

    if (dealId) {
      await insert("crm_proposals", {
        deal_id: dealId,
        title: `Proposal — ${title}`,
        amount: value,
        currency: "PHP",
        status: pick(["draft", "sent", "viewed", "accepted"]),
        sent_at: new Date(today.getTime() - 86400_000 * between(1, 20)).toISOString(),
        created_by: owner?.id,
        created_at: new Date(today.getTime() - 86400_000 * between(1, 25)).toISOString(),
      }, ["deal_id", "title"]);

      const ACTIVITIES = [
        ["call", "Discovery call", "Walked through current headcount, coverage hours, and pain points."],
        ["email", "Sent capability deck", "Shared the BPO capability deck and three case studies."],
        ["meeting", "Site meeting", "Met the operations lead onsite to map the transition plan."],
        ["note", "Budget confirmed", "Client confirmed budget band; decision expected this quarter."],
      ];
      for (const [type, subject, body] of ACTIVITIES) {
        await insert("crm_activities", {
          deal_id: dealId,
          activity_type: type,
          subject,
          body,
          completed_at: new Date(today.getTime() - 86400_000 * between(1, 30)).toISOString(),
          owner_user_id: owner?.id,
          created_at: new Date(today.getTime() - 86400_000 * between(1, 35)).toISOString(),
        }, ["deal_id", "subject"]);
      }
    }
  }
  console.log(`crm: ${DEALS.length} deals with proposals + activity timelines`);
}

// ---------- recruitment ----------
if (want("recruitment")) {
  const STAGES = ["applied", "screening", "initial_interview", "assessment", "client_endorsement", "client_interview", "offer", "hired", "rejected"];
  const JOBS = [
    ["Customer Support Representative", "support"],
    ["Payroll Officer", "payroll"],
    ["Quality Assurance Analyst", "quality"],
    ["HR Generalist", "hr"],
  ];
  for (const [title, slug] of JOBS) {
    const dept = departments?.[between(0, Math.max(departments.length - 1, 0))];
    const jobId = await insert("job_posts", {
      organization_id: internalOrg?.id,
      title,
      slug,
      department_id: dept?.id ?? null,
      employment_type: "regular",
      location_type: "onsite",
      location_text: "Cebu City, Philippines",
      description: `We are hiring a ${title} to join our delivery team supporting international clients. You will handle day-to-day operations, collaborate across functions, and escalate to the team lead when needed.`,
      responsibilities: "Handle client-facing work, maintain accurate records, and meet agreed service levels.",
      requirements: "At least 1 year of relevant experience, strong communication, and comfort with shift work.",
      nice_to_have: "Experience in a BPO or shared-services environment is a plus.",
      salary_display: "₱18,000 – ₱28,000 monthly",
      status: "published",
      published_at: new Date(today.getTime() - 86400_000 * between(5, 40)).toISOString(),
      created_by: users?.users?.[0]?.id,
      created_at: new Date(today.getTime() - 86400_000 * between(5, 45)).toISOString(),
    }, ["slug"]);

    if (!jobId) continue;

    const APPLICANTS = [
      ["Andrea", "Villanueva", "andrea.villanueva@example.com"],
      ["Brian", "Ocampo", "brian.ocampo@example.com"],
      ["Cheryl", "Reyes", "cheryl.reyes@example.com"],
      ["Daniel", "Santos", "daniel.santos@example.com"],
      ["Elena", "Cruz", "elena.cruz@example.com"],
      ["Francis", "Lim", "francis.lim@example.com"],
    ];
    for (const [first, last, email] of APPLICANTS) {
      const applicantId = await insert("applicants", {
        first_name: first,
        last_name: last,
        email,
        phone: `+63 9${between(10, 99)} ${between(100, 999)} ${between(1000, 9999)}`,
        location: "Cebu, Philippines",
        source: pick(["job_post", "referral", "linkedin", "careers_page"]),
        created_at: new Date(today.getTime() - 86400_000 * between(2, 35)).toISOString(),
      }, ["email"]);
      if (!applicantId) continue;

      const stage = STAGES[(first.length + last.length) % STAGES.length];
      const recruiter = pick(users?.users ?? []);
      const appId = await insert("job_applications", {
        applicant_id: applicantId,
        job_post_id: jobId,
        stage,
        assigned_recruiter_user_id: recruiter?.id,
        salary_expectation: between(18, 30) * 1000,
        availability_date: iso(new Date(today.getTime() + 86400_000 * between(7, 60))),
        notes: "Strong communication scores in the initial screen.",
        created_at: new Date(today.getTime() - 86400_000 * between(2, 30)).toISOString(),
      }, ["applicant_id", "job_post_id"]);

      // A stage history, so the applicant detail timeline is real.
      if (appId) {
        const upTo = STAGES.indexOf(stage);
        for (let s = 1; s <= upTo; s += 1) {
          await insert("application_stage_history", {
            job_application_id: appId,
            from_stage: s === 1 ? null : STAGES[s - 1],
            to_stage: STAGES[s],
            changed_by: recruiter?.id,
            notes: `Moved to ${STAGES[s].replace(/_/g, " ")}.`,
            created_at: new Date(today.getTime() - 86400_000 * (30 - s * 2)).toISOString(),
          }, ["job_application_id", "to_stage"]);
        }
      }
    }
  }
  console.log(`recruitment: ${JOBS.length} job posts, applicants across ${STAGES.length} stages`);
}

// ---------- billing ----------
if (want("billing")) {
  for (let i = 0; i < 6; i += 1) {
    const org = clientOrgs[i % Math.max(clientOrgs.length, 1)];
    if (!org) continue;
    const issue = new Date(today);
    issue.setMonth(issue.getMonth() - (5 - i));
    const periodStart = new Date(issue.getFullYear(), issue.getMonth(), 1);
    const periodEnd = new Date(issue.getFullYear(), issue.getMonth() + 1, 0);
    const due = new Date(issue.getTime() + 15 * 86400_000);
    const subtotal = between(180, 520) * 1000;
    const invoiceNumber = `INV-${issue.getFullYear()}${String(issue.getMonth() + 1).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`;
    const status = ["paid", "paid", "partially_paid", "sent", "overdue", "draft"][i];
    const invId = await insert("invoices", {
      client_organization_id: org.id,
      invoice_number: invoiceNumber,
      period_start: iso(periodStart),
      period_end: iso(periodEnd),
      issue_date: iso(issue),
      due_date: iso(due),
      subtotal,
      adjustments: i % 3 === 0 ? -between(1, 4) * 1000 : 0,
      total: subtotal + (i % 3 === 0 ? -between(1, 4) * 1000 : 0),
      currency: "PHP",
      status,
      created_at: issue.toISOString(),
    }, ["invoice_number"]);

    if (invId) {
      const LINES = [
        ["Seat fee — support agents", between(4, 12), 26000],
        ["Seat fee — QA analysts", between(1, 4), 30000],
        ["Overtime hours", between(10, 120), 185],
        ["Statutory contribution handling", 1, 9500],
      ];
      for (const [description, quantity, unit_rate] of LINES) {
        await insert("invoice_items", {
          invoice_id: invId,
          description,
          quantity,
          unit_rate,
          amount: quantity * unit_rate,
          created_at: issue.toISOString(),
        }, ["invoice_id", "description"]);
      }
      if (status === "paid" || status === "partially_paid") {
        await insert("invoice_payments", {
          invoice_id: invId,
          amount: status === "paid" ? subtotal : Math.round(subtotal / 2),
          method: pick(["bank_transfer", "check"]),
          reference: `PAY-${invoiceNumber}`,
          paid_at: new Date(issue.getTime() + 7 * 86400_000).toISOString(),
          created_at: new Date(issue.getTime() + 7 * 86400_000).toISOString(),
        }, ["invoice_id", "reference"]);
      }
    }
  }
  console.log("billing: 6 monthly invoices with line items and payments");
}

// ---------- documents ----------
if (want("documents")) {
  const DOCS = [
    ["Employee Handbook", "company_policy", "internal"],
    ["Data Processing Agreement", "contract", "client_visible"],
    ["Certificate of Employment — Reyes", "employee_record", "employee_visible"],
    ["Monthly Performance Report", "report", "client_visible"],
    ["Background Check Consent", "employee_record", "employee_visible"],
    ["Information Security Policy", "company_policy", "employee_visible"],
  ];
  for (let i = 0; i < DOCS.length; i += 1) {
    const [title, category, visibility] = DOCS[i];
    const emp = employees?.[i % Math.max(employees.length, 1)];
    await insert("documents", {
      organization_id: internalOrg?.id,
      employee_id: emp?.id ?? null,
      client_organization_id: visibility === "client_visible" ? clientOrgs[i % Math.max(clientOrgs.length, 1)]?.id ?? null : null,
      category,
      title,
      // Was `documents`, a bucket that does not exist in this project and that no
      // product code ever writes to. Every one of these rows therefore pointed at an
      // unresolvable path: the page rendered a populated documents list whose every
      // Download button failed with "Bucket not found", while this script cheerfully
      // reported the fixtures as seeded. `employee-documents` is a bucket that exists
      // and that the product itself uses; the accompanying bytes are written by
      // `scripts/audit/qa-seed-document-blobs.mjs`, which is the step that was missing.
      storage_bucket: "employee-documents",
      storage_path: `qa-fixtures/${slugify(title)}.pdf`,
      mime_type: "application/pdf",
      size_bytes: between(80_000, 900_000),
      visibility,
      uploaded_by: users?.users?.[0]?.id,
      created_at: new Date(today.getTime() - 86400_000 * between(10, 200)).toISOString(),
    }, ["title", "storage_path"]);
  }
  console.log(`documents: ${DOCS.length} documents across visibility levels`);
}

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

console.log();
console.log(`plan: ${plan.length} rows would be written`);
console.log(`already present (skipped): ${skipped}`);
if (APPLY) console.log(`inserted: ${inserted}`);
if (failures.length) {
  console.log(`\nFAILURES (${failures.length}):`);
  for (const f of failures.slice(0, 20)) console.log(`  ${f}`);
  process.exitCode = 1;
} else if (!APPLY) {
  console.log("\nDRY RUN — re-run with --apply to write. Nothing has been changed.");
} else {
  console.log("\nDone.");
}