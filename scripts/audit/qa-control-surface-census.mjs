// Census the interactive-control surface, then say how much of it the workflow
// suite actually asserts something about.
//
// WHY THIS EXISTS
// ---------------
// The feature checklist claims payroll, attendance and notifications work, and
// then has to hedge: "every daily-use FLOW works -- not literally every button on
// every screen." That hedge is uncomfortable because it is the one requirement
// that was softened instead of met, and a hedge that nobody measures is just a
// hope.
//
// So this measures it. It walks every route the role sweep already proved
// reachable, inventories every interactive control on it, and cross-references
// the result against `docs/evidence/workflow-assertion-index.json`. The output is
// a real number with a real denominator, plus the list of controls nothing
// asserts anything about -- which is the actionable half.
//
// WHY MATCHING IS APPROXIMATE, AND SAID SO
// ----------------------------------------
// An assertion is named in prose ("Approve finalizes the record") and a control
// is labelled in the UI ("Approve"). Matching them means string similarity, and
// string similarity produces false matches as readily as misses. Two deliberate
// choices keep it honest:
//
//   - Word-boundary matching only, and a minimum length. Without a word boundary
//     "Save" matches inside "Unsaved changes" and the coverage number inflates
//     for free. With a 4-character floor, one-letter and two-letter labels are
//     reported as unmatched rather than guessed at.
//   - The matched set is printed, not just counted. A coverage percentage nobody
//     can inspect is a number with no evidence behind it.
//
// A "covered" row means SOME assertion's name mentions that control. It does not
// mean the button was pressed in every state it can occupy. The script states
// that rather than letting the reader assume the stronger claim.
//
// USAGE
//   node scripts/audit/qa-control-surface-census.mjs
//   node scripts/audit/qa-control-surface-census.mjs --max-pages=8
//   node scripts/audit/qa-control-surface-census.mjs --verbose
//
// Exit 0 when the census completes, 2 when it cannot see the routes or the
// assertions it is supposed to compare. A census of nothing must not report a
// confident 0% -- that would be the same class of bug as the summary file that
// reported one exercise as the whole suite.

import { readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { chromium } from "@playwright/test";
import { fillHeld } from "./lib/browser-form.mjs";

const BASE = process.env.QA_BASE_URL ?? "http://localhost:3100";
const args = process.argv.slice(2);
const verbose = args.includes("--verbose");
const maxPagesArg = args.find((a) => a.startsWith("--max-pages="));
const MAX_PAGES_PER_ROLE = maxPagesArg ? Number(maxPagesArg.split("=")[1]) : 0; // 0 = no cap

function readEnv() {
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
  return env;
}

const ROLE_SWEEP = "docs/evidence/role-sweep.json";
const ASSERTION_INDEX = "docs/evidence/workflow-assertion-index.json";

for (const f of [ROLE_SWEEP, ASSERTION_INDEX]) {
  if (!existsSync(f)) {
    console.error(`ABORT: ${f} is missing.`);
    console.error(
      "  role-sweep.json      comes from: node scripts/audit/audit-role-sweep.mjs\n" +
        "  assertion-index.json comes from: node scripts/audit/qa-workflow-assertion-index.mjs",
    );
    process.exit(2);
  }
}

const sweep = JSON.parse(readFileSync(ROLE_SWEEP, "utf8"));
const index = JSON.parse(readFileSync(ASSERTION_INDEX, "utf8"));

// The page list this census measures is `role-sweep.json`'s, not this script's.
// If that file predates the build on disk, the pages walked belong to the
// PREVIOUS build, and every control, match and percentage below describes code
// that is no longer here.
//
// Not hypothetical: a census written at 06:45 UTC on 2026-10-15 read a
// role-sweep.json last written 2026-10-13 — the routes were two days stale. The
// header of this file calls the failure out by name ("running it first would
// silently measure the previous run's routes") and then relied on registry
// ordering alone to prevent it, which does nothing when the script is run
// directly, which is how every one of these audits is normally run.
//
// Same rule as `audit-server-fresh`, applied to an evidence input instead of a
// process: an artefact older than the build describes a build that is gone.
const BUILD_ID = ".next/BUILD_ID";
if (existsSync(BUILD_ID)) {
  const builtAt = statSync(BUILD_ID).mtimeMs;
  const sweepAt = statSync(ROLE_SWEEP).mtimeMs;
  if (sweepAt < builtAt) {
    console.error(
      `ABORT: ${ROLE_SWEEP} is older than the current build.\n\n` +
        `  role sweep  ${new Date(sweepAt).toISOString()}\n` +
        `  build       ${new Date(builtAt).toISOString()}\n\n` +
        "The pages this census would walk are the previous build's pages, so the\n" +
        "control counts and coverage percentage below would describe code that is\n" +
        "no longer on disk. Regenerate it first — it also confirms the server is\n" +
        "serving the current build:\n\n" +
        "  node scripts/audit/audit-role-sweep.mjs\n",
    );
    process.exit(2);
  }
}

const env = readEnv();
const PW = env.DEMO_PASSWORD;
if (!PW) {
  console.error("ABORT: DEMO_PASSWORD is not set in .env.local. Cannot sign in.");
  process.exit(2);
}

const norm = (s) =>
  String(s ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const wordSet = (s) => new Set(norm(s).split(/\s+/).filter(Boolean));

/**
 * Every assertion name, flattened, as one haystack of words to match against.
 *
 * ONLY the name, and only its first clause.
 *
 * This detail cost a whole false headline. Assertions are stored as
 * "name  — detail", and some exercises put a URL or a JSON blob in the detail.
 * Matching against the full string made `/app/dashboard` inside
 * "signed in as super admin — http://localhost:3100/app/dashboard" look like an
 * assertion about the Dashboard button, and made a record id look like an
 * assertion about a profile. The first run of this script therefore reported
 * "84.3% of named controls covered" when the underlying matches were mostly
 * incidental text.
 *
 * So the haystack is built from the name up to the first em dash, with URLs and
 * brace-delimited blobs removed. What survives is prose the author wrote about
 * the behaviour, which is the only text a label match can honestly rest on.
 */
function assertionHaystack(raw) {
  let s = String(raw ?? "").split("—")[0]; // keep the name, drop the detail
  s = s.replace(/https?:\/\/\S+/g, " "); // URLs contribute route names, not behaviour
  s = s.replace(/[{}[\]]/g, " "); // JSON/array delimiters
  return s;
}

const ASSERTIONS = [];
for (const e of index.exercises ?? []) {
  for (const b of e.behaviours ?? []) {
    const h = assertionHaystack(b);
    if (norm(h)) ASSERTIONS.push({ name: h, exercise: e.id, full: b });
  }
}

// The second vacuous-check guard.
//
// `workflow-assertion-index.json` used to ship counts but not the behaviour names
// unless it was generated with --verbose, so this haystack came out EMPTY. Every
// control then failed to match, and the script printed a confident, entirely
// fictional "named-control coverage: 0%" with a full 117-item "actionable list"
// attached. A cross-reference against no data is not a finding.
//
// Matching nothing is the expected result when there is nothing to match
// against, so the absence is checked rather than the coverage.
if (!ASSERTIONS.length) {
  console.error(
    `ABORT: ${ASSERTION_INDEX} contains no assertion names to match controls against.\n` +
      "       Regenerate it with: node scripts/audit/qa-workflow-assertion-index.mjs\n" +
      "       Reporting coverage against an empty list would be a fictional 0%.",
  );
  process.exit(2);
}

/**
 * Does any assertion name mention this control's label?
 *
 * Word-boundary, minimum 4 characters, either direction. Deliberately
 * conservative: a missed match is visible in the unmatched list and cheap to
 * investigate, whereas an inflated match is invisible and makes the headline
 * number wrong.
 */
function coveredBy(label) {
  const lw = wordSet(label);
  if (lw.size === 0) return null;
  const significant = [...lw].filter((w) => w.length >= 4);
  if (!significant.length) return null; // e.g. a control labelled only "OK" / "..."
  for (const a of ASSERTIONS) {
    const aw = wordSet(a.name);
    for (const w of significant) {
      if (aw.has(w)) return a;
    }
  }
  return null;
}

const INTERACTIVE = [
  "button",
  "a[href]",
  "input:not([type=hidden]):not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[role=button]",
  "[role=link]",
  "[role=tab]",
  "[role=menuitem]",
  "[role=switch]",
  "[role=checkbox]",
  "[role=combobox]",
  "[role=option]",
].join(",");

/**
 * Read the visible interactive controls off the live page.
 *
 * Runs in the page so the cost is one round trip rather than one per control.
 * Only elements that are actually laid out are counted: an off-screen or
 * `display:none` control is not part of the surface a user can press.
 */
function collectControls(selectors) {
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none") return false;
    return true;
  };
  const labelTextFor = (el) => {
    // The label's OWN text, with the control it labels removed.
    //
    // Reading `label.textContent` directly is wrong whenever the label WRAPS
    // its control, because the control's own text lives inside the label: a
    // <select> contributes every one of its <option> texts. The first version
    // of this fix produced names like
    //   "StatusAll statusespendingmanager approvedhr approved..."
    // which is not a name, it is the control's data spliced onto its label.
    // The accessible name is the label's text with the labelled control's
    // subtree taken out.
    const textOf = (label) => {
      if (!label) return null;
      const clone = label.cloneNode(true);
      for (const inner of clone.querySelectorAll("select, input, textarea, button")) {
        inner.remove();
      }
      const t = (clone.textContent || "").replace(/\s+/g, " ").trim();
      return t || null;
    };

    // The three standard accessible-name sources for a form control, in the
    // order the accessibility APIs resolve them. `nameOf` used to skip all of
    // them, which is why a <select> labelled "Pay frequency" was recorded
    // under its SELECTED VALUE (`semi_monthly`, `25000`, `won`, `lost`).
    // Two things then went wrong at once: the control was renamed, so
    // `matchAssertion` compared a data value against assertion names and could
    // never match -- inflating the "no matching assertion" gap; and the real
    // gap, a control with no label at all, was hidden behind a plausible-looking
    // name. The extractor was manufacturing the answer it then complained about.
    const by = el.getAttribute("aria-labelledby");
    if (by) {
      const t = by
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent || "")
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (t) return t;
    }
    if (el.id) {
      const t = textOf(document.querySelector(`label[for="${CSS.escape(el.id)}"]`));
      if (t) return t;
    }
    return textOf(el.closest("label"));
  };

  const nameOf = (el) => {
    // An <img alt> DOES contribute to its ancestor link's accessible name, but it
    // contributes nothing to `textContent` -- so a logo link came back unnamed and
    // was reported as "an icon-only control with no accessible name at all". That
    // was a defect in this extractor, not in the product: the sidebar's brand
    // link wraps <Image alt="BEEPA"> and is perfectly named. Read the alt.
    const imgAlt = el.querySelector("img[alt]")?.getAttribute("alt")?.trim() || null;
    const isField = el.tagName === "INPUT" || el.tagName === "SELECT" || el.tagName === "TEXTAREA";

    const cand = [
      el.getAttribute("aria-label"),
      isField ? labelTextFor(el) : null,
      el.getAttribute("title"),
      isField ? el.getAttribute("placeholder") || el.getAttribute("name") : null,
      imgAlt,
      el.textContent,
      el.getAttribute("data-testid"),
    ];
    for (const c of cand) {
      const t = (c ?? "").replace(/\s+/g, " ").trim();
      if (t) return t.length > 120 ? `${t.slice(0, 117)}...` : t;
    }
    // Deliberately NO `el.value` fallback. A form value is data the user chose;
    // it is never an accessible name. Falling back to it means a control with no
    // label is reported as named, so the one finding this census exists to make
    // -- "this control has no accessible name" -- can never be made. A control
    // that reaches the end of the chain genuinely has no name, and the
    // icon-only count below is where that belongs.
    return null;
  };
  const kindOf = (el) => {
    const r = el.getAttribute("role");
    if (el.tagName === "A" || r === "link") return "link";
    if (["INPUT", "SELECT", "TEXTAREA"].includes(el.tagName) || r === "checkbox" || r === "combobox") return "field";
    return "button";
  };

  const out = [];
  for (const el of document.querySelectorAll(selectors)) {
    if (!visible(el)) continue;
    if (el.disabled) continue;
    // Icon-only controls are real but unnamed; they are counted separately so
    // they cannot quietly dilute or inflate the named-control ratio.
    const name = nameOf(el);
    out.push({
      name,
      kind: kindOf(el),
      href: el.tagName === "A" ? el.getAttribute("href") : null,
      inNav: Boolean(el.closest("nav, [data-slot=sidebar], aside")),
    });
  }
  return out;
}

