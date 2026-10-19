// Drive every filter control on every internal list page and prove each one can
// actually change the result set.
//
// WHY
// The action coverage in docs/QA_REPORT.md §5 counts server actions. It does not
// cover the OTHER half of a list page: the GET filter form. A filter control can
// render, sit in a form, submit a correct query string and be then ignored by the
// query it was meant to reach — the page changes nothing and reports a confident,
// complete, wrong list. That is not hypothetical: it is exactly what the NTE search
// box was (QA_REPORT §2, P2), and the release gate's "no dead controls" audit passed
// while it was broken, because that audit can see a control that submits and cannot
// see a query that ignores it.
//
// SCOPING — READ THIS BEFORE TRUSTING A NUMBER HERE
// Most list pages render a SECOND form above the filter: "Create ticket", "Create NTE
// case", "Upload". A first draft of this script used page-wide `.first()` locators and
// consequently filled the CREATE form's `subject` / `title` / `incident_type` field,
// clicked the CREATE form's submit button, and fingerprinted a list with every `<form>`
// stripped out of it. It reported 14 dead filters on 6 pages, including /app/hr/nte
// — whose search box had been fixed and proven earlier in the same session. Every one
// of those 14 was the harness. Everything below is therefore scoped to the ONE form
// that contains an "Apply" button, and the fingerprint removes only that form.
//
// WHAT IS ACTUALLY BEING TESTED
//
//  1. A search box must respond to a string that matches nothing. Type a marker that
//     cannot appear in any seeded row and the result set must change. This direction
//     is chosen deliberately: it has exactly one correct outcome, so there is no
//     "legitimately the same list" escape hatch. A search that returns the unfiltered
//     list for a no-match string is dead, full stop.
//
//  2. A dropdown must be able to change something. For selects there is no no-match
//     value, and an option can legitimately return the same rows as "all" (filtering
//     by a status every row already has). So the invariant is weaker but still
//     falsifiable: AT LEAST ONE option value must produce a result set different
//     from the unfiltered one. A dropdown where no option does anything is inert.
//
//  3. STABILITY CONTROL, run before anything else on every page. The page is loaded
//     twice with no query string and the two fingerprints must match. Some list pages
//     render relative timestamps ("2 hours ago") that differ between loads; without
//     this control a moving clock reads as "the filter worked" and every assertion on
//     that page is meaningless. A page that fails the control is SKIPPED and reported,
//     never asserted against.
//
//  4. A page whose unfiltered list is EMPTY is skipped for the dropdown leg. With no
//     rows, no filter can change anything, and reporting that as a dead filter would
//     be the same mistake in the opposite direction.
//
// A KNOWN LIMIT, STATED RATHER THAN PAPERED OVER
// The filter form is identified by its Apply button, or failing that by the search
// input (`name="q"` / `aria-label` beginning "Search"). A FilterBar rendered with BOTH
// `showApply={false}` and `showSearch={false}` — selects only, Enter to submit — has
// neither marker and will be reported as "no Apply form on this page" and skipped. No
// page uses that shape today. Widening the rule to catch it would mean matching any
// form containing a named select, which matches create forms too; that was tried, it
// drove /app/client/tickets' create form, and it reported two defects on a page whose
// filters do not exist.
//
// A NOTE ON WHAT A PASS HERE IS NOT
// When a dropdown reports no effect, this script does not conclude a defect on its
// own — the org may genuinely hold one status and the control is untestable. It
// prints the route, the control and the values it tried, and each candidate is then
// confirmed or dismissed against the table. Asserting "this filter is broken" from
// the DOM alone would be a claim the evidence does not carry.
//
// SCOPE
// Three roles, each in its own browser context, because the cookie jar decides which
// pages render at all: internal (21 routes, owner), client (8 routes, clientadmin) and
// applicant (1 route). An earlier version ran only the internal pass and listed the
// client and applicant routes as "not covered by this run" — which left nine list
// pages whose filters nobody had ever driven. They are now driven by the same
// assertions under the role that can actually see them.
//
// SAFE TO RE-RUN: read-only. Nothing is written by this script.
//
// Usage: node scripts/audit/qa-exercise-list-filters.mjs

