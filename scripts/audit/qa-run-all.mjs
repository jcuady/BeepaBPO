// Run every QA probe in this directory and write one aggregate verdict.
//
// WHY: this pass added six probes, each with its own command, its own evidence
// file and its own idea of what a failure looks like. That is correct locally and
// useless globally — "is the system ready" came to mean "can you remember seven
// commands and their arguments". The brief for this project asks for documentation
// good enough that you would know whether every page, user and workflow is
// functional. That requires one answer, not seven.
//
// Three things this runner is careful about, each learned from a bug in this
// directory rather than from theory:
//
//   - It distinguishes BLOCKED from FAIL. `qa-probe-signup-workflow.mjs` exits 2
//     for "the environment's email budget stopped me", which is not the same
//     outcome as a broken assertion, and flattening the two would make the
//     suite permanently red for a reason no code change can fix.
//   - It does not run the memory-hungry sweeps by default. `audit-app-responsive`
//     in one process reaches 2.4 GB and takes the app server down with it; the
//     role sweep takes ~20 minutes. Both belong in a "slow" tier, run
//     deliberately, never silently alongside everything else.
//   - Every entry must declare its own evidence file, so a green summary always
//     has a file behind it. A check result printed to a terminal is a claim.
//
// Usage:
//   node scripts/audit/qa-run-all.mjs              # fast tier (default)
//   node scripts/audit/qa-run-all.mjs --all        # + slow tier
//   node scripts/audit/qa-run-all.mjs --list       # print the registry and exit
//
// Requires the app running (QA_BASE_URL, default http://localhost:3100).

import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";

const BASE = process.env.QA_BASE_URL ?? "http://localhost:3100";
const args = process.argv.slice(2);
const listOnly = args.includes("--list");
const wantAll = args.includes("--all");

/**
 * tier:    "fast"  — seconds, safe to run any time the server is up
 *          "gate"  — the release gate itself (unit tests + typecheck)
 *          "slow"  — minutes and/or memory-hungry; only with --all
 * evidence: file this check is expected to have written. A green check with no
 *           evidence file is a finding, not a pass.
 * skipIfMissing: the file this check needs to exist before it can run at all
 */
