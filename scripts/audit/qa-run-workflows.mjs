// Run every *workflow exercise* in this directory and aggregate the verdict.
//
// WHY THIS EXISTS
// ---------------
// `qa-run-all.mjs` answers "is the presentation and the release gate healthy":
// dialogs, contrast, typography, radius, responsive sweeps, a 13-role layout
// sweep, vitest. All of that is real, and all of it is about how the product
// *looks* and whether it *builds*.
//
// It answers nothing about whether the product *works*. The directory already
// held twenty scripts that drive the real thing through a browser -- payroll
// through its approval chain, attendance through correction and approval,
// notifications through mark-one/mark-all and preferences, leave, tickets, NTE,
// documents, client timesheets, money, recruitment, CRM, CMS, hiring, admin
// workflows -- and none of them were registered anywhere. They ran when someone
// remembered the command. "Is payroll functional?" was answerable only by
// knowing a filename.
//
// THE GAP THAT HAD REAL COST
// --------------------------
// The signup exercise asserts the form's shape by filling it. When the signup
// form became role-aware, `#company` stopped rendering on the default
// (applicant) path and that script started failing -- correctly reporting that
// it could no longer drive the form, and telling nobody that the coverage had
// silently rotted. A workflow suite nobody runs is a claim, not a check.
//
// WHAT THIS DOES DIFFERENTLY
// --------------------------
//   - Same BLOCKED(2) vs FAIL(1) distinction the other runner makes. An email
//     rate limit is an environment outcome; flattening it into a failure makes
//     the suite permanently red for a reason no code change can fix.
//   - Each entry must exit 0 AND leave its evidence file. A pass with no file
//     behind it is a finding, not a pass.
//   - Serial, never parallel: these scripts create and delete fixtures in one
//     shared database. Two of them at once corrupt each other's cleanup, and
//     the failure looks like a product bug.
//   - Reports which scripts in this directory are NOT registered here, so a
//     new exercise cannot be added without being noticed.
//
// Usage:
//   node scripts/audit/qa-run-workflows.mjs
//   node scripts/audit/qa-run-workflows.mjs --list
//   node scripts/audit/qa-run-workflows.mjs --only payroll,attendance
//   node scripts/audit/qa-run-workflows.mjs --batch=5

