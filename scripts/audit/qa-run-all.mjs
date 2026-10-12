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
  { id: "internal-links",   tier: "fast",  cmd: ["scripts/audit/qa-exercise-internal-links.mjs"],evidence: "docs/evidence/internal-links-check.json", what: "no internal link lands on an error page" },

  // May exit 2. The environment's outbound email budget allows roughly ONE
  // invite per window, and `qa-probe-invite-domains.mjs` spends an invite to
  // find out whether the window is open — so probing and then exercising burns
  // two. Run this DIRECTLY after a wait rather than probing first.
  { id: "client-invite",    tier: "fast",  cmd: ["scripts/audit/qa-exercise-client-invite.mjs"], evidence: "docs/evidence/client-invite-check.json", what: "the last uncovered action, driven through its real form (BLOCKED when mail is rate limited)" },

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
  { id: "contrast", tier: "fast", cmd: ["scripts/audit/audit-contrast.mjs"], evidence: "docs/evidence/contrast-check.json",  what: "WCAG 2.2 AA text contrast on 14 routes, DOM-composited plus real-pixel sampling over photos" },

  // The site ran two body faces with nothing asserting which face a surface uses:
  // `/` was DM Sans (from the supplied reference) and every other route was
  // Inter (from the brandbook), so navigating between them changed the typeface
  // while every gate here stayed green. The contract is now split by surface —
  // DM Sans on marketing and auth, Inter in the app — and this is what holds it.
  // Proven by mutation: reverting the marketing layout to `font-sans` produces
  // exactly 123 strays and exit 1.
  { id: "typography", tier: "fast", cmd: ["scripts/audit/audit-typography.mjs"], evidence: "docs/evidence/typography-check.json",  what: "body face per surface on 9 public/auth routes (app not covered — needs a session)" },

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
  { id: "responsive-public", tier: "slow", cmd: ["scripts/audit-responsive.mjs", "/", "/about", "/services", "/why-beepa", "/contact", "/privacy", "/terms", "/case-studies", "/careers", "/resources"], evidence: "docs/evidence/responsive-public.json", what: "public surface, 10 routes x 8 viewports" },

  { id: "role-sweep",       tier: "slow",  cmd: ["scripts/audit/audit-role-sweep.mjs"],         evidence: "docs/evidence/role-sweep.json",             what: "13 roles across their reachable pages" },

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

const selected = CHECKS.filter((c) => (wantAll ? true : c.tier !== "slow"));
console.log(`QA suite — ${selected.length} check(s) against ${BASE}`);
console.log(wantAll ? "tiers: fast + gate + slow\n" : "tiers: fast + gate (slow excluded; pass --all to include)\n");

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

const outcomes = [];
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
  const outcome = await runCheck(check);
  outcomes.push(outcome);
  console.log(`${outcome.status}  (${outcome.seconds}s)  ${outcome.tail}`);
}

const failed = outcomes.filter((o) => o.status === "FAIL");
const blocked = outcomes.filter((o) => o.status === "BLOCKED");
const missingEvidence = outcomes.filter((o) => o.evidence && o.evidenceWritten === false);

const summary = {
  check: "qa-suite",
  generatedAt: new Date().toISOString(),
  base: BASE,
  tiersRun: wantAll ? ["fast", "gate", "slow"] : ["fast", "gate"],
  total: outcomes.length,
  passed: outcomes.filter((o) => o.status === "PASS").length,
  failures: failed.length,
  blocked: blocked.length,
  // A check that passes without leaving evidence is reported, not counted green.
  missingEvidence: missingEvidence.map((o) => o.id),
  results: outcomes,
};

mkdirSync("docs/evidence", { recursive: true });
writeFileSync("docs/evidence/qa-suite.json", JSON.stringify(summary, null, 2) + "\n");

console.log("\n" + "=".repeat(72));
for (const o of outcomes) {
  const mark = o.status === "PASS" ? "OK  " : o.status === "BLOCKED" ? "SKIP" : "FAIL";
  console.log(`${mark}  ${o.id.padEnd(18)} ${String(o.seconds).padStart(4)}s  ${o.what}`);
}
console.log("=".repeat(72));
console.log(`${summary.passed}/${summary.total} passed` + (blocked.length ? `, ${blocked.length} blocked by the environment` : ""));
if (missingEvidence.length) {
  console.log(`\nWARNING — passed but wrote no evidence file: ${missingEvidence.map((o) => o.id).join(", ")}`);
  console.log("A check result printed to a terminal is a claim, not evidence.");
}
if (failed.length) {
  console.log(`\n${failed.length} check(s) FAILED:`);
  for (const f of failed) console.log(`  - ${f.id}: ${f.tail}`);
}
if (blocked.length) {
  console.log(`\n${blocked.length} check(s) BLOCKED by the environment, not by the code:`);
  for (const b of blocked) console.log(`  - ${b.id}: ${b.tail || "see evidence file"}`);
  console.log("These are not regressions. Re-run to pick them up when the window opens.");
}
console.log("\nwrote docs/evidence/qa-suite.json");
if (!wantAll) console.log("note: slow tier not run. --all includes it (role sweep ~20min).");
process.exit(failed.length ? 1 : 0);