const CHECKS = [
  { id: "not-found",        tier: "fast",  cmd: ["scripts/audit/qa-probe-not-found.mjs"],        evidence: "docs/evidence/not-found-check.json",      what: "every 404 has a working way out" },
  { id: "dialog-keyboard",  tier: "fast",  cmd: ["scripts/audit/qa-probe-dialog-keyboard.mjs"],  evidence: "docs/evidence/dialog-keyboard-check.json", what: "confirm dialogs: focus in, focus back, Escape and Cancel" },
  { id: "command-palette",  tier: "fast",  cmd: ["scripts/audit/qa-probe-command-palette.mjs"],  evidence: "docs/evidence/command-palette-check.json", what: "cmd-K opens, filters, navigates, returns focus" },
  { id: "notification-bell",tier: "fast",  cmd: ["scripts/audit/qa-probe-notification-bell.mjs"],evidence: "docs/evidence/notification-bell-check.json",what: "bell accessible name, AA contrast, keyboard exit" },
  { id: "internal-links",   tier: "fast",  cmd: ["scripts/audit/qa-exercise-internal-links.mjs"],evidence: "docs/evidence/workflow-internal-links.json", what: "no internal link lands on an error page" },

  // `/careers` grew a search box, three filter selects, filter chips and two
  // distinct empty states, and NOTHING asserted any of it. `internal-links` walks
  // the routes; it never types in a box. So the page could have had a filter that
  // matched nothing, a chip that cleared the wrong param, or an empty state that
  // said "no jobs" while five were open — every other check green, because every
  // other check looks at the page, not at what it does when you touch it.
  //
  // Fast tier on purpose: it is 16 assertions over ~10 unauthenticated GETs of
  // server-rendered HTML, so it needs only a running server. It is NOT in the
  // workflow tier because it creates no fixtures — those exercises share one
  // Supabase database, and this one can run beside anything.
  //
  // HTTP, not a browser. The claim under test is "the server emitted these rows
  // for these params", and a browser sits between the reader and that question.
  // It asserts over the corpus size before trusting any negative, so an empty
  // result cannot be reported as a working filter.
  { id: "public-careers",   tier: "fast",  cmd: ["scripts/audit/qa-exercise-public-careers.mjs"],evidence: "docs/evidence/workflow-public-careers.json", what: "careers search, three filters, chips, both empty states, and the account CTA return path" },

  // Static, no browser. Added because a form's Reset button existed in five
  // components and silently did nothing on most of its fields -- nothing caught
  // it because nothing asked what Reset *does*.
  { id: "form-reset-defaults", tier: "fast", cmd: ["scripts/audit/audit-form-reset-defaults.mjs"], evidence: "docs/evidence/form-reset-defaults.json", what: "every form that calls reset() defaults every field it registers" },

  // Static, no browser. Two scripts defaulted to port 3000 while 44 used 3100, so
  // `pnpm audit:role-pages` reported "0/13 nav-reachable role pages clean" and
  // "13 page(s) a role can SEE but cannot USE" -- thirteen connection errors
  // reported as thirteen broken roles.
  { id: "suite-base-url", tier: "fast", cmd: ["scripts/audit/audit-suite-base-url.mjs"], evidence: "docs/evidence/suite-base-url.json", what: "every audit script agrees on QA_BASE_URL and port 3100" },

  // May exit 2. The environment's outbound email budget allows roughly ONE
  // invite per window, and `qa-probe-invite-domains.mjs` spends an invite to
  // find out whether the window is open — so probing and then exercising burns
  // two. Run this DIRECTLY after a wait rather than probing first.
  { id: "client-invite",    tier: "fast",  cmd: ["scripts/audit/qa-exercise-client-invite.mjs"], evidence: "docs/evidence/client-invite-check.json", what: "the last uncovered action, driven through its real form (BLOCKED when mail is rate limited)" },

  // `/auth/callback` had no exercise at all, and it is where every failed signup
  // and reset link goes. Its failure branch redirects to `/login?error=auth_callback`,
  // and that parameter appeared exactly once in the codebase -- on the line that
  // produced it. So a dead link dropped the user on a plain login form that said
  // nothing at all, which reads as "nothing happened" and sends them back to
  // request the same email in a loop.
  { id: "auth-callback",    tier: "fast",  cmd: ["scripts/audit/qa-exercise-auth-callback.mjs"], evidence: "docs/evidence/auth-callback-check.json", what: "a dead link explains itself instead of failing silently" },

  // The square brand was previously only ever checked by *reading class
  // strings*. That proves no `rounded-[16px]` survives in the source, and stops
  // there: it cannot see a radius that arrives through a variable, a cascade or
  // the browser. Meanwhile `/signup` shipped a visibly broken sentence with
  // every source-level gate green. This measures computed `border-*-radius` on
  // painted elements in a real browser, which is the only check so far that
  // looks at what was actually rendered.
  //
  // Scope, stated plainly: PUBLIC routes only. The auth-gated app UI is not
  // covered here — `Card`, for instance, renders nowhere on these 12 pages, so
  // a mutation there is invisible to this check. That was demonstrated, not
  // assumed: mutating `Card` left this gate green. The product surface is
  // covered by `responsive-app` and `role-sweep`, neither of which measures
  // radius. Treat app-side corners as covered by review, not by this gate.
  //
  // `rounded-full` is excluded deliberately: avatars, the lime bullet dots, the
  // switch, the progress bar and the status chips are circular because the
  // shape carries meaning, not because they predate the redesign.
  { id: "runtime-radius",  tier: "fast",  cmd: ["scripts/audit/audit-runtime-radius.mjs"],  evidence: "docs/evidence/runtime-radius-check.json",  what: "computed corner radius on 12 public routes (rounded-full excluded)" },

  // Contrast is measured, not asserted. Every ratio the project carried was a
  // number typed by hand into a document, including a set that was wrong by a
  // factor of two because the luminance function it used never linearised sRGB,
  // and a set that reported the reference palette as unusable when it is
  // comfortably AA. Nothing caught either.
  //
  // This walks 14 routes, resolves each element's effective background by
  // compositing up the ancestor chain, and for text over photography it hides
  // the glyphs and samples the real pixels underneath. It is also the gate that
  // found the invisible headings: `app/globals.css` puts a `color` declaration
  // on every h1-h4, which overrode the landing page's inherit-from-container
  // model and painted navy text on a navy band.
  { id: "contrast", tier: "fast", cmd: ["scripts/audit/audit-contrast.mjs"], evidence: "docs/evidence/contrast-check.json",  what: "WCAG 2.2 AA text contrast on 13 public routes plus the signed-in product app, DOM-composited plus real-pixel sampling over photos" },

  // The site ran two body faces with nothing asserting which face a surface uses:
  // `/` was DM Sans (from the supplied reference) and every other route was
  // Inter (from the brandbook), so navigating between them changed the typeface
  // while every gate here stayed green. The contract is now split by surface —
  // DM Sans on marketing and auth, Inter in the app — and this is what holds it.
  // Proven by mutation: reverting the marketing layout to `font-sans` produces
  // exactly 123 strays and exit 1. Both surfaces are now measured — marketing
  // and auth anonymously, the product app over an `owner` session — because
  // measuring only the public half left the densest surface in the product
  // unguarded by a gate at all.
  { id: "typography", tier: "fast", cmd: ["scripts/audit/audit-typography.mjs"], evidence: "docs/evidence/typography-check.json",  what: "body face per surface: DM Sans on marketing/auth, Inter across the signed-in product app" },

  // The app layout sweep MUST be chunked: one process over all 28 routes
  // reaches 2.4 GB and takes the app server with it. That constraint used to
  // leak out of the runner as well — only chunk 1 was registered, so `--all`
  // verified 7 of 28 routes and never ran the public surface at all, while the
  // report described this file as "one command to answer is the system ready".
  // All four chunks plus /app/cms and the public surface are registered now.
  // Each is a separate process, so memory is released between them.
  { id: "responsive-app-1", tier: "slow", env: { QA_CHUNK_LABEL: "chunk1" }, cmd: ["scripts/audit-app-responsive.mjs", "owner@demo.beepabpo.com", "/app/dashboard", "/app/my", "/app/my/attendance", "/app/my/leave", "/app/my/payroll", "/app/my/requests", "/app/my/documents"], evidence: "docs/evidence/responsive-app-chunk1.json", what: "app layout, 8 viewports (routes 1-7 of 28)" },
  { id: "responsive-app-2", tier: "slow", env: { QA_CHUNK_LABEL: "chunk2" }, cmd: ["scripts/audit-app-responsive.mjs", "owner@demo.beepabpo.com", "/app/my/schedule", "/app/crm", "/app/crm/leads", "/app/crm/deals", "/app/crm/proposals", "/app/attendance", "/app/leave"], evidence: "docs/evidence/responsive-app-chunk2.json", what: "app layout, 8 viewports (routes 8-14 of 28)" },
  { id: "responsive-app-3", tier: "slow", env: { QA_CHUNK_LABEL: "chunk3" }, cmd: ["scripts/audit-app-responsive.mjs", "owner@demo.beepabpo.com", "/app/employees", "/app/payroll", "/app/payroll/periods", "/app/billing", "/app/recruitment", "/app/recruitment/jobs", "/app/recruitment/applicants"], evidence: "docs/evidence/responsive-app-chunk3.json", what: "app layout, 8 viewports (routes 15-21 of 28)" },
  { id: "responsive-app-4", tier: "slow", env: { QA_CHUNK_LABEL: "chunk4" }, cmd: ["scripts/audit-app-responsive.mjs", "owner@demo.beepabpo.com", "/app/tickets", "/app/approvals", "/app/reports", "/app/hr", "/app/admin", "/app/admin/users", "/app/clients"], evidence: "docs/evidence/responsive-app-chunk4.json", what: "app layout, 8 viewports (routes 22-28 of 28)" },
  // `/app/cms` needs the marketing account: `cms.manage` is held only by
  // marketing, so asking owner asks a question with a guaranteed "denied"
  // answer and buries real layout findings under a permanent red.
  { id: "responsive-app-cms", tier: "slow", env: { QA_CHUNK_LABEL: "cms" }, cmd: ["scripts/audit-app-responsive.mjs", "marketing@demo.beepabpo.com", "/app/cms"], evidence: "docs/evidence/responsive-app-cms.json", what: "CMS layout under the account that can actually reach it" },
  { id: "responsive-public", tier: "slow", cmd: ["scripts/audit-responsive.mjs", "/", "/about", "/services", "/why-beepa", "/contact", "/privacy", "/terms", "/case-studies", "/careers", "/resources", "/security", "/pricing", "/login", "/signup", "/employee/login"], evidence: "docs/evidence/responsive-public.json", what: "public + auth surface, 15 routes x 8 viewports" },

  // Does the product WORK, as opposed to looking right and building. This
  // registry above is presentation and release gates; it answers nothing about
  // whether payroll reaches finalized or an employee is actually notified. The
  // twenty workflow exercises that answer that were present in the directory
  // and registered nowhere, so they ran when someone remembered a filename.
  //
  // It proved the point the day it was added: the signup exercise fills the
  // signup form by field id, and when the form became role-aware it began
  // failing on an `#company` that no longer rendered by default. That is
  // coverage rotting silently, reported as a failure with no explanation.
  //
  // Serial by necessity — these create and delete fixtures in one shared
  // database, and running two at once corrupts each other's cleanup into what
  // looks like a product bug.
  { id: "workflows",        tier: "slow",  cmd: ["scripts/audit/qa-run-workflows.mjs"],        evidence: "docs/evidence/workflow-summary.json",          what: "21 workflow exercises: payroll, attendance, leave, notifications, tickets, documents, NTE, money, recruitment, CRM, CMS, hire, admin, profile, filters" },

  // The workflows tier reports how many exercises passed. This reports how many
  // *distinct things the product did*, deduplicated across those exercises --
  // which is the only way to answer "every button works" with something other
  // than a pass count. Reads the evidence the tier above just wrote.
  { id: "assertion-index", tier: "slow",  cmd: ["scripts/audit/qa-workflow-assertion-index.mjs"], evidence: "docs/evidence/workflow-assertion-index.json", what: "distinct named behaviours asserted across the workflow evidence" },

  // Builds a state no demo account can be in, then renders it.
  //
  // Four `/app/my` pages branch on `employee ? <form> : <p>`, and every demo
  // account that reaches them HAS an employee record — so the audit measured the
  // form branch on every run and reported those pages clean, for the one user the
  // message is written for. The fix was previously declined because seeding a 14th
  // demo account would add a button to the public login page (`lib/demo/users.ts`
  // feeds `DemoLoginPicker`). This builds the account per run instead, via the
  // admin API, so nothing visible is added and the deletion is asserted.
  //
  // Slow tier: it needs the server, and it creates and deletes an auth user, so it
  // runs with the workflow exercises that share the database — never in parallel.
  { id: "unlinked-employee", tier: "slow", cmd: ["scripts/audit/qa-probe-unlinked-employee.mjs"], evidence: "docs/evidence/unlinked-employee-check.json", what: "renders the empty states no demo account can reach: a member with no employees row, across five pages and two viewports" },

  { id: "role-sweep",       tier: "slow",  cmd: ["scripts/audit/audit-role-sweep.mjs"],         evidence: "docs/evidence/role-sweep.json",             what: "13 roles across their reachable pages" },

  // Turns "every button works" from a hedge into a measurement: inventories every
  // interactive control on every route the role sweep reached, then reports how
  // many the suite asserts anything about -- and lists the ones nothing covers.
  //
  // Placed AFTER `role-sweep` because it reads that tier's route list; running it
  // first would silently measure the previous run's routes. (It was briefly
  // registered above `role-sweep` while a comment claimed otherwise.)
  { id: "control-census", tier: "slow",  cmd: ["scripts/audit/qa-control-surface-census.mjs"], evidence: "docs/evidence/control-surface-census.json", what: "interactive-control surface vs. what the suite asserts" },

  // ---- Scripts that no gate invoked ---------------------------------------
  //
  // `audit-gate-coverage.mjs` found these. Each was declared in package.json and
  // each could be run by hand, pass, and change nothing — while carrying a row in
  // docs/COMPLETION_MATRIX.md as though it were covered. That is the quietest
  // way for "audited" to become a claim: the script exists, the row exists, and
  // the only thing missing is the moment it would ever have spoken.
  //
  // All of them need the server, so they are slow tier. `attendance-tz` also
  // creates and deletes attendance rows, which is why it sits after `workflows`
  // rather than beside it — this runner is serial, and the exercises share one
  // database.
  { id: "seo-metadata",     tier: "slow", cmd: ["scripts/audit/audit-seo-metadata.mjs"], evidence: "docs/evidence/seo-metadata.json", what: "titles, descriptions, canonicals, OG and JSON-LD on every sitemap URL, asserted against raw HTML" },
  // `evidence: null` used to be a way of declaring an exemption rather than
  // reporting a gap, and `role-pages` was the one that mattered: it wrote
  // nothing, so its result existed only as terminal scrollback and three
  // documents drifted to three different numbers for it — the matrix said
  // 222/222 "verified today", the ledger said 219/219 from 2026-10-09, and the
  // figure nobody could trace. The script writes role-pages.json now, and this
  // registry is what keeps that file honest; see the rule at the top of the file.
  { id: "role-pages",       tier: "slow", cmd: ["scripts/audit-role-pages.mjs"],         evidence: "docs/evidence/role-pages.json",             what: "every nav-reachable page renders clean for each of the 13 roles" },
  { id: "performance",      tier: "slow", cmd: ["scripts/audit-performance.mjs"],         evidence: "docs/evidence/performance.json", what: "per-route timings against the running server" },
  { id: "payslip-exposure", tier: "slow", cmd: ["scripts/audit/audit-unapproved-payslip-exposure.mjs"], evidence: "docs/evidence/payslip-exposure.json", what: "an employee cannot read a payslip from an unapproved period" },
  { id: "attendance-tz",    tier: "slow", cmd: ["scripts/audit/verify-attendance-tz.mjs"], evidence: "docs/evidence/attendance-tz.json", what: "attendance day boundaries resolve in the employee's timezone, not UTC" },
  { id: "cron-smoke",       tier: "slow", cmd: ["scripts/smoke-cron.mjs"],               evidence: "docs/evidence/cron-smoke.json", what: "cron endpoint refuses an unauthenticated call and honours a dry run" },

  // First, because everything below it is measured against it. A full workflow
  // run once produced 482 assertions against a server 65 minutes older than the
  // build on disk, and one of them read as a live auth defect that the current
  // source cannot produce. "Is the server alive" is not "is the server running
  // the code I think it is".
  { id: "server-fresh", tier: "fast", cmd: ["scripts/audit/audit-server-fresh.mjs"], evidence: "docs/evidence/server-fresh.json", what: "the process answering is not older than .next/BUILD_ID" },

  // Static, so fast tier — and this one gates itself. A coverage check that no
  // gate runs would be the same defect it exists to catch.
  { id: "gate-coverage", tier: "fast", cmd: ["scripts/audit/audit-gate-coverage.mjs"], evidence: "docs/evidence/gate-coverage.json", what: "every declared audit script is wired into a release gate" },

  { id: "gate",             tier: "gate",  cmd: ["__GATE__"],                                   evidence: null, what: "vitest + tsc --noEmit" },
];

