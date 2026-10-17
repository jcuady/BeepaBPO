// Functional coverage for the three demo roles no workflow exercise touched.
//
// WHY THESE THREE
// ---------------
// Thirteen demo roles exist. Ten are driven through a real workflow by the other
// exercises in this directory -- payroll runs as owner, leave as employee/hr/
// teamlead, tickets as owner/operations, hire as hr/recruiter. Three were not:
// **sales**, **finance** and **client_viewer**.
//
// `audit-role-sweep.mjs` does visit all three, but it is read-only by design: it
// navigates and reports console errors, HTTP status and empty states. It never
// presses a button. For these three roles the project could show a green sweep
// over pages that are individually broken.
//
// WHAT THE FIRST VERSION OF THIS FILE GOT WRONG, AND WHY IT MATTERS
// -----------------------------------------------------------------
// It asserted "no control whose label starts with approve/create/delete". That
// produced six failures, and every one was a false positive:
//
//   - "Payroll", "Payroll settings"  -- navigation links, not actions
//   - "Submit a Ticket"              -- self-service every employee should have
//   - "New agent onboarding…"        -- notification titles, not buttons
//   - "Create ticket" for a viewer   -- `tickets.self` is granted on purpose
//
// It also asserted "this URL must not be reachable", which confuses *reaching*
// a route with *seeing* the data behind it. Measured, none of the three roles
// sees money it should not: sales sees $0 on /app/payroll and its own pipeline
// total in the CRM, client_viewer is refused on /app/payroll and /app/reports,
// and /app/client/billing renders with zero amounts. RLS is working; the shell
// loading is not a leak.
//
// So this version asserts the two properties that are actually true and
// actually matter:
//
//   1. NO EXPOSURE  -- a role renders no money on a surface it has no
//      permission to read. This is the security claim.
//   2. NO CAPABILITY IT DID NOT HAVE -- measured DIFFERENTIALLY, by comparing
//      client_viewer against client_admin on the same pages. Asking "is there
//      an Approve button?" with a regex cannot work; asking "does the viewer
//      have controls the admin has?" is the real invariant and self-adjusts.
//
//
// AND WHY THE `signs in` CHECKS WERE ALSO WRONG
// ----------------------------------------------
// They read `page.url()` 2500ms after the submit and asserted the result
// contained `/app` or `/app/client`. Four runs failed on four DIFFERENT
// accounts -- finance on `/employee/login`, client_admin on `/app`,
// client_viewer on `/login`, then all four at once -- and each passed on
// re-run.
//
// The duration was the whole defect. It was long enough on a fast machine and
// short enough on a slow one, so what it measured was the machine's mood. Both
// explanations that looked available were measured and disproved first:
// `scripts/audit/test-auth-direct.mjs` was written to answer them, and it
// returned HTTP 200 for all six demo accounts (so not a provider throttle)
// while the server sat at 142 MB working set with `audit-server-fresh`
// reporting `fresh` (so not the degraded one described in 2.12). Neither face
// of "the suite is under load" was active. The instrument was the defect.
//
// So a sign-in now WAITS for an outcome -- a session, or a `role="alert"`
// saying why not -- and asserts what signing in actually means rather than
// which route won the race. `lib/auth/actions.ts:92` sends every role to
// `/app`; `landingPathFor` (`lib/auth/landing.ts:29`) then sends a client to
// `/app/client`. The old check sampled the journey between those two hops and
// called the sample a result. The second hop is no longer assumed either: it
// is tested, against the rule in `landing.ts`.
//
// READ-ONLY. It signs in, navigates, reads the DOM, writes nothing.
//
// Usage:
//   node --env-file=.env.local scripts/audit/qa-exercise-uncovered-roles.mjs

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  if (!line || line.trim().startsWith("#")) continue;
  const i = line.indexOf("=");
  if (i < 0) continue;
  let v = line.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  env[line.slice(0, i).trim()] = v;
}
const BASE = process.env.QA_BASE_URL ?? "http://localhost:3100";

const results = [];
const notes = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  [${detail}]` : ""}`);
};
const note = (m) => { notes.push(m); console.log(`NOTE  ${m}`); };

