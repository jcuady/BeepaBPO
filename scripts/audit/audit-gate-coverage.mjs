// Which declared audit scripts does a release gate actually run?
//
// WHY
// ---
// `package.json` declares 35 `audit:*` / `verify:*` / `seed:*` scripts. Two
// orchestrators decide what gates a release:
//
//   scripts/verify-all.mjs       — "is this ready to ship?"
//   scripts/audit/qa-run-all.mjs — the presentation + browser tier
//
// Nothing checks that the two agree with package.json, so an audit can be added,
// wired to a package script, given a row in the completion matrix — and never run
// by anything. That is the quietest way for "audited" to become a claim: the
// script exists, the row exists, and the only thing missing is the moment it
// would ever have spoken.
//
// THE FALSE ALARM THIS FILE ALMOST SHIPPED
// ----------------------------------------
// The first version scanned `qa-run-all.mjs` only and reported **28 of 35
// declared scripts are not run by any gate**. That was wrong. `verify-all.mjs`
// spawns the audits directly — vapid, rbac, action-rbac, page-wiring, page
// inventory, design system, filter persistence, payroll overlap, payroll status,
// realtime — so most of those 28 run on every release.
//
// A coverage check that reports a false gap is worse than no check: the reader
// either ignores the file or, worse, trusts the number. So both orchestrators are
// scanned here, and setup/repair scripts are reported as their own group rather
// than being counted as missing coverage.
//
// Exit 1 when a genuine audit is ungated, 2 when the inputs cannot be compared.

import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";

const EVIDENCE = "docs/evidence/gate-coverage.json";

/**
 * Write this gate's verdict to disk.
 *
 * WHY
 * ---
 * This check exists because a declared audit can run by hand, pass, and change
 * nothing. Its own number was in exactly that position: `35 declared, N gated, 0
 * ungated` existed only as terminal scrollback, and the completion matrix quotes
 * it. It also declared `evidence: null` in `qa-run-all.mjs`, which meant the
 * runner's own `missingEvidence` rule could never see it — the check that exists
 * to catch unwired audits was itself unwired, in the only sense available to it.
 *
 * The full lists are written, not just the counts. A count says "0 ungated"; the
 * list says WHICH 35 scripts were considered, so a reader can tell coverage from
 * a parsing accident that matched nothing.
 *
 * `data` is passed in rather than read from module scope on purpose: the abort
 * paths below run BEFORE `gated` / `ungated` / `notGates` are declared, so a
 * closure over them would throw a ReferenceError on exactly the paths that most
 * need to record why they stopped.
 */