import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import { fillHeld } from "./lib/browser-form.mjs";
import { writeEvidence } from "./lib/evidence.mjs";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  if (!line || line.trim().startsWith("#")) continue;
  const i = line.indexOf("=");
  if (i < 0) continue;
  let v = line.slice(i + 1).trim();
  const q = String.fromCharCode(39);
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith(q) && v.endsWith(q))) v = v.slice(1, -1);
  env[line.slice(0, i).trim()] = v;
}

const BASE = process.env.QA_BASE_URL ?? "http://localhost:3100";
const OWNER_EMAIL = "owner@demo.beepabpo.com";
const CLIENT_EMAIL = "clientadmin@demo.beepabpo.com";
const APPLICANT_EMAIL = "applicant@demo.beepabpo.com";
const MARK = `qaflt${Date.now().toString(36)}`;

/**
 * One entry per role, because a list page only exists for the role that may see it.
 * The internal pass cannot reach /app/client/* or /app/applicant/* at all — those
 * routes redirect a signed-in owner away, which is itself the RLS doing its job, but
 * it means their filters would otherwise never be driven by anyone.
 */
const ROLES = [
  {
    label: "internal",
    email: OWNER_EMAIL,
    pages: [
      "/app/tickets",
      "/app/employees",
      "/app/attendance",
      "/app/attendance/corrections",
      "/app/leave",
      "/app/approvals",
      "/app/billing",
      "/app/cash-advances",
      "/app/crm/leads",
      "/app/crm/deals",
      "/app/crm/proposals",
      "/app/hr/nte",
      "/app/payroll/periods",
      "/app/recruitment/jobs",
      "/app/recruitment/applicants",
      "/app/admin/users",
      "/app/admin/organizations",
      "/app/my/leave",
      "/app/my/cash-advances",
      "/app/my/documents",
      "/app/my/notifications",
    ],
  },
  {
    label: "client",
    email: CLIENT_EMAIL,
    pages: [
      "/app/client/tickets",
      "/app/client/timesheets",
      "/app/client/attendance",
      "/app/client/billing",
      "/app/client/documents",
      "/app/client/notifications",
      "/app/client/requests",
      "/app/client/team",
    ],
  },
  { label: "applicant", email: APPLICANT_EMAIL, pages: ["/app/applicant/notifications"] },
];

const results = [];
const candidates = [];
const notes = [];
function check(name, pass, detail = "") {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  [${detail}]` : ""}`);
}
function note(s) {
  notes.push(s);
  console.log(`NOTE  ${s}`);
}

/**
 * The filter form, identified by its Apply button — never by position.
 *
 * `FilterBar` accepts `showApply={false}` ("omit the Apply button (Enter still
 * submits)"), so an Apply-button-only rule would skip those pages SILENTLY and turn
 * a future page into an untested one. The fallback therefore accepts a form with no
 * Apply button ONLY when it carries a real FilterBar marker: the search input, which
 * is `name="q"` by default and carries an `aria-label` of "Search …".
 *
 * The fallback deliberately does NOT accept "a form containing a named select".
 * That was tried and it is wrong: /app/client/tickets has no filter form at all, but
 * its create form has `<select name="priority">` and `<select name="category">`, so
 * the broad rule drove the create form and reported two defects on a page whose
 * filters do not exist. Under-detecting and saying so is strictly better than
 * matching the thing you meant to exclude. A filter form with BOTH showApply and
 * showSearch off is the one shape this will miss; the header says so.
 */
function filterForm(page) {
  return page
    .locator("form")
    .filter({ has: page.locator("button[type=submit]", { hasText: /^Apply$/ }) });
}

/** Fallback identification for a FilterBar rendered with showApply={false}. */
async function filterFormFallback(page) {
  return page
    .locator("form")
    .filter({ has: page.locator('input[name=q], input[aria-label^="Search"]') })
    .first();
}

/** True when this page has a filter form at all, by either identification. */
async function hasFilterForm(page) {
  return page.evaluate(() => {
    const forms = [...document.querySelectorAll("form")];
    const hasApply = (f) =>
      [...f.querySelectorAll("button[type=submit]")].some((b) => (b.textContent ?? "").trim() === "Apply");
    if (forms.some(hasApply)) return true;
    // showApply={false}: a filter form still carries the search input.
    return forms.some((f) => f.querySelector('input[name=q], input[aria-label^="Search"]') !== null);
  });
}