import { spawn } from "node:child_process";
import { existsSync, readdirSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.QA_BASE_URL ?? "http://localhost:3100";
const args = process.argv.slice(2);
const listOnly = args.includes("--list");
const onlyArg = args.find((a) => a.startsWith("--only="));
const only = onlyArg ? onlyArg.split("=")[1].split(",").map((s) => s.trim()) : null;
const batchArg = args.find((a) => a.startsWith("--batch="));
const batchSize = batchArg ? Number(batchArg.split("=")[1]) : 0;

/**
 * id:      short name, used by --only and in the report
 * script:  file in this directory
 * evidence: the file it is expected to have written
 * what:    the claim it proves, in the words of the question it answers
 */
const WORKFLOWS = [
  { id: "auth",          script: "qa-exercise-auth-workflow.mjs",                       what: "sign in/out, sign-out-everywhere, access-denied, no account leakage" },
  { id: "signup",        script: "qa-exercise-signup-workflow.mjs",                   what: "applicant and client registration reach verification" },
  { id: "payroll",       script: "qa-exercise-payroll-workflow.mjs",                 what: "salary edit, period, recalculate, 2-step approval to finalized" },
  { id: "attendance",    script: "qa-exercise-attendance-workflow.mjs",           what: "clock in/out, corrections, HR approval, delete" },
  { id: "leave",         script: "qa-exercise-leave-workflow.mjs",                     what: "request, approve/deny, balance impact" },
  { id: "notifications", script: "qa-exercise-notifications-workflow.mjs",     what: "mark one/all read, per-user isolation, digest preference" },
  { id: "tickets",       script: "qa-exercise-tickets-workflow.mjs",                 what: "ticket list, create, status transitions" },
  { id: "documents",     script: "qa-exercise-documents-workflow.mjs",             what: "upload, list, visibility scoping" },
  { id: "nte",           script: "qa-exercise-nte-workflow.mjs",                         what: "notification to evaluate, accept/decline" },
  { id: "client-timesheet", script: "qa-exercise-client-timesheet-workflow.mjs", what: "client approves submitted timesheets" },
  { id: "money",         script: "qa-exercise-money-workflow.mjs",                     what: "cash advances and billing across the lifecycle" },
  { id: "recruitment",   script: "qa-exercise-recruitment-workflow.mjs",         what: "job, applicant, pipeline stage moves" },
  { id: "crm",           script: "qa-exercise-crm-workflow.mjs",                         what: "lead and deal lifecycle with activity log" },
  { id: "cms",           script: "qa-exercise-cms-workflow.mjs",                         what: "publish and unpublish round trip" },
  { id: "hire",          script: "qa-exercise-hire-workflow.mjs",                       what: "hire to employee, org membership, cleanup" },
  { id: "admin-workflow", script: "qa-exercise-admin-workflow.mjs",           what: "admin actions behind their permission" },
  { id: "profile",       script: "qa-exercise-profile-workflow.mjs",                 what: "profile read and write persistence" },
  { id: "list-filters",  script: "qa-exercise-list-filters.mjs",               what: "filtering, search and pagination on list views" },
  { id: "ticket-detail", script: "qa-exercise-ticket-workflow.mjs",            what: "single ticket detail, assignment and status change" },
  { id: "sitemap",       script: "qa-exercise-sitemap-unpublish.mjs",         what: "unpublish leaves the sitemap and republish restores it" },
  { id: "uncovered-roles", script: "qa-exercise-uncovered-roles.mjs",         what: "sales, finance, client_viewer: the three roles no other exercise drives" },
];

/**
 * Exercises deliberately NOT in this registry, and why.
 *
 * Each spends the shared Supabase email budget, or duplicates a gate
 * `qa-run-all.mjs` already owns. Registering them here would run them twice per
 * full suite -- and for the invite, spend a second, rarer invite that the probe
 * has already used.
 *
 * Listed so the "not registered" report does not read as an unexplained gap.
 */
const REGISTERED_ELSEWHERE = {
  "qa-exercise-client-invite.mjs": "qa-run-all.mjs (email budget — one invite per window)",
  "qa-exercise-internal-links.mjs": "qa-run-all.mjs (public + app link sweep)",
  "qa-exercise-reset-password.mjs": "email budget — run directly after a wait",
};

/**
 * These exercises print PASS/FAIL lines and exit. They write no evidence file,
 * which is precisely why they were never registered: a check result printed to
 * a terminal is a claim, not evidence. So the runner parses each line back into
 * a structured record and writes `docs/evidence/workflow-<id>.json`.
 *
 * A line is `PASS  <name>  [detail]`, `FAIL  <name>  [detail]`, or
 * `NOTE  <text>`. Anything that is not a PASS/FAIL assertion -- prose, the
 * cleanup report, the summary -- is kept under `other` rather than counted,
 * so the pass/fail numbers cannot be inflated by a stray match.
 */
function parseOutput(out) {
  const checks = [];
  const notes = [];
  const other = [];
  for (const line of out.split(/\r?\n/)) {
    const t = line.trimEnd();
    const m = /^(PASS|FAIL)\s\s(.+?)(?:\s\s\[(.*)\])?$/.exec(t);
    if (m) {
      checks.push({ pass: m[1] === "PASS", name: m[2].trim(), detail: m[3] ?? null });
      continue;
    }
    if (/^NOTE\s\s/.test(t)) notes.push(t.replace(/^NOTE\s\s/, ""));
    else if (t) other.push(t);
  }
  return { checks, notes, other };
}

if (listOnly) {
  console.log(`${WORKFLOWS.length} workflow exercises registered:\n`);
  for (const w of WORKFLOWS) console.log(`  ${w.id.padEnd(16)} ${w.what}`);
  process.exit(0);
}

const selected = only ? WORKFLOWS.filter((w) => only.includes(w.id)) : WORKFLOWS;

// A typo inside --only is the dangerous form: `--only=payrol,attendance` used to
// run attendance alone and exit green, so a request for two areas quietly
// became a request for one. An id that matched nothing is an error, not a
// silent narrowing. Checked before the empty-selection case so an all-typo
// request gets the useful message.
if (only) {
  const unknown = only.filter((id) => !WORKFLOWS.some((w) => w.id === id));
  if (unknown.length) {
    console.error(
      `unknown workflow id(s): ${unknown.join(", ")}\n` +
        `known ids: ${WORKFLOWS.map((w) => w.id).join(", ")}\n` +
        "Nothing was run. Re-run with --list to see the registry.",
    );
    process.exit(2);
  }
}
if (!selected.length) {
  console.error(`no workflow matched ${JSON.stringify(only)}`);
  process.exit(2);
}

/**
 * Chunked execution.
 *
 * WHY: `next start` in this repo reaches ~2.4 GB under sustained browser load
 * and takes the app server down with it -- the limit `qa-run-all.mjs` already
 * documents for its responsive sweep. One long run therefore dies part-way
 * through and every later exercise is reported SKIPPED. Chunking lets an
 * operator restart the server between chunks and still end up with one
 * complete, honest summary.
 *
 * The summary does NOT depend on this: it is rebuilt from the per-exercise
 * evidence files on every run, so however the suite is executed the rollup
 * always describes all twenty-one registered exercises.
 */
const chunks = [];
if (batchSize > 0) {
  for (let i = 0; i < selected.length; i += batchSize) chunks.push(selected.slice(i, i + batchSize));
} else {
  chunks.push(selected);
}

// Anything in this directory that looks like an exercise but is not registered
// here is reported, so the registry cannot quietly fall behind the directory.
const registered = new Set(WORKFLOWS.map((w) => w.script));
const orphans = existsSync("scripts/audit")
  ? readdirSync("scripts/audit")
      .filter((f) => /^qa-exercise-.*\.mjs$/.test(f) && !registered.has(f))
      .filter((f) => !(f in REGISTERED_ELSEWHERE))
      .sort()
  : [];

function run(script) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ["--env-file=.env.local", `scripts/audit/${script}`], {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, QA_BASE_URL: BASE },
    });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    child.on("close", (code) => resolve({ code: code ?? 0, out }));
  });
}