function writeEvidence(exitCode, verdict, verdictText, data = {}) {
  mkdirSync("docs/evidence", { recursive: true });
  writeFileSync(
    EVIDENCE,
    JSON.stringify(
      {
        check: "gate-coverage",
        generatedAt: new Date().toISOString(),
        pkg: PKG_PATH,
        gateRunners: GATE_RUNNERS,
        verdict,
        verdictText,
        // The denominator. Without it, "every audit is wired" is unfalsifiable:
        // the same 0 ungated is reported when 35 scripts parse and when 1 does.
        declaredCount: null,
        gatedCount: null,
        ungatedCount: null,
        notGateCount: null,
        gated: [],
        ungated: [],
        notGates: [],
        ...data,
        exitCode,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(`wrote ${EVIDENCE}`);
}

// `--pkg=<path>` / `--runners=<a,b>` point this at fixtures instead of the repo.
// Used by `tests/audit-gate-integrity.test.ts` to prove the gate can go red —
// without them, demonstrating that requires deleting a real entry from the real
// package.json, which is the one file this gate's verdict depends on.
const argv = process.argv.slice(2);
const pkgArg = argv.find((a) => a.startsWith("--pkg="));
const runnersArg = argv.find((a) => a.startsWith("--runners="));

const GATE_RUNNERS = runnersArg
  ? runnersArg.slice("--runners=".length).split(",").filter(Boolean)
  : ["scripts/audit/qa-run-all.mjs", "scripts/verify-all.mjs"];

const PKG_PATH = pkgArg ? pkgArg.slice("--pkg=".length) : "package.json";

// Scripts that are not gates by nature. Seeding sets up state; fixing repairs
// it; planning reconciles a ledger. None of them should ever block a release,
// and counting them as "missing coverage" would be a fabricated finding.
const NON_GATE = /^seed:/;
const NOT_A_GATE = /^fix:/;
const NON_GATE_FILE = /(plan-|reconciliation|read-state)/;

const pkg = JSON.parse(readFileSync(PKG_PATH, "utf8"));

// Every script path either orchestrator can invoke.
const gatePaths = new Set();
for (const runner of GATE_RUNNERS) {
  // A missing runner is not an empty runner. Reading it below would throw an
  // ENOENT stack, which reads as a crash rather than "these inputs cannot be
  // compared" — and a crash is indistinguishable from the gate being broken.
  if (!existsSync(runner)) {
    console.error(`ABORT: gate runner not found: ${runner}`);
    writeEvidence(2, "unknown", `CANNOT TELL — gate runner not found: ${runner}`);
    process.exit(2);
  }
  const src = readFileSync(runner, "utf8");
  for (const m of src.matchAll(/"(scripts\/[^"]+\.(?:mjs|cjs|ts|mts))"/g)) {
    gatePaths.add(m[1].replace(/\\/g, "/"));
  }
}
if (!gatePaths.size) {
  console.error("ABORT: could not read any script paths out of the gate runners.");
  writeEvidence(2, "unknown", "CANNOT TELL — no script paths parsed out of the gate runners");
  process.exit(2);
}

const declared = [];
for (const [name, cmd] of Object.entries(pkg.scripts ?? {})) {
  if (!/^(audit|verify|smoke|seed):/.test(name)) continue;
  const m = /node\s+(?:--[\w-]+(?:=\S+)?\s+)*([\w./-]+\.(?:mjs|cjs|ts|mts))/.exec(String(cmd));
  if (m) declared.push({ name, file: m[1].replace(/\\/g, "/") });
}
if (!declared.length) {
  console.error("ABORT: no audit/verify scripts parsed out of package.json.");
  writeEvidence(2, "unknown", "CANNOT TELL — no audit/verify scripts parsed out of package.json");
  process.exit(2);
}

const gated = [];
const ungated = [];
const notGates = [];

for (const d of declared) {
  const isGate = !NON_GATE.test(d.name) && !NOT_A_GATE.test(d.name) && !NON_GATE_FILE.test(d.file);
  if (!isGate) {
    notGates.push(d);
    continue;
  }
  // A runner is gated by being the gate. `verify:all` points at
  // `scripts/verify-all.mjs`, which is one of the two runners being scanned —
  // asking who invokes the release gate is asking who runs `pnpm verify:all`.
  const wired = gatePaths.has(d.file) || GATE_RUNNERS.includes(d.file);
  (wired ? gated : ungated).push(d);
}

console.log("AUDIT COVERAGE — package.json vs. the release gates");
console.log("─".repeat(64));
console.log(`gate runners scanned: ${GATE_RUNNERS.length} (${gatePaths.size} script paths)`);
console.log(`${declared.length} declared audit/verify/smoke/seed script(s)`);
console.log(`  ${gated.length} gated`);
console.log(`  ${ungated.length} ungated`);
console.log(`  ${notGates.length} setup/repair/planning, not gates by nature\n`);

if (!ungated.length) {
  console.log("VERDICT: every declared audit script is wired into a release gate.");
  for (const g of gated) console.log(`  gated:  ${g.name}`);
  writeEvidence(0, "covered", "every declared audit script is wired into a release gate", {
    declaredCount: declared.length,
    gatedCount: gated.length,
    ungatedCount: 0,
    notGateCount: notGates.length,
    gated,
    ungated: [],
    notGates,
  });
  process.exit(0);
}

console.log(`VERDICT: ${ungated.length} audit script(s) run by nothing that gates a release.\n`);
for (const d of ungated) console.log(`  ${d.name.padEnd(26)} ${d.file}`);
console.log(
  "\nEach of these can be run by hand and pass, while nothing that gates a\n" +
    "release would ever invoke it. Either register it with a gate runner or move\n" +
    "it out of the audit: family — an audit nothing runs is not an audit.",
);
writeEvidence(
  1,
  "gap",
  `${ungated.length} audit script(s) run by nothing that gates a release`,
  {
    declaredCount: declared.length,
    gatedCount: gated.length,
    ungatedCount: ungated.length,
    notGateCount: notGates.length,
    gated,
    ungated,
    notGates,
  },
);
process.exit(1);