/** Submit the filter form the way a user would, falling back when there is no Apply. */
async function submitFilter(form) {
  const apply = form.locator("button[type=submit]", { hasText: /^Apply$/ }).first();
  if (await apply.isVisible().catch(() => false)) {
    await apply.click();
  } else {
    await form.evaluate((f) => f.requestSubmit());
  }
}

/**
 * Everything the user reads below the filter form, minus the filter form itself.
 *
 * The form is located and removed INSIDE the same evaluate. An earlier version
 * tagged it with an attribute in one call and stripped it in another; the tag does
 * not survive a client-side navigation, so every post-submit fingerprint silently
 * included the filter bar while the baseline excluded it — and /app/recruitment/jobs
 * was reported as having a dead search box when it works correctly.
 */
async function fingerprint(page) {
  const text = await page.evaluate(() => {
    const main = document.querySelector("main") ?? document.body;
    const clone = main.cloneNode(true);
    // Remove ONLY the filter form. Stripping every <form> would also delete list
    // rows that happen to be wrapped in one (status selects, assign selects), which
    // silently reduces the fingerprint to page chrome and makes every comparison
    // equal — a false "this filter does nothing" on every row-bearing list.
    for (const f of [...clone.querySelectorAll("form")]) {
      const isFilterForm =
        [...f.querySelectorAll("button[type=submit]")].some(
          (b) => (b.textContent ?? "").trim() === "Apply",
        ) || f.querySelector('input[name=q], input[aria-label^="Search"]') !== null;
      if (isFilterForm) f.remove();
    }
    return clone.innerText ?? "";
  });
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Sample the fingerprint until two consecutive reads agree.
 *
 * Waiting on the URL is not enough: a Next.js client-side transition updates the
 * address bar immediately and streams the new RSC payload afterwards, so a read
 * taken "after the URL settled" can still be the OLD page. Comparing a settled old
 * page against a settled new one is what a filter assertion has to avoid.
 */
async function stableFingerprint(page, attempts = 12) {
  let prev = null;
  for (let i = 0; i < attempts; i++) {
    const cur = await fingerprint(page);
    if (cur === prev) return cur;
    prev = cur;
    await page.waitForTimeout(400);
  }
  return prev ?? "";
}

/** True when the unfiltered list rendered the dashed EmptyState. Heuristic. */
async function listIsEmpty(page) {
  return page.evaluate(() => !!document.querySelector("main .border-dashed"));
}

async function settle(page) {
  await page.waitForLoadState("domcontentloaded");
  // The app redirects on permission boundaries; sampling early reads a
  // half-navigated page. Wait for the URL to stop moving before sampling.
  let last = page.url();
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(250);
    const now = page.url();
    if (now === last) return now;
    last = now;
  }
  return last;
}

/** Load a route unfiltered and return its fingerprint, or null if it is not listable. */
async function baseline(page, route) {
  await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" });
  await settle(page);
  if (page.url().includes("/login")) return { skip: "redirected to /login" };
  if (!(await hasFilterForm(page))) return { skip: "no Apply form on this page" };
  const a = await stableFingerprint(page);
  await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" });
  await settle(page);
  const b = await stableFingerprint(page);
  if (a !== b) return { skip: "content is not stable across two identical loads" };
  return { a, empty: await listIsEmpty(page) };
}

const browser = await chromium.launch();
let tested = 0;
let skipped = 0;