/**
 * Is the app still answering?
 *
 * WHY THIS IS NEEDED, and why it is not belt-and-braces
 * ------------------------------------------------------
 * The first run of this file crashed part-way through and took the suite's
 * credibility with it. `next start` died under sustained browser load -- the
 * same failure `qa-run-all.mjs` documents for `audit-app-responsive` ("reaches
 * 2.4 GB and takes the app server down with it") -- and every subsequent
 * exercise then failed against a socket that was no longer listening.
 *
 * The dangerous part was not the crash. It was that attendance reported five
 * FAILED assertions ("Clock In creates today's record -- no row appeared",
 * "Clock Out sets clock_out_at") against a server that was already dead, and
 * left a half-made record behind that broke the *next* run's precondition. A
 * dead server had produced a confident, specific, entirely fictional report
 * about a defect in the most daily-use feature the product has.
 *
 * So a server that is not answering yields SKIPPED, which is neither PASS nor
 * FAIL, and the run stops rather than manufacturing verdicts from a corpse.
 */
async function serverAlive() {
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 15000);
    const res = await fetch(BASE, { signal: ac.signal });
    clearTimeout(t);
    return res.ok || res.status < 500;
  } catch {
    return false;
  }
}

const results = [];
const ranThisRun = new Set();
mkdirSync("docs/evidence", { recursive: true });
console.log(
  `Running ${selected.length} workflow exercise(s) against ${BASE}` +
    (chunks.length > 1 ? ` in ${chunks.length} chunk(s) of <=${batchSize}` : "") +
    "\n",
);