/**
 * Wait for the URL to stop moving.
 *
 * TWO CONSECUTIVE UNCHANGED READS, not one. A single unchanged read breaks
 * out immediately when the navigation has not started yet -- which is exactly
 * the state a page is in for the moment after a submit is clicked. That made
 * this a race, and a race cannot be the basis of a FAIL.
 *
 * The app redirects on permission boundaries, and that redirect can land
 * *after* the URL has stopped moving -- the client-side navigation destroys
 * the execution context between `goto` and `evaluate`, which surfaces as
 * "Execution context was destroyed" and took out the whole run. `sampleAt`
 * retries its evaluate against a page settled this way.
 */
async function settleUrl(page, rounds = 10, pause = 350) {
  let last = page.url();
  let stable = 0;
  for (let i = 0; i < rounds; i++) {
    await page.waitForTimeout(pause);
    const now = page.url();
    stable = now === last ? stable + 1 : 0;
    last = now;
    if (stable >= 2) break;
  }
  return last;
}

/** The app redirects on permission boundaries; wait for the URL to settle. */
async function visit(page, path) {
  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
  return settleUrl(page, 8);
}

/** The form's own failure copy, read rather than guessed at. */
const readAuthAlert = async (page) => {
  try {
    const text = await page.evaluate(() => {
      const el = document.querySelector('[role="alert"]');
      return el ? (el.textContent || "").replace(/\s+/g, " ").trim() : null;
    });
    return { text, read: true };
  } catch (e) {
    // NOT the same as "no alert". Returning null for both made a thrown
    // evaluate -- this page's own history of "Execution context was
    // destroyed" -- indistinguishable from a clean sign-in.
    return { text: null, read: false, why: String(e).slice(0, 80) };
  }
};

/**
 * Sign in and wait for the OUTCOME, not for a duration.
 *
 * WHY A PREDICATE AND NOT A SLEEP
 * -------------------------------
 * This function used to sleep 2500ms and then let the caller read the URL.
 * That measured the machine's mood: long enough on a fast run, short enough on
 * a slow one. Across four runs of this exercise it produced four different
 * "broken" accounts, and a server sitting at 142 MB with a direct
 * password-grant probe answering 200 for all six demo accounts proved both
 * the provider and the app were healthy while the browser run still failed.
 *
 * A sleep cannot express "the sign-in finished". This waits for one of two
 * FACTS -- the session exists, or the app published why not -- and gives up at
 * 20s, which is recorded rather than swallowed.
 */
async function signInAs(context, email, portal) {
  const loginPath = portal === "client" ? "/login" : "/employee/login";
  const page = await context.newPage();
  await page.goto(`${BASE}${loginPath}`, { waitUntil: "domcontentloaded" });
  await page.locator("#email").waitFor({ state: "visible", timeout: 20000 });

  // Fill, then confirm the form still HOLDS the values before submitting.
  //
  // React hydrates after the server-rendered HTML is already interactive, and
  // hydration RESETS the inputs `fill` just wrote to. A click landing in that
  // window submits an empty form: `loginSchema` rejects it before
  // `signInWithPassword` is ever called, the user is told "Please check the
  // form and try again", and every probe taken outside the browser stays green
  // while the browser refuses. Measured on 2026-10-17 -- finance failed this
  // way with correct credentials, which is what made the direct password-grant
  // probe exonerate the provider and send the investigation the wrong way.
  //
  // A value that survives a 250ms settle proves hydration has finished, since
  // hydration is the only thing that clears it, so this cannot race.
  let fills = 0;
  let held = false;
  for (let attempt = 1; attempt <= 4; attempt++) {
    await page.fill("#email", email);
    await page.fill("#password", env.DEMO_PASSWORD);
    await page.waitForTimeout(250);
    fills = attempt;
    held =
      (await page.inputValue("#email")) === email &&
      (await page.inputValue("#password")) === env.DEMO_PASSWORD;
    if (held) break;
  }
  await page.click('button[type=submit]');

  let outcome = "landed or was rejected";
  await page
    .waitForFunction(
      (path) => !location.pathname.startsWith(path) || !!document.querySelector('[role="alert"]'),
      loginPath,
      { timeout: 20000 },
    )
    .catch(() => {
      outcome = "no outcome within 20s (submit still pending, or the action never returned)";
    });

  const url = await settleUrl(page, 20);
  const alert = await readAuthAlert(page);
  return { page, url, loginPath, outcome, alert, fills, held };
}