// Exit code 2 from a probe means BLOCKED, not FAIL. See qa-probe-signup-workflow.mjs.
const EXIT_MEANING = {
  0: "PASS",
  1: "FAIL",
  2: "BLOCKED",
};

function runGates() {
  // Two gates, run as one logical check, because "634 tests" without "tsc clean"
  // is not a release state.
  return new Promise((resolve) => {
    const results = [];
    let i = 0;
    const steps = [
      { name: "vitest", cmd: "npx vitest run" },
      { name: "tsc", cmd: "npx tsc --noEmit" },
    ];
    const next = () => {
      if (i >= steps.length) return resolve(results);
      const step = steps[i++];
      const started = Date.now();
      const child = spawn(step.cmd, { shell: true, stdio: ["ignore", "pipe", "pipe"] });
      let out = "";
      child.stdout.on("data", (d) => { out += d; });
      child.stderr.on("data", (d) => { out += d; });
      child.on("close", (code) => {
        // Two separate counts. One regex over both lines reported "634 tests /
        // 634 files", because the tests line is `Tests  634 passed (93)` and the
        // files count was being pulled from the wrong capture group.
        const files = out.match(/Test Files\s+(\d+) passed/);
        const tests = out.match(/Tests\s+(\d+) passed/);
        results.push({
          name: step.name,
          code,
          seconds: Math.round((Date.now() - started) / 1000),
          summary:
            code !== 0
              ? out.split("\n").map((l) => l.trim()).filter(Boolean).slice(-2).join(" ").slice(0, 120)
              : step.name === "vitest"
                ? `${tests ? tests[1] : "?"} tests / ${files ? files[1] : "?"} files`
                : "clean",
        });
        next();
      });
    };
    next();
  });
}