/**
 * Navigations that needed a second attempt because the first hit a cold route.
 *
 * COLD START IS A REAL FAILURE MODE HERE, measured 2026-10-18: on a freshly
 * started `next start`, 24 of 444 pages timed out at the 30s navigation
 * timeout. Every one of them was in `owner` -- the FIRST role walked -- which
 * reached 35 of its ~58 pages while carrying the most controls in the system.
 * Route chunks load lazily, so a route's first hit is the slow one and the
 * second is fast.
 *
 * The consequence is the reason this exists: that run's coverage percentage was
 * computed over a partial denominator. A number measured over a walk that did
 * not complete must not be quoted, and the cheapest way to stop producing one
 * is to let the cold hit be retried.
 *
 * This is NOT tolerance for a broken page. A genuinely broken page fails twice,
 * and the second failure is recorded exactly as the first would have been. What
 * it removes is the cold first hit, and `coldRetries` is printed with the
 * results so a reader can see how often it was needed instead of inferring it.
 */
let coldRetries = 0;

async function gotoWarm(page, url, timeout = 30000) {
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout });
  } catch {
    await page.waitForTimeout(1500);
    coldRetries++;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout });
  }
}

async function signIn(page, email) {
  await gotoWarm(page, `${BASE}/login`);
  await fillHeld(page, page.locator('input[type=email]'), email);
  await fillHeld(page, page.locator('input[type=password]'), PW);
  await page.click('button[type=submit]');
  await page.waitForLoadState("domcontentloaded");

  // Wait for the CONDITION, not a duration.
  //
  // The first version of this file returned straight after the click and carried
  // on. That looks harmless and is not: the sign-in is a live Supabase round
  // trip, so every subsequent `goto` fired while still unauthenticated and was
  // bounced to /login. The run then inventoried the SIGN-IN page thirteen times
  // -- once per role -- and reported "0 distinct controls matched, 0% coverage"
  // with zero pages failed, because every navigation had technically succeeded.
  // `audit-role-sweep.mjs` documents the same trap at length: 36 pages of
  // coverage once vanished and the summary still read "0 errors".
  try {
    await page.waitForFunction(() => !window.location.pathname.includes("/login"), null, { timeout: 20000 });
    return { ok: true };
  } catch {
    return { ok: false, reason: `still on ${new URL(page.url()).pathname} after 20s` };
  }
}