/**
 * "Signed in" means a session exists -- not that a particular route won the
 * race to be read.
 *
 * Both failure modes are separated deliberately, because they are not the same
 * bug: still sitting on the form means the credentials were refused, and a
 * visible `role="alert"` means the app said why. The product's own copy is
 * carried into the detail so a failure names its cause instead of naming a URL
 * and leaving the reader to guess.
 */
/**
 * Where each account actually ended up.
 *
 * Recorded because "the failing account changes every run" was the only honest
 * description of this exercise for a day, and a reader of the evidence file
 * needs to be able to check that claim against the destinations rather than
 * take it on trust. `landingPathFor` decides these: internal CRM-first roles go
 * to /app/crm, other internals to /app/my, clients to /app/client.
 */
const signIns = [];

const checkSignIn = (label, s) => {
  const stillOnForm = s.url.includes(s.loginPath);
  const ok = !stillOnForm && !s.alert.text;
  const cause = !s.held
    ? `the form would not hold its values (${s.fills} fill attempt(s)); the submit sent something other than the credentials`
    : stillOnForm
      ? "still on the login form"
      : s.alert.text
        ? "left the form but showed an error"
        : s.outcome;
  signIns.push({ label, ok, url: s.url, cause: ok ? null : cause, alert: s.alert.text, fills: s.fills });
  return check(
    `${label} signs in`,
    ok,
    ok
      ? s.url
      : `${s.url} :: ${cause}` +
          `${s.alert.text ? ` :: "${s.alert.text}"` : ""}` +
          `${s.alert.read ? "" : ` :: alert unreadable (${s.alert.why})`}`,
  );
};

/**
 * What is actually ON this page, as opposed to reachable.
 *
 * Money is the discriminator: `₱`/`$` followed by digits is the one thing that
 * must never appear on a surface a role cannot read. Nav labels are ignored
 * because a link is not data.
 */
const SAMPLE = () => {
  const text = (document.body.innerText || "").replace(/\s+/g, " ");
  const money = text.match(/(?:₱|\$)\s?[\d,]+(?:\.\d{2})?/g) ?? [];
  return {
    moneyCount: money.length,
    moneySample: money.slice(0, 3),
    denied: /access denied|no access|not permitted|do not have permission/i.test(text),
  };
};

/**
 * Visit a route, wait for it to settle, and sample what rendered.
 *
 * The app redirects on permission boundaries, and that redirect can land
 * *after* the URL has stopped moving -- the client-side navigation destroys the
 * execution context between `goto` and `evaluate`, which surfaces as
 * "Execution context was destroyed" and took out the whole run.
 *
 * So the evaluate is retried once against the settled page rather than being
 * trusted to land on the first try.
 */
async function sampleAt(page, path) {
  await visit(page, path);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(900);
      // Read the URL HERE, next to the DOM, and settle it first -- not when
      // `visit()` returned. `/app` is a pure redirect, so the URL captured at
      // the end of `visit` was the one BEFORE the redirect landed, and the
      // check reported `/app` for a client genuinely sitting on `/app/client`.
      // A URL and the DOM it describes have to be read at the same moment or
      // neither can be trusted.
      const url = await settleUrl(page, 6);
      const s = await page.evaluate(SAMPLE);
      return { url, ...s };
    } catch (e) {
      if (attempt === 2) throw e;
      await page.waitForTimeout(1200);
    }
  }
}

/**
 * Button labels only -- links are navigation, and navigation is not a capability.
 *
 * Labels are NORMALISED before comparison. The first version compared them
 * verbatim and reported four identical failures, all of them the notification
 * bell reading "Notifications (1 unread)" for one account and
 * "Notifications" for the other. An unread count is chrome, not a capability --
 * the two roles have the same button, it merely says a different number.
 *
 * So counters, counts and unread suffixes are stripped, and comparison happens
 * on the normalised text. What survives is genuinely "this role has a control
 * the other does not".
 */