function runCheck(check) {
  return new Promise((resolve) => {
    const started = Date.now();
    // One command STRING, not a string plus an argv array. With `shell: true`
    // on Windows, Node does not escape a separate argv (DEP0190).
    //
    // The registry lists `scripts/audit/foo.mjs` without an interpreter, which
    // is how a human reads it — but cmd.exe cannot execute a `.mjs` file
    // directly, so every probe returned FAIL in 0s with no output.
    //
    // `process.execPath` MUST be quoted: on Windows it is normally
    // `C:\Program Files\nodejs\node.exe`, and an unquoted path containing a
    // space is rejected by cmd.exe — which produces exactly the same 0s,
    // empty-output failure as the missing interpreter did. Two different causes,
    // one indistinguishable symptom; that is why the raw output is surfaced
    // below instead of being filtered down to a summary line.
    const isScript = check.cmd[0].endsWith(".mjs");
    const command = isScript
      ? `"${process.execPath}" ${check.cmd.join(" ")}`
      : check.cmd.join(" ");
    const child = spawn(command, {
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
      // Per-check environment (e.g. QA_CHUNK_LABEL, which gives each responsive
      // chunk a short evidence filename the registry can name in advance).
      // Spread process.env first so the child keeps PATH and friends.
      env: { ...process.env, ...(check.env ?? {}) },
    });
    let out = "";
    child.stdout.on("data", (d) => { out += d; });
    child.stderr.on("data", (d) => { out += d; });
    child.on("close", (code) => {
      const tail = out
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => /passed|clean|failures|FAIL|OPEN|BLOCKED|error/i.test(l))
        .slice(-3)
        .join(" | ")
        .slice(0, 160);
      resolve({
        id: check.id,
        what: check.what,
        tier: check.tier,
        status: EXIT_MEANING[code] ?? `EXIT ${code}`,
        code,
        seconds: Math.round((Date.now() - started) / 1000),
        evidence: check.evidence,
        // A check that says PASS but wrote no evidence file is a finding of its
        // own: the number would be unreproducible, which is the exact failure
      // this QA pass was built to stop.
        evidenceWritten: check.evidence ? existsSync(check.evidence) : null,
        tail,
        command,
        // When a check fails with NO output, `tail` is empty and the only thing
        // left to go on is the command that was run. Recording both means the
        // next failure of this shape is diagnosable in seconds instead of by
        // bisecting spawn options.
        rawOutput: code === 0 ? undefined : out.trim().slice(-600) || "(no output at all)",
      });
    });
  });
}