if (!(await serverAlive())) {
  console.error(
    `ABORT: ${BASE} is not answering. Start it with \`pnpm build && npx next start -p 3100\`\n` +
      "       and re-run. Nothing was exercised, so nothing is reported.",
  );
  process.exit(2);
}

let serverDown = false;

for (const [ci, chunk] of chunks.entries()) {
  if (chunks.length > 1) console.log(`\n-- chunk ${ci + 1}/${chunks.length} --`);

  for (const w of chunk) {
    if (serverDown) {
      results.push({
        id: w.id,
        verdict: "SKIPPED",
        assertions: 0,
        evidence: `docs/evidence/workflow-${w.id}.json`,
        what: w.what,
        note: "server stopped answering during this run",
      });
      console.log(`  ${w.id.padEnd(16)} SKIPPED (server down)`);
      continue;
    }

    process.stdout.write(`  ${w.id.padEnd(16)} ...`);
    const { code, out } = await run(w.script);
    ranThisRun.add(w.id);
    const verdict = code === 0 ? "PASS" : code === 2 ? "BLOCKED" : "FAIL";
    const parsed = parseOutput(out);

    // Cross-check the exit code against what the exercise actually asserted. An
    // exercise that prints a FAIL line and exits 0 is broken in its own right;
    // that is the "a check printed to a terminal is a claim" failure mode.
    const printedFailures = parsed.checks.filter((c) => !c.pass).length;
    let final = verdict;
    if (verdict === "PASS" && printedFailures > 0) final = "FAIL";

    // A failing exercise against a server that has died is not a product result.
    // Re-probe before believing it, and downgrade to SKIPPED if it is gone.
    if (final === "FAIL" && !(await serverAlive())) {
      serverDown = true;
      final = "SKIPPED";
    }

    const evidenceFile = `docs/evidence/workflow-${w.id}.json`;
    writeFileSync(
      evidenceFile,
      JSON.stringify(
        {
          id: w.id,
          script: `scripts/audit/${w.script}`,
          claim: w.what,
          base: BASE,
          when: new Date().toISOString(),
          exitCode: code,
          verdict: final,
          assertions: parsed.checks.length,
          // Every assertion, not only the failures. A report that stores only
          // what went wrong cannot answer "was this actually exercised", and
          // that question is the one a reader asks first.
          checks: parsed.checks,
          failedAssertions: parsed.checks.filter((c) => !c.pass),
          notes: parsed.notes,
          other: parsed.other,
        },
        null,
        2,
      ) + "\n",
    );

    results.push({
      id: w.id,
      verdict: final,
      code,
      assertions: parsed.checks.length,
      evidence: evidenceFile,
      what: w.what,
    });
    console.log(
      ` ${final} (${parsed.checks.length} assertions${printedFailures && final !== "SKIPPED" ? `, ${printedFailures} failed` : ""})`,
    );
  }
}

/**
 * The summary is a rollup over EVERY registered exercise, not the slice that
 * happened to run in this invocation.
 *
 * WHY THIS IS NOT OPTIONAL
 * ------------------------
 * The file is called `workflow-summary.json` and is the only artefact a reader
 * would look at to answer "how many exercises pass?". As written it recorded
 * only `results`, so a one-exercise run (`--only=sitemap`) overwrote a
 * twenty-one-exercise tally with a single PASS -- the summary quietly
 * answering a different, much smaller question than its name implies.
 *
 * So the rollup reads every per-exercise evidence file on disk and carries
 * each one's own `when`. A verdict is never presented as fresher than the run
 * that produced it, and an exercise with no evidence at all is reported as
 * NO_EVIDENCE rather than being absent from the count.
 */