const NORMALISE = (s) =>
  s
    .replace(/\(\s*\d+\s+unread\s*\)/gi, "")
    .replace(/\(\s*\d+\s*\)/g, "")
    .replace(/\b\d+\s+unread\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const buttonLabels = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      })
      .map((el) => (el.getAttribute("aria-label") || el.textContent || "").replace(/\s+/g, " ").trim())
      .filter(Boolean),
  );

const browser = await chromium.launch();

try {
  // ---------------------------------------------------------------- finance
  {
    const ctx = await browser.newContext();
    const s = await signInAs(ctx, "finance@demo.beepabpo.com", "employee");
    const page = s.page;
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e).slice(0, 100)));
    checkSignIn("finance", s);

    // Finance is an internal role. It must not reach the client tenant's money.
    const billing = await sampleAt(page, "/app/client/billing");
    check(
      "finance is kept out of the client billing surface",
      !billing.url.includes("/client/billing") || billing.moneyCount === 0,
      `${billing.url} money=${billing.moneyCount}`,
    );
    check("no uncaught page errors as finance", errors.length === 0, errors.join(" | "));
    await ctx.close();
  }

  // ------------------------------------------------------------------ sales
  {
    const ctx = await browser.newContext();
    const s = await signInAs(ctx, "sales@demo.beepabpo.com", "employee");
    const page = s.page;
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e).slice(0, 100)));
    checkSignIn("sales", s);
    check("sales lands on the CRM pipeline", page.url().includes("/app/crm"), page.url());

    // The whole question for sales: can a pipeline role read payroll figures?
    const payroll = await sampleAt(page, "/app/payroll");
    check(
      "sales sees no payroll amounts on /app/payroll",
      payroll.moneyCount === 0,
      `money=${payroll.moneyCount} ${JSON.stringify(payroll.moneySample)} url=${payroll.url}`,
    );

    // And the page it does own should not be empty, or the role cannot work.
    //
    // The URL is asserted FIRST. This check used to pass VACUOUSLY: an
    // unauthenticated visit to /app/crm/leads lands on the public marketing
    // page, and that page contains none of the negative phrases below, so
    // "not empty" was satisfied by a page with nothing to do with leads. It
    // reported PASS in the same run where every sign-in had failed.
    const leads = await visit(page, "/app/crm/leads");
    const crmText = await page.evaluate(() => (document.body.innerText || "").replace(/\s+/g, " "));
    check(
      "sales sees a populated lead list",
      leads.includes("/app/crm/leads") && !/(no leads|no records|nothing here)/i.test(crmText),
      `url=${leads} ${crmText.slice(0, 60)}`,
    );
    check("no uncaught page errors as sales", errors.length === 0, errors.join(" | "));
    await ctx.close();
  }

  // ---------------------------------------------------------- client viewer
  // Differential: the viewer's buttons are compared against the admin's on the
  // same pages. A label regex cannot express "can do what admin can do".
  const PAGES = ["/app/client/attendance", "/app/client/timesheets", "/app/client/tickets", "/app/client/requests"];
  const byRole = {};
  for (const role of [
    { label: "client_admin", email: "clientadmin@demo.beepabpo.com" },
    { label: "client_viewer", email: "clientviewer@demo.beepabpo.com" },
  ]) {
    const ctx = await browser.newContext();
    const s = await signInAs(ctx, role.email, "client");
    const page = s.page;
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e).slice(0, 100)));
    checkSignIn(role.label, s);
    // The SECOND hop, asserted against the product's actual rule rather than a
    // guessed one. `landingPathFor` (`lib/auth/landing.ts:29`) sends a client to
    // `/app/client`; login's first hop is `/app` for every role
    // (`lib/auth/actions.ts:92`). The old check sampled between those two hops.
    const landing = await sampleAt(page, "/app");
    check(
      `${role.label} on /app is routed to the client area, not refused`,
      !landing.denied && landing.url.includes("/app/client"),
      `url=${landing.url} denied=${landing.denied}`,
    );
    byRole[role.label] = { buttons: {}, errors };
    for (const p of PAGES) {
      await visit(page, p);
      byRole[role.label].buttons[p] = await buttonLabels(page);
    }
    await ctx.close();
  }

  for (const p of PAGES) {
    const admin = new Set(byRole.client_admin.buttons[p].map(NORMALISE));
    const viewer = byRole.client_viewer.buttons[p].map(NORMALISE);
    // A viewer must not have anything the admin's page does not -- anything at
    // all. If the admin has nothing, there is nothing to over-grant.
    const extra = viewer.filter((b) => !admin.has(b));
    check(
      `client viewer has no control client admin lacks on ${p}`,
      extra.length === 0,
      extra.join(" | ") || `admin sees ${admin.size}, viewer sees ${new Set(viewer).size}`,
    );
  }

  {
    const ctx = await browser.newContext();
    const s = await signInAs(ctx, "clientviewer@demo.beepabpo.com", "client");
    const page = s.page;

    const payroll = await sampleAt(page, "/app/payroll");
    check(
      "client viewer is refused the internal payroll app",
      payroll.denied || payroll.moneyCount === 0,
      `denied=${payroll.denied} money=${payroll.moneyCount} url=${payroll.url}`,
    );

    const reports = await sampleAt(page, "/app/reports");
    check(
      "client viewer is refused internal reports",
      reports.denied || reports.moneyCount === 0,
      `denied=${reports.denied} money=${reports.moneyCount} url=${reports.url}`,
    );

    const billing = await sampleAt(page, "/app/client/billing");
    check(
      "client viewer renders no amounts on client billing",
      billing.moneyCount === 0,
      `money=${billing.moneyCount} ${JSON.stringify(billing.moneySample)} url=${billing.url}`,
    );

    if (!billing.denied) {
      note(
        "client billing renders its shell for client_viewer with zero amounts rather than a " +
          "denial page. Nothing is exposed -- `billing.read` is not granted to the role -- but " +
          "an empty surface a user cannot fill is worth a considered decision rather than a default.",
      );
    }
    await ctx.close();
  }
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (notes.length) {
  console.log("\nNOTES:");
  for (const n of notes) console.log(`  - ${n}`);
}
if (failed.length) {
  console.log("\nFAILURES:");
  for (const f of failed) console.log(`  - ${f.name}${f.detail ? `  [${f.detail}]` : ""}`);
}
process.exitCode = failed.length ? 1 : 0;