if (listOnly) {
  for (const c of CHECKS) {
    console.log(`${c.tier.padEnd(5)}  ${c.id.padEnd(18)}  ${c.what}`);
  }
  console.log(`\nbase: ${BASE}`);
  process.exit(0);
}

// `--only=<id1,id2,...>` runs exactly those checks, in registry order.
//
// Why this exists: the full `--all` tier does not finish inside a CI step or a
// harness timeout. On 2026-10-20 it was cut off after 22 of 33 checks, and the
// eleven it never reached included the slow tail (`role-sweep`, `control-census`,
// `role-pages`, `performance`) and the last two fast-tier gates — so the checks
// with the least evidence behind them were the ones that never ran. A suite
// whose tail cannot be reached measures its own tail as nothing.
//
// The rollup is still written, and it records only what this invocation ran, so
// a partial run can never be read as a whole one.
const onlyArg = args.find((a) => a.startsWith("--only="));
const onlyIds = onlyArg
  ? onlyArg.slice("--only=".length).split(",").map((s) => s.trim()).filter(Boolean)
  : null;

if (onlyIds) {
  // A typo'd id that silently matches nothing would produce a green run that
  // measured zero checks. That is the "a check that cannot fail" trap, so an
  // unknown id is an error with exit code 2, not an empty selection.
  const known = new Set(CHECKS.map((c) => c.id));
  const unknownIds = onlyIds.filter((id) => !known.has(id));
  if (unknownIds.length) {
    console.error(`Unknown check id(s): ${unknownIds.join(", ")}`);
    console.error(`Known ids: ${[...known].join(", ")}`);
    process.exit(2);
  }
}