const rollup = WORKFLOWS.map((w) => {
  const file = `docs/evidence/workflow-${w.id}.json`;
  if (!existsSync(file)) {
    return { id: w.id, verdict: "NO_EVIDENCE", assertions: 0, what: w.what, evidence: file, when: null };
  }
  let doc;
  try {
    doc = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return { id: w.id, verdict: "UNREADABLE", assertions: 0, what: w.what, evidence: file, when: null };
  }
  return {
    id: w.id,
    verdict: doc.verdict ?? "UNKNOWN",
    assertions: doc.assertions ?? 0,
    what: w.what,
    evidence: file,
    when: doc.when ?? null,
    ranThisRun: ranThisRun.has(w.id),
  };
});

const tally = (v) => rollup.filter((r) => r.verdict === v).length;
const rollupPass = tally("PASS");
const rollupBlocked = tally("BLOCKED");
const rollupSkipped = tally("SKIPPED");
const rollupFailed = [...rollup.filter((r) => r.verdict === "FAIL"), ...rollup.filter((r) => r.verdict === "UNREADABLE")];
const rollupMissing = rollup.filter((r) => r.verdict === "NO_EVIDENCE");

writeFileSync(
  "docs/evidence/workflow-summary.json",
  JSON.stringify(
    {
      base: BASE,
      when: new Date().toISOString(),
      registryTotal: WORKFLOWS.length,
      ranThisInvocation: [...ranThisRun],
      totals: {
        pass: rollupPass,
        blocked: rollupBlocked,
        skipped: rollupSkipped,
        fail: rollupFailed.length,
        noEvidence: rollupMissing.length,
      },
      totalAssertions: rollup.reduce((n, r) => n + r.assertions, 0),
      unregisteredScripts: orphans,
      results: rollup,
    },
    null,
    2,
  ) + "\n",
);

console.log(
  `\nSuite rollup over all ${WORKFLOWS.length} registered exercises: ` +
    `${rollupPass} PASS, ${rollup.reduce((n, r) => n + r.assertions, 0)} assertions` +
    (rollupBlocked ? `, ${rollupBlocked} BLOCKED` : "") +
    (rollupSkipped ? `, ${rollupSkipped} SKIPPED` : "") +
    (rollupFailed.length ? `, ${rollupFailed.length} FAIL` : "") +
    (rollupMissing.length ? `, ${rollupMissing.length} NO_EVIDENCE` : ""),
);
const thisRun = results.filter((r) => r.verdict === "SKIPPED");
if (thisRun.length) {
  console.log(
    `\nNOTE  ${thisRun.length} exercise(s) never ran because the server stopped\n` +
      "      answering. That is an environment outcome, not a product verdict.\n" +
      "      Restart it and re-run before believing any of those areas.\n" +
      `      ${thisRun.map((s) => s.id).join(", ")}`,
  );
}
if (rollupMissing.length) {
  console.log(
    `\nNOTE  no evidence file for: ${rollupMissing.map((s) => s.id).join(", ")}\n` +
      "      These were never exercised (or the evidence was deleted). Run them\n" +
      "      before treating this suite as complete.",
  );
}
if (orphans.length) {
  console.log(`\nNOTE  exercises present in scripts/audit but not registered here:\n  ${orphans.join("\n  ")}`);
}
if (rollupFailed.length) {
  console.log("\nFAILURES:");
  for (const f of rollupFailed) console.log(`  - ${f.id}: ${f.what}`);
}
console.log("\nwrote docs/evidence/workflow-summary.json");

// A failure in ANY recorded exercise fails the suite, not only one in this
// invocation: otherwise a chunked run of the healthy half would report green
// over a red rollup sitting in the evidence directory.
process.exit(rollupFailed.length ? 1 : 0);