// Evidence, written by the exercise itself rather than only by the
// orchestrator. Same reason `qa-exercise-admin-workflow.mjs` and
// `qa-exercise-attendance-workflow.mjs` were given it: the orchestrator reaches
// ~20 exercises and the server degrades under that much browser load, so a run
// that dies part-way leaves it unable to refresh anything. That is not
// hypothetical here -- this file sat at `verdict: FAIL`, 16/17, recording a
// defect in the instrument rather than the product, while the exercise it
// describes was passing 19/19 twice in a row. A stale red record for something
// already fixed is precisely what the evidence rule exists to prevent.
try {
  mkdirSync("docs/evidence", { recursive: true });
  writeFileSync(
    "docs/evidence/workflow-uncovered-roles.json",
    JSON.stringify(
      {
        id: "uncovered-roles",
        script: "scripts/audit/qa-exercise-uncovered-roles.mjs",
        claim: "sales, finance, client_viewer: the three roles no other exercise drives",
        base: BASE,
        when: new Date().toISOString(),
        exitCode: process.exitCode,
        verdict: failed.length ? "fail" : "pass",
        assertions: results.length,
        failedAssertions: failed,
        // Per-account destinations, so "the failing account changed every run"
        // can be checked here instead of taken on trust. `landingPathFor`
        // decides them: CRM-first internals to /app/crm, other internals to
        // /app/my, clients to /app/client.
        signIns,
        notes,
        results,
      },
      null,
      2,
    ) + "\n",
  );
  console.log("wrote docs/evidence/workflow-uncovered-roles.json");
} catch (err) {
  console.error(
    "could not write evidence:",
    err instanceof Error ? err.message : String(err),
  );
}
process.exit(process.exitCode);