const selected = onlyIds
  ? CHECKS.filter((c) => onlyIds.includes(c.id))
  : CHECKS.filter((c) => (wantAll ? true : c.tier !== "slow"));
console.log(`QA suite — ${selected.length} check(s) against ${BASE}`);
if (onlyIds) {
  console.log(`tiers: ${[...new Set(selected.map((c) => c.tier))].join(" + ")} (--only)\n`);
} else {
  console.log(wantAll ? "tiers: fast + gate + slow\n" : "tiers: fast + gate (slow excluded; pass --all to include)\n");
}

// The email budget is roughly one invite per window, and this run spends it.
// Running the suite twice in quick succession therefore reports client-invite as
// BLOCKED the second time even though nothing regressed — which is exactly what
// happened after the 17/17 run. Say so before the output, not after.
if (selected.some((c) => c.id === "client-invite")) {
  console.log(
    "note: this run spends the environment's ONE invite. A client-invite BLOCKED\n" +
      "      straight after a passing one is the quota, not a regression. It no longer\n" +
      "      overwrites docs/evidence/client-invite-check.json when that happens.\n",
  );
}

/**
 * Is anything answering on the app server?
 *
 * Ported from `qa-run-workflows.mjs`, which had this guard and this runner did not.
 *
 * `next start` in this repo reaches ~2.4 GB under sustained browser load and dies.
 * Without the guard this runner does the exact thing the workflow runner's own
 * comment warns against: it keeps scoring checks against a dead server and prints a
 * confident verdict for each. Measured on 2026-10-17 — `not-found`, `dialog-keyboard`
 * and `notification-bell` passed, the server died, and the next SIX checks were
 * reported FAIL: `internal-links`, `client-invite`, `auth-callback` (which reported
 * `TypeError: fetch failed` and 0/0 checks), `runtime-radius`, `contrast` and
 * `typography`. Five of those six were healthy checks measured against a corpse,
 * each naming a specific surface as broken. A summary like that sends the reader to
 * investigate five files that are fine — and it counts against the same evidence
 * rule that treats "we did not measure" as a finding rather than a pass.
 *
 * `server-fresh` already reported this run as BLOCKED for the right reason, which
 * is what finally made the difference visible: one line said "cannot reach the
 * server" while six said "your code is broken".
 */