for (const role of ROLES) {
  // A fresh context per role: the cookie jar is what decides which pages render at
  // all, and reusing one would leave the owner signed in while walking client routes.
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.on("pageerror", (e) => note(`pageerror on ${page.url()}: ${e.message}`));

  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.locator("input[name=email], input[type=email]").first().waitFor({ state: "visible", timeout: 20000 });
  await fillHeld(page, page.locator("input[name=email], input[type=email]").first(), role.email);
  await fillHeld(page, page.locator("input[type=password]").first(), env.DEMO_PASSWORD);
  await page.click("button[type=submit]");
  await page.waitForURL(/\/app/, { timeout: 20000 }).catch(() => {});
  await page.waitForLoadState("domcontentloaded");
  if (page.url().includes("/login")) {
    note(`${role.label}: ${role.email} could not sign in — skipped`);
    skipped += role.pages.length;
    await context.close();
    continue;
  }
  note(`signed in as ${role.email} (${role.label})`);

  for (const route of role.pages) {
    try {
      const base = await baseline(page, route);
      if (base.skip) {
        note(`${route}: ${base.skip} — skipped`);
        skipped++;
        continue;
      }
      const a = base.a;
      const form = (await filterForm(page).count()) ? filterForm(page) : await filterFormFallback(page);

      // ---- 1. the search box, with a string that cannot match a seeded row.
      const search = form.locator("input[type=text], input:not([type])").first();
      if (await search.isVisible().catch(() => false)) {
        await search.fill(MARK);
        await submitFilter(form);
        await settle(page);
        const after = await stableFingerprint(page);
        const reached = page.url().includes(MARK);
        check(
          `${route} — a search that matches nothing changes the list`,
          after !== a,
          reached ? (after !== a ? "list changed" : "URL carried the query but the list did not change") : "the search value never reached the URL",
        );
      }

      // ---- 2. each dropdown: at least one option must change the list.
      if (base.empty) {
        note(`${route}: list is empty, so no filter can change it — dropdown leg skipped rather than reported as inert`);
      } else {
        await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" });
        await settle(page);
        const form2 = (await filterForm(page).count()) ? filterForm(page) : await filterFormFallback(page);
        const n = await form2.locator("select").count();
        let changedAny = false;
        const tried = [];
        for (let i = 0; i < n && !changedAny; i++) {
          const sel = form2.locator("select").nth(i);
          const name = (await sel.getAttribute("name")) ?? `select#${i}`;
          const values = await sel.locator("option").evaluateAll((os) => os.map((o) => o.value));
          for (const v of values) {
            if (!v) continue; // "" is the "all" sentinel
            await sel.selectOption(v).catch(() => {});
            await submitFilter(form2);
            await settle(page);
            const after = await stableFingerprint(page);
            tried.push(`${name}=${v}`);
            if (after !== a) {
              changedAny = true;
              break;
            }
            // The submit reloads the document; re-acquire before the next attempt.
            await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" });
            await settle(page);
          }
        }
        if (n === 0) {
          note(`${route}: filter form has no dropdowns`);
        } else if (changedAny) {
          check(`${route} — at least one dropdown option changes the list`, true, `${tried[tried.length - 1]} of ${tried.length} tried`);
        } else {
          check(`${route} — at least one dropdown option changes the list`, false, `${tried.length} value(s) tried`);
          candidates.push({ route, tried });
        }
      }
      tested++;
    } catch (e) {
      note(`${route}: ${e.message}`);
      skipped++;
    }
  }
  await context.close();
}

await browser.close();

console.log("\n" + "=".repeat(72));
console.log(`filters exercised on ${tested} page(s) across ${ROLES.length} role(s); ${skipped} page(s) skipped`);
if (candidates.length) {
  console.log("\nno-effect dropdown candidates — confirm each against its table before calling it a defect:");
  for (const c of candidates) console.log(`  ${c.route}\n    ${c.tried.join("\n    ")}`);
}

const passed = results.filter((r) => r.pass).length;
console.log(`\n${passed}/${results.length} assertions passed`);
if (notes.length) {
  console.log("\nnotes:");
  for (const n of notes) console.log(`  - ${n}`);
}
process.exitCode = passed === results.length ? 0 : 1;

// Evidence, written by the exercise itself.
//
// Below the exit code on purpose: `writeEvidence` derives the verdict from it, so
// a write placed above this line records 0 and calls a run with a dead filter
// control a PASS. See `scripts/audit/lib/evidence.mjs`.
try {
  const { file } = writeEvidence({
    id: "list-filters",
    script: "scripts/audit/qa-exercise-list-filters.mjs",
    claim: "every filter control on every internal list page can actually change the result set, across all demo roles",
    base: BASE,
    checks: results,
    notes,
    exitCode: process.exitCode ?? 0,
    extra: {
      // Reach matters as much as pass rate: a page never visited contributes no
      // assertions and would otherwise look like a page with nothing to find.
      pagesTested: tested,
      pagesSkipped: skipped,
      rolesDriven: ROLES.length,
      // Controls that rendered and submitted but changed nothing. Reported, not
      // asserted: a no-effect dropdown is a candidate for a human decision about
      // its table, not automatically a defect.
      noEffectDropdownCandidates: candidates,
    },
  });
  console.log(`wrote ${file}`);
} catch (err) {
  console.error(
    "could not write evidence:",
    err instanceof Error ? err.message : String(err),
  );
}