/**
 * The path the browser ACTUALLY ended on.
 *
 * Recorded because the requested path is a claim and `page.url()` is a fact.
 * Without this the evidence file said "/app/dashboard" for rows that were really
 * the login page, which is how a broken census produced a clean-looking report.
 */
function landedPath(page) {
  try {
    return new URL(page.url()).pathname;
  } catch {
    return "(unparseable url)";
  }
}

/** Did we get thrown back to sign-in? That is a failed walk, not a page. */
const bouncedToLogin = (p) => p === "/login" || p.startsWith("/login");

const roleNames = Object.keys(sweep.roles ?? {});
if (!roleNames.length) {
  console.error("ABORT: role-sweep.json lists no roles.");
  process.exit(2);
}

const perRole = [];
const seen = new Map(); // key -> census row
let pagesVisited = 0;
let pagesFailed = 0;
let browser = null;

try {
  for (const role of roleNames) {
    const info = sweep.roles[role];
    const okPages = (info.pages ?? []).filter((p) => p.status === "ok");
    const pages = MAX_PAGES_PER_ROLE ? okPages.slice(0, MAX_PAGES_PER_ROLE) : okPages;
    const roleRow = { role, pagesVisited: 0, pagesFailed: 0, signOuts: 0, signInFailures: 0, controls: 0 };
    if (!pages.length) {
      perRole.push(roleRow);
      continue;
    }

    // A fresh browser PROCESS per role, not one for the whole walk.
    //
    // Measured 2026-10-18: on identical code with a freshly started server, this
    // same audit produced 24 failed pages, then 0, then 1. The retry added for
    // cold routes never fired (coldStartRetries: 0), so cold start was ruled out
    // and what was left is the thing every run here has in common -- one
    // long-lived process carrying the entire measurement.
    //
    // Recreating the CONTEXT per role was already here, but the browser process
    // outlived all thirteen. Its queues, its accumulated memory and its cache
    // grow across 444 page loads, and every later role inherits that. Relaunching
    // costs about a second per role against a twenty-minute walk, and it makes
    // each role depend only on its own pages.
    //
    // Note what this does NOT claim: it is the change that makes each role's
    // measurement independent, so a walk can be compared to another. It is not
    // proof that process lifetime was the whole cause -- `pagesFailed` and
    // `coldStartRetries` are both reported so that claim can be checked or
    // refuted on the next run rather than taken on trust.
    await browser?.close().catch(() => {});
    browser = await chromium.launch();
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    let signedIn = false;

    for (const p of pages) {
      try {
        if (!signedIn) {
          const r = await signIn(page, info.email);
          if (!r.ok) {
            roleRow.signInFailures++;
            throw new Error(`sign-in failed: ${r.reason}`);
          }
          signedIn = true;
        }
        await gotoWarm(page, `${BASE}${p.path}`);
        await page.waitForTimeout(700); // let client components mount

        const actual = landedPath(page);
        if (bouncedToLogin(actual)) {
          // The session died or never took. Count it, say it, and re-auth.
          pagesFailed++;
          roleRow.pagesFailed++;
          roleRow.signOuts++;
          if (pagesFailed <= 8) console.log(`  !! ${role} ${p.path}: bounced to ${actual} (not signed in)`);
          signedIn = false;
          continue;
        }

        const controls = await page.evaluate(collectControls, INTERACTIVE);
        pagesVisited++;
        roleRow.pagesVisited++;
        roleRow.controls += controls.length;

        for (const c of controls) {
          const key = `${c.kind}|${norm(c.name ?? "")}|${c.inNav ? "nav" : "page"}`;
          if (seen.has(key)) {
            seen.get(key).seenOn.push(actual);
            continue;
          }
          const hit = c.name ? coveredBy(c.name) : null;
          seen.set(key, {
            kind: c.kind,
            name: c.name,
            inNavigation: c.inNav,
            requestedRoute: p.path,
            exampleRoute: actual,
            seenOn: [actual],
            assertedBy: hit ? { exercise: hit.exercise, assertion: hit.name } : null,
            counted: Boolean(c.name),
          });
        }
      } catch (e) {
        pagesFailed++;
        roleRow.pagesFailed++;
        // A failed page is reported, never silently skipped.
        if (pagesFailed <= 8) console.log(`  !! ${role} ${p.path}: ${String(e.message).split("\n")[0]}`);
        signedIn = false; // session may be gone; re-auth on the next page
      }
    }

    await ctx.close();
    perRole.push(roleRow);
    console.log(`  ${role.padEnd(16)} ${roleRow.pagesVisited} pages, ${roleRow.controls} controls`);
  }
} finally {
  await browser?.close().catch(() => {});
}

const controls = [...seen.values()];
const named = controls.filter((c) => c.counted);
const covered = named.filter((c) => c.assertedBy);
const uncovered = named.filter((c) => !c.assertedBy);
const unnamed = controls.filter((c) => !c.counted);
const navOnly = named.filter((c) => c.inNavigation);

/**
 * Navigation is not the button surface.
 *
 * "Every button works" means the controls a user presses to DO something --
 * submit, approve, clock in, filter, upload. The sidebar's links are chrome:
 * they navigate, and they are already covered by a different, stronger gate
 * (`qa-exercise-internal-links.mjs` asserts every link resolves).
 *
 * Averaging the two together is what produced the flattering 84.3%: 41 of the
 * matches were nav links whose label happened to appear in some assertion's
 * prose. The primary number here is therefore ACTION controls only, with the
 * navigation figure reported beside it and not added into it.
 */
const isAction = (c) => !c.inNavigation && c.kind !== "link";
const actionControls = named.filter(isAction);
const actionCovered = actionControls.filter((c) => c.assertedBy);
const actionUncovered = actionControls.filter((c) => !c.assertedBy);
const navCovered = navOnly.filter((c) => c.assertedBy);
const actionCoverage = actionControls.length
  ? Number(((actionCovered.length / actionControls.length) * 100).toFixed(1))
  : null;
const navCoverage = navOnly.length
  ? Number(((navCovered.length / navOnly.length) * 100).toFixed(1))
  : null;

/**
 * VACUOUS-CHECK GUARD.
 *
 * The first run of this file reported "0% named-control coverage, 0 pages
 * failed" while having inventoried nothing but the sign-in page thirteen times.
 * A coverage number with no denominator behind it is worse than no number: it
 * reads as a finding about the product when it is a finding about this script.
 *
 * So the run refuses to report coverage unless it demonstrably walked the
 * application. Two independent conditions, because either alone can be fooled:
 *
 *   1. real pages were visited, and
 *   2. the majority of inventoried controls came from routes that are NOT
 *      /login -- i.e. we were somewhere, signed in, doing the job.
 *
 * A failure here exits 2 and says what to fix, instead of printing 0%.
 */
const loginRouteControls = controls.filter((c) => bouncedToLogin(c.exampleRoute)).length;
const realRouteControls = controls.length - loginRouteControls;
const walkedSomething = pagesVisited > 0 && realRouteControls > controls.length / 2;

if (!walkedSomething) {
  console.error(
    `\nABORT: this run never walked the application, so its coverage number would be meaningless.\n` +
      `  pages visited: ${pagesVisited}, pages failed: ${pagesFailed}\n` +
      `  controls seen on /login: ${loginRouteControls}, seen elsewhere: ${realRouteControls}\n` +
      `  sign-in failures: ${perRole.reduce((n, r) => n + r.signInFailures, 0)}\n` +
      "  Most likely: DEMO_PASSWORD is wrong, the app is not running on " + BASE + ",\n" +
      "  or the sign-in wait is still not long enough for the Supabase round trip.",
  );
  process.exit(2);
}

const out = {
  base: BASE,
  when: new Date().toISOString(),
  // The inputs' own ages, so a reader can tell a fresh rollup from one built on
  // yesterday's routes without having to go and stat the files.
  sources: {
    roles: ROLE_SWEEP,
    assertions: ASSERTION_INDEX,
    rolesWhen: existsSync(ROLE_SWEEP) ? statSync(ROLE_SWEEP).mtime.toISOString() : null,
    assertionsWhen: existsSync(ASSERTION_INDEX) ? statSync(ASSERTION_INDEX).mtime.toISOString() : null,
  },
  rolesWalked: roleNames.length,
  pagesVisited,
  pagesFailed,
  // Printed and stored, never silently absorbed: a run that needed many of these
  // is measuring a cold process, and a reader comparing two runs needs to know
  // that the walks were not equivalent.
  coldStartRetries: coldRetries,
  maxPagesPerRole: MAX_PAGES_PER_ROLE || null,
  distinctControls: controls.length,
  namedControls: named.length,

  // PRIMARY metric. Action controls only -- the things a user presses.
  actionControls: actionControls.length,
  actionControlsWithMatchingAssertion: actionCovered.length,
  actionControlsUnmatched: actionUncovered.length,
  actionControlLabelOverlap: actionCoverage,

  // Reported separately and deliberately NOT added into the primary figure.
  navigationControls: navOnly.length,
  navigationControlsWithMatchingAssertion: navCovered.length,
  navigationLabelOverlap: navCoverage,

  // Everything, kept only so the two above can be reconciled.
  namedControlsWithMatchingAssertion: covered.length,
  unnamedControls: unnamed.length,

  caveat:
    "A 'matched' control means some assertion's NAME mentions its label as a word. It does NOT mean the control was pressed, nor pressed in every state. This metric is wrong in BOTH directions, so it is a proxy and not a measurement. It OVER-reports: a label appearing in an assertion name does not prove the control was pressed. It UNDER-reports, which is the direction that hides real gaps -- on the current build it flagged three buttons, and only one was real. 'Save' on /app/payroll/settings and 'Continue' on /app/payroll/periods are both pressed and both work (the assertions are named for the outcome, 'salary change persisted' and 'a new payroll period was created', not for the control). The third, 'Reject' on /app/cash-advances, was a genuine hole: the reject leg of a money workflow had zero executions while an assertion listed 'rejected' as an acceptable end state. Treat an unmatched control as a QUESTION, never as a finding.",
  perRole,
  controls: controls.sort((a, b) => String(a.name).localeCompare(String(b.name))),
  unmatchedActionControls: actionUncovered.map((c) => ({ name: c.name, kind: c.kind, exampleRoute: c.exampleRoute })),
};

writeFileSync("docs/evidence/control-surface-census.json", JSON.stringify(out, null, 2) + "\n");

console.log(
  `\n${roleNames.length} roles, ${pagesVisited} pages visited` +
    (pagesFailed ? `, ${pagesFailed} failed` : "") +
    `\n${out.distinctControls} distinct controls across every route walked` +
    `\n\n  ACTION controls (buttons + fields, excluding nav chrome):` +
    `\n    ${actionControls.length} found, ${actionCovered.length} with a matching assertion name` +
    `\n    actionControlLabelOverlap = ${actionCoverage}%   <-- the number to quote` +
    `\n\n  NAVIGATION links (covered instead by qa-exercise-internal-links.mjs):` +
    `\n    ${navOnly.length} found, ${navCovered.length} with a matching assertion name (${navCoverage}%)` +
    `\n\n${unnamed.length} control(s) with no accessible name at all.` +
    `\n${pagesFailed} page(s) failed.` +
    (coldRetries ? `\n${coldRetries} navigation(s) needed a cold-start retry (first hit of a lazily loaded route).` : ""),
);

console.log(`\nACTION CONTROLS WITH NO MATCHING ASSERTION (${actionUncovered.length}) -- the real gap:`);
for (const c of actionUncovered.slice(0, verbose ? 999 : 30)) {
  console.log(`  "${c.name}" [${c.kind}] e.g. ${c.exampleRoute}`);
}
if (!verbose && actionUncovered.length > 30) console.log(`  ... and ${actionUncovered.length - 30} more`);

console.log(`\nNAV LINKS WITH NO MATCHING ASSERTION (${navOnly.length - navCovered.length}):`);
for (const c of navOnly.filter((c) => !c.assertedBy).slice(0, verbose ? 999 : 15)) {
  console.log(`  "${c.name}" e.g. ${c.exampleRoute}`);
}
if (!verbose && navOnly.length - navCovered.length > 15) {
  console.log(`  ... and ${navOnly.length - navCovered.length - 15} more`);
}

if (unnamed.length) {
  console.log(`\nUNNAMED CONTROLS (${unnamed.length}) -- no accessible name from any source:`);
  for (const c of unnamed) console.log(`  [${c.kind}] e.g. ${c.exampleRoute}`);
}

console.log("\nwrote docs/evidence/control-surface-census.json");