async function serverAlive() {
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 10000);
    const res = await fetch(`${BASE}/api/health`, { signal: ac.signal });
    clearTimeout(t);
    return res.ok || res.status < 500;
  } catch {
    return false;
  }
}

const outcomes = [];
let serverDown = false;
let stopReason = "";

for (const check of selected) {
  process.stdout.write(`  ${check.id.padEnd(18)} … `);
  if (check.id === "gate") {
    const parts = await runGates();
    const bad = parts.find((p) => p.code !== 0);
    outcomes.push({
      id: "gate",
      what: check.what,
      tier: "gate",
      status: bad ? "FAIL" : "PASS",
      code: bad ? bad.code : 0,
      seconds: parts.reduce((n, p) => n + p.seconds, 0),
      evidence: null,
      evidenceWritten: null,
      tail: parts.map((p) => `${p.name}: ${p.summary}`).join(" | "),
    });
    console.log(`${bad ? "FAIL" : "PASS"}  (${parts.map((p) => `${p.name} ${p.summary}`).join(", ")})`);
    continue;
  }

  // Check BEFORE running, so a dead server costs one probe instead of a check.
  if (serverDown || !(await serverAlive())) {
    serverDown = true;
    stopReason = stopReason || "the app server stopped answering mid-run";
    outcomes.push({
      id: check.id,
      what: check.what,
      tier: check.tier,
      status: "SKIPPED",
      code: null,
      seconds: 0,
      evidence: check.evidence ?? null,
      evidenceWritten: null,
      tail: stopReason,
    });
    console.log(`SKIPPED  (${stopReason})`);
    continue;
  }

  const outcome = await runCheck(check);
  // And re-probe AFTER a failure, because the server can die during the check.
  // A failure against a server that is gone is not a product result.
  if (outcome.status === "FAIL" && !(await serverAlive())) {
    serverDown = true;
    stopReason = "the app server stopped answering during this check";
    outcome.status = "SKIPPED";
    outcome.tail = `${outcome.tail} — ${stopReason}`;
  }
  outcomes.push(outcome);
  console.log(`${outcome.status}  (${outcome.seconds}s)  ${outcome.tail}`);
}

const failed = outcomes.filter((o) => o.status === "FAIL");
const blocked = outcomes.filter((o) => o.status === "BLOCKED");
const skipped = outcomes.filter((o) => o.status === "SKIPPED");
const missingEvidence = outcomes.filter((o) => o.evidence && o.evidenceWritten === false);

const summary = {
  check: "qa-suite",
  generatedAt: new Date().toISOString(),
  base: BASE,
  tiersRun: [...new Set(selected.map((c) => c.tier))],
  // The ids this invocation actually ran. Without this a partial run
  // (`--only=…`) would write a rollup whose `total` looks like a whole-suite
  // total, and a reader would take it for one.
  idsRun: selected.map((c) => c.id),
  // True only when the run covered the WHOLE registry — all 33 checks. The
  // committed fast-tier rollup is therefore always false, and that is the
  // point: "fast tier" and "the whole suite" are different claims and the
  // file says which one it is.
  wholeRegistry: selected.length === CHECKS.length,
  total: outcomes.length,
  passed: outcomes.filter((o) => o.status === "PASS").length,
  failures: failed.length,
  blocked: blocked.length,
  // Neither PASS nor FAIL. Counted separately because a run that lost its server
  // mid-way measured almost nothing, and reporting that as a clean pass is the
  // dishonesty this whole evidence rule exists to prevent.
  skipped: skipped.length,
  skipReason: serverDown ? stopReason : null,
  // A check that passes without leaving evidence is reported, not counted green.
  missingEvidence: missingEvidence.map((o) => o.id),
  results: outcomes,
};

mkdirSync("docs/evidence", { recursive: true });
writeFileSync("docs/evidence/qa-suite.json", JSON.stringify(summary, null, 2) + "\n");

console.log("\n" + "=".repeat(72));
for (const o of outcomes) {
  const mark =
    o.status === "PASS" ? "OK  " : o.status === "BLOCKED" || o.status === "SKIPPED" ? "SKIP" : "FAIL";
  console.log(`${mark}  ${o.id.padEnd(18)} ${String(o.seconds).padStart(4)}s  ${o.what}`);
}
console.log("=".repeat(72));
console.log(
  `${summary.passed}/${summary.total} passed` +
    (blocked.length ? `, ${blocked.length} blocked by the environment` : "") +
    (skipped.length ? `, ${skipped.length} skipped (server gone)` : ""),
);
if (missingEvidence.length) {
  console.log(`\nWARNING — passed but wrote no evidence file: ${missingEvidence.map((o) => o.id).join(", ")}`);
  console.log("A check result printed to a terminal is a claim, not evidence.");
}
if (failed.length) {
  console.log(`\n${failed.length} check(s) FAILED:`);
  for (const f of failed) console.log(`  - ${f.id}: ${f.tail}`);
}
if (skipped.length) {
  console.log(`\n${skipped.length} check(s) SKIPPED — ${stopReason}.`);
  for (const s of skipped) console.log(`  - ${s.id}`);
  console.log(
    "These are NOT passes and NOT failures: nothing was measured. Restart the server and re-run.\n" +
      "Reporting them as FAIL would have named a surface as broken when the surface was fine.",
  );
}
if (blocked.length) {
  console.log(`\n${blocked.length} check(s) BLOCKED by the environment, not by the code:`);
  for (const b of blocked) console.log(`  - ${b.id}: ${b.tail || "see evidence file"}`);
  console.log("These are not regressions. Re-run to pick them up when the window opens.");
}
console.log("\nwrote docs/evidence/qa-suite.json");
if (!wantAll) console.log("note: slow tier not run. --all includes it (role sweep ~20min).");
// 1 = a check genuinely failed. 2 = the run could not tell. Never 0 for an
// incomplete run, however green the passing half looked.
process.exit(failed.length ? 1 : serverDown ? 2 : 0);
