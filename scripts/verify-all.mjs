#!/usr/bin/env node
// Per-session verify-all script. Runs the entire smoke + typecheck + test
// suite + VAPID + realtime event test. Designed for "is this ready to
// ship?" gating.
//
// Usage:  node scripts/verify-all.mjs [--skip-migration]
//
// Exit code 0 = all green, 1 = at least one failure or skipped check.
//
// --skip-migration skips the migration structural preflight and nothing else.
// It does not soften any other step, and in particular it no longer excuses a
// failed realtime probe: that check once reported a skip blaming an unapplied
// migration which was, in fact, applied.

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname ?? new URL(".", import.meta.url).pathname, "..");
const SKIP_MIGRATION = process.argv.includes("--skip-migration");

// ANSI codes (skipped if NO_COLOR)
const c = (n) => (process.env.NO_COLOR ? "" : `\x1b[${n}m`);
const RED = c(31);
const GREEN = c(32);
const YELLOW = c(33);
const BOLD = c(1);
const DIM = c(2);
const RESET = c(0);

let totalSteps = 0;
let passedSteps = 0;
/** Steps that deliberately did not verify anything; never counted as passed. */
const skippedSteps = [];
/**
 * Steps that actually threw. Tracked explicitly rather than derived.
 *
 * `totalSteps - passedSteps` was wrong: it silently classified every skipped
 * step as a failure, so a run with 2 real failures and 1 skip reported
 * "3 step(s) failed, 1 skipped" — 17 steps out of 16. The verdict was right by
 * luck; the number was not. This tool exists to be believed, and a summary that
 * does not add up is how people learn to ignore it.
 */
const failedStepList = [];

function banner(label) {
  console.log(`\n${BOLD}${label}${RESET}\n${"─".repeat(label.length)}`);
}

function step(label, fn) {
  totalSteps++;
  const start = Date.now();
  console.log(`\n[${totalSteps}] ${label}`);
  try {
    const out = fn();
    if (out?.skipped) {
      console.log(`${YELLOW}  skipped${RESET} ${DIM}${out.reason}${RESET}`);
      skippedSteps.push({ label, reason: out.reason });
    } else {
      const ms = Date.now() - start;
      passedSteps++;
      console.log(`${GREEN}  PASS${RESET} ${DIM}(${ms}ms)${RESET}`);
    }
  } catch (e) {
    console.log(`${RED}  FAIL${RESET}\n  ${e.message}`);
    failedStepList.push({ label, message: e.message });
    if (e.stdout) console.log(e.stdout?.toString().split("\n").slice(-20).map((l) => "    " + l).join("\n"));
    if (e.stderr) console.log(e.stderr?.toString().split("\n").slice(-20).map((l) => "    " + l).join("\n"));
  }
}

function run(cmd, args, options = {}) {
  const r = spawnSync(cmd, args, { cwd: ROOT, encoding: "utf8", ...options });
  if (r.status !== 0) {
    const out = (r.stdout || "") + (r.stderr || "");
    throw new Error(`exit ${r.status}: ${out || "<empty output>"}`);
  }
  return r;
}

// Local binaries (avoid npx --no-install which can return null exit under spawn).
const TSC = resolve(ROOT, "node_modules/.bin/tsc.cmd");
const VITEST = resolve(ROOT, "node_modules/.bin/vitest.cmd");
const ESLINT = resolve(ROOT, "node_modules/.bin/eslint.cmd");
const NEXT = resolve(ROOT, "node_modules/.bin/next.cmd");

// 1. Load env
const env = {};
for (const line of readFileSync(resolve(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
  if (!line || line.trim().startsWith("#")) continue;
  const idx = line.indexOf("=");
  if (idx < 0) continue;
  let v = line.slice(idx + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  env[line.slice(0, idx).trim()] = v;
}
for (const [k, v] of Object.entries(env)) if (process.env[k] === undefined) process.env[k] = v;

const haveSupabase = !!env.NEXT_PUBLIC_SUPABASE_URL && !!(env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY);

// Build a redacted env for child processes — they need real keys but we don't
// want them echoed in the parent console.
function childEnv() {
  return { ...process.env };
}

banner("VERIFY ALL — BeepoBeepa — " + new Date().toISOString());

step("Node version >= 22", () => {
  const r = spawnSync("node", ["--version"], { encoding: "utf8" });
  const v = String(r.stdout).replace(/^v/, "").trim();
  const major = parseInt(v.split(".")[0], 10);
  if (major < 22) throw new Error(`Node ${v} found, need >= 22`);
  console.log(`  ${DIM}node ${v}${RESET}`);
});

step("VAPID keys present + well-formed", () => {
  const pub = env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
  const priv = env.VAPID_PRIVATE_KEY ?? "";
  if (!pub || !priv) throw new Error("VAPID keys missing");
  if (pub.length !== 87) throw new Error(`public key length ${pub.length} != 87`);
  if (priv.length !== 43) throw new Error(`private key length ${priv.length} != 43`);
  console.log(`  ${DIM}public ${pub.length} chars, private ${priv.length} chars, subject ${env.VAPID_SUBJECT ?? "(unset)"}${RESET}`);
});

step("VAPID keys accepted by web-push", () => {
  const r = spawnSync("node", ["scripts/audit/test-vapid.mjs"], { cwd: ROOT, encoding: "utf8" });
  if (r.status !== 0) throw new Error(r.stderr || r.stdout);
  console.log("  " + r.stdout.toString().split("\n").filter((l) => l.includes("[OK]")).join("\n  "));
});

step("Authorization (route gates)", () => {
  const r = spawnSync("node", ["scripts/audit/audit-rbac.mjs"], { cwd: ROOT, encoding: "utf8" });
  if (r.status !== 0) throw new Error(r.stderr || r.stdout);
  const m = r.stdout.toString().match(/Gated:.*$/m);
  console.log(`  ${DIM}${m ? m[0] : "ok"}${DIM}`);
});

step("Authorization (action handlers)", () => {
  const r = spawnSync("node", ["scripts/audit/audit-action-rbac.mjs"], { cwd: ROOT, encoding: "utf8" });
  if (r.status !== 0) throw new Error(r.stderr || r.stdout);
  const m = r.stdout.toString().match(/action-rbac:.*$/m);
  console.log(`  ${DIM}${m ? m[0] : "ok"}${DIM}`);
});

step("Page wiring (no dead controls)", () => {
  const r = spawnSync("node", ["scripts/audit/audit-page-wiring.mjs"], { cwd: ROOT, encoding: "utf8" });
  if (r.status !== 0) throw new Error(r.stderr || r.stdout);
  const out = r.stdout.toString();
  const total = Number(out.match(/Total candidates: (\d+)/)?.[1] ?? -1);
  if (total < 0) throw new Error("page-wiring scan produced no verdict line");
  if (total > 0) {
    // Print the offenders, then fail: a dead button is a shipping defect, not
    // a warning.
    console.log(out.split("\n").filter((l) => l.trim().startsWith("components/") || l.trim().startsWith("app/")).slice(0, 20).map((l) => `  ${l}`).join("\n"));
    throw new Error(`page wiring: ${total} unwired control(s) detected`);
  }
  console.log(`  ${DIM}${out.match(/Scanned .*$/m)?.[0] ?? "ok"}; 0 candidates${DIM}`);
});

step("Page inventory current", () => {
  const r = spawnSync("node", ["scripts/audit/generate-page-inventory.mjs", "--check"], { cwd: ROOT, encoding: "utf8" });
  if (r.status !== 0) throw new Error(r.stderr || r.stdout);
  console.log(`  ${DIM}${(r.stdout.toString().trim())}${DIM}`);
});

// Every favicon, PWA icon and the OG card is DERIVED from one file,
// `public/brand/logo-mark-raw.png`, by these two generators. That is the only
// reason the mark can be swapped in one place.
//
// It is also the only reason a swap can leave the site lying: replace the source
// PNG and the 16px favicon, the .ico, apple-touch-icon and the social card all
// keep showing the OLD company, with every test in the repo green. Both
// generators re-derive and compare bytes in `--check`, so the drift is caught by
// the ship gate rather than by whoever notices the tab icon is wrong.
step("Brand icons derived from the logo mark", () => {
  const r = spawnSync("node", ["scripts/generate-brand-icons.mjs", "--check"], { cwd: ROOT, encoding: "utf8" });
  if (r.status !== 0) {
    console.log(r.stdout.toString().split("\n").filter((l) => /drift|differs|missing|coverage|dimension/i.test(l)).slice(0, 15).map((l) => `  ${l}`).join("\n"));
    throw new Error("derived icons no longer match public/brand/logo-mark-raw.png — re-run without --check");
  }
  const out = r.stdout.toString();
  console.log(`  ${DIM}${out.split("\n").filter((l) => /ok|icons|unchanged/i.test(l)).slice(-1)[0]?.trim() ?? "ok"}${RESET}`);
});

step("OG image matches the declared brand", () => {
  // The card is composed, not drawn: hero photo + the real horizontal logo on a
  // white chip + the tagline read out of `lib/site.ts`. Its first version
  // declared 1672x941 while the file was 1200x630, so every social share cropped
  // the logo off, and the brand name on it was a hand-typed "BEEPA" pill instead
  // of the actual artwork. Those are invisible to a metadata check -- the tag is
  // present and correctly formed in both versions. So this compares the pixels.
  const r = spawnSync("node", ["scripts/generate-og-image.mjs", "--check"], { cwd: ROOT, encoding: "utf8" });
  if (r.status !== 0) {
    console.log(r.stdout.toString().split("\n").filter((l) => /drift|differs|size|dimension|regenerate/i.test(l)).slice(0, 10).map((l) => `  ${l}`).join("\n"));
    throw new Error("public/images/og.png is stale — re-run without --check");
  }
  // The generator's own lines, not a sentence typed here. This step used to print
  // "1200x630, composed from the real logo" as a literal — which is a claim the
  // gate cannot falsify, and it would have stayed on screen unchanged if the card
  // were rebuilt at 1600x900.
  const out = r.stdout.toString();
  const lines = out.split("\n").map((l) => l.trim()).filter((l) => /agrees|matches/i.test(l));
  if (!lines.length) throw new Error(`og --check exited 0 but reported nothing to show:\n${out.trim()}`);
  console.log(`  ${DIM}${lines.join(" | ")}${RESET}`);
});

// The careers hero wears the company's mark, and the mark is COMPOSITED onto the
// artwork rather than drawn into it — an image generator cannot draw a logo, and
// a mark that looks like a logo but is not one is the one thing this site must
// never ship. So the hero is a derivative of `public/brand/beepa-logo-horizontal.png`
// like every other brand asset, and `--check` re-derives it and compares bytes.
//
// Without this step, replacing the brand file would leave the careers hero
// wearing the OLD company's mark, with every other gate green: nothing else on
// the site looks at that image.
step("Careers hero wears the current logo", () => {
  const r = spawnSync("node", ["scripts/generate-careers-hero.mjs", "--check"], { cwd: ROOT, encoding: "utf8" });
  if (r.status !== 0) {
    console.log(r.stdout.toString().split("\n").filter((l) => /stale|drift|refus|green px|white px/i.test(l)).slice(0, 15).map((l) => `  ${l}`).join("\n"));
    throw new Error("public/images/landing/careers-hero.webp no longer matches the brand file — re-run without --check");
  }
  const out = r.stdout.toString();
  const lines = out.split("\n").map((l) => l.trim()).filter((l) => /^ok\s+public\/images\/landing\//.test(l));
  if (!lines.length) throw new Error(`careers hero --check exited 0 but reported nothing to show:\n${out.trim()}`);
  console.log(`  ${DIM}${lines.join(" | ")}${RESET}`);
});

step("Design system consistency", () => {
  // Raw elements where a primitive already exists, or a colour literal outside
  // the token layer, means the app has more than one design system. Both are
  // real accessibility defects, not taste: the first pass found 26 dropdowns
  // with no focus ring at all.
  const r = spawnSync("node", ["scripts/audit-design-system.mjs"], { cwd: ROOT, encoding: "utf8" });
  if (r.status !== 0) {
    const out = r.stdout.toString();
    console.log(out.split("\n").filter((l) => /RAW PRIMITIVE|HARDCODED|components\/|app\//.test(l)).slice(0, 25).map((l) => `  ${l}`).join("\n"));
    throw new Error("design system drift: see the offenders listed above");
  }
  const out = r.stdout.toString();
  const radius = out.match(/ARBITRARY RADIUS\s+(.+?)\s*$/m)?.[1]?.trim();
  console.log(`  ${DIM}0 raw primitives, 0 hardcoded colours${radius ? `; ${radius}` : ""}${DIM}`);
});

step("Filters survive pagination", () => {
  // A filter rendered in the FilterBar but left out of the pager's `query`
  // prop is dropped the moment the user clicks Next. No error, no empty state —
  // just a wider list that answers a question nobody asked. Found on
  // /app/admin/users, where the role filter vanished on page two.
  const r = spawnSync("node", ["scripts/audit-filter-persistence.mjs"], { cwd: ROOT, encoding: "utf8" });
  if (r.status !== 0) {
    console.log(r.stdout.toString().split("\n").filter((l) => /FAIL|app\/|reads:/.test(l)).slice(0, 25).map((l) => `  ${l}`).join("\n"));
    throw new Error("a paginated page drops a filter when the page changes");
  }
  const out = r.stdout.toString();
  console.log(`  ${DIM}${out.match(/scanned .*$/m)?.[0] ?? "ok"}; 0 dropped${DIM}`);
});

step("Touch targets meet 44px", () => {
  // Registered here, and not merely declared in package.json. An audit that no
  // gate invokes can be run by hand, pass, and change nothing — which is how
  // "audited" quietly stops meaning anything.
  const r = spawnSync("node", ["scripts/audit/audit-touch-overrides.mjs"], { cwd: ROOT, encoding: "utf8" });
  if (r.status !== 0) throw new Error(r.stderr || r.stdout);
  const out = r.stdout.toString();
  console.log(`  ${DIM}${out.split("\n").filter((l) => /VERDICT|scanned|under 44/i.test(l)).slice(0, 3).join(" | ") || "ok"}${RESET}`);
});

step("Every app page declares its data shape", () => {
  // `audit-tables.mjs` walks app/app and reports each page's action, permission,
  // and whether filter / pager / empty state are present. Informational by
  // design — it exits 0 even with pages that omit an empty state — so this gate
  // surfaces the numbers rather than pretending it found nothing to say.
  const r = spawnSync("node", ["scripts/audit/audit-tables.mjs"], { cwd: ROOT, encoding: "utf8" });
  if (r.status !== 0) throw new Error(r.stderr || r.stdout);
  const out = r.stdout.toString();
  console.log(`  ${DIM}${out.split("\n").filter((l) => /page|table|total/i.test(l)).slice(0, 2).join(" | ") || "ok"}${RESET}`);
});

step("Payroll periods do not overlap", () => {
  // Overlapping periods pay the same days twice. This blocks the gate: the fix
  // may be a business decision, but "Ship it" must never print while an
  // employee is being paid twice for the same hours.
  const r = spawnSync("node", ["scripts/audit/audit-payroll-period-overlap.mjs"], { cwd: ROOT, encoding: "utf8" });
  if (r.status !== 0) throw new Error(r.stderr || r.stdout);
  const out = r.stdout.toString();
  console.log(out.split("\n").filter((l) => l.trim()).map((l) => `  ${DIM}${l}${DIM}`).join("\n"));
  if (/VERDICT: BLOCKED/.test(out)) {
    throw new Error(
      "overlapping payroll periods: the same days are in two runs, so at least one employee is " +
        "paid twice. Reconcile the periods, then apply 20261007120000_payroll_period_no_overlap.sql.",
    );
  }
});

step("Payroll period/record status coherent", () => {
  // A finalized record inside an unapproved period makes unapproved pay payable.
  const r = spawnSync("node", ["scripts/audit/audit-payroll-status-coherence.mjs"], { cwd: ROOT, encoding: "utf8" });
  if (r.status !== 0) throw new Error(r.stderr || r.stdout);
  const out = r.stdout.toString();
  console.log(out.split("\n").filter((l) => l.trim()).map((l) => `  ${DIM}${l}${DIM}`).join("\n"));
  if (/INCOHERENT/.test(out)) {
    throw new Error(
      "payroll records are finalized inside an unapproved period, so unapproved pay is payable. " +
        "Reconcile the period and its records.",
    );
  }
});

step("TypeScript clean", () => {
  const r = spawnSync(TSC, ["--noEmit"], { cwd: ROOT, encoding: "utf8", env: childEnv(), shell: true });
  if (r.status !== 0) {
    const out = (r.stdout || "") + (r.stderr || "");
    throw new Error(`tsc exit ${r.status}: ${out || "no output"}`);
  }
});

step("Lint clean (eslint)", () => {
  const r = spawnSync(ESLINT, ["."], { cwd: ROOT, encoding: "utf8", env: childEnv(), shell: true });
  if (r.status !== 0) {
    const out = (r.stdout || "") + (r.stderr || "");
    throw new Error(`eslint exit ${r.status}:\n${out.slice(-1500) || "no output"}`);
  }
});

step("Vitest (full suite)", () => {
  // vitest v5 doesn't have a "basic" reporter; use the default.
  const r = spawnSync("cmd.exe", ["/c", "pnpm", "vitest", "run"], { cwd: ROOT, encoding: "utf8", env: childEnv() });
  if (r.status !== 0) {
    const out = (r.stdout || "") + (r.stderr || "");
    throw new Error(`vitest exit ${r.status}: ${out.slice(-500) || "no output"}`);
  }
  const summary = r.stdout.toString().split("\n").filter((l) => l.includes("Test Files") || l.includes("Tests")).join(" ");
  console.log(`  ${DIM}${summary}${RESET}`);
});

if (haveSupabase) {
  // WHY THIS STEP EXISTS
  // -------------------
  // `--skip-migration` was documented in this file's usage line and honoured in
  // exactly one place: the realtime step's error message. There was no migration
  // step for it to skip, so the flag's entire effect was to convert a red
  // realtime check into a skip that named a migration ("20261006140000 not pushed
  // yet") which `supabase migration list` proves IS applied. A flag that skips
  // nothing and excuses a failure with a cause that is not true is worse than no
  // flag at all.
  //
  // Now it skips an actual migration check, and only that.
  step("Migration structural preflight", () => {
    if (SKIP_MIGRATION) {
      return { skipped: true, reason: "--skip-migration — migrations not structurally preflighted" };
    }
    // Static: parses the files on disk, needs no credentials and no CLI. It
    // deliberately does NOT claim to know which migrations are unapplied —
    // `npx supabase migration list` is authoritative for that, because this gate
    // cannot see the database.
    const r = spawnSync("node", ["scripts/audit/preflight-pending-migrations.mjs"], {
      cwd: ROOT, encoding: "utf8", env: childEnv(),
    });
    if (r.status !== 0) {
      throw new Error((r.stdout || "") + (r.stderr || ""));
    }
    const count = /migrations on disk: (\d+)/.exec(r.stdout ?? "")?.[1];
    console.log(`  ${DIM}${count ?? "?"} migrations structurally preflighted${RESET}`);
  });

  step("Live data smoke (DB state)", () => {
    const r = spawnSync("cmd.exe", ["/c", "pnpm", "vitest", "run", "tests/live-data-smoke.test.ts"], { cwd: ROOT, encoding: "utf8", env: childEnv() });
    if (r.status !== 0) {
      const out = (r.stdout || "") + (r.stderr || "");
      throw new Error(`vitest smoke exit ${r.status}: ${out.slice(-500) || "no output"}`);
    }
  });

  step("Realtime event delivery (notifications)", () => {
    const r = spawnSync("node", ["scripts/audit/test-realtime-events.mjs"], { cwd: ROOT, encoding: "utf8", env: childEnv() });
    const out = r.stdout.toString() + r.stderr.toString();
    if (r.status === 0) {
      console.log(`  ${DIM}realtime delivery confirmed${RESET}`);
      return;
    }
    if (out.includes("no HR profile found")) {
      return { skipped: true, reason: "HR profile missing — run seed first" };
    }
    // Surface the probe's own diagnosis instead of a canned guess.
    //
    // This step used to collapse every non-zero exit into "realtime events broken
    // — DB needs migration `20261006140000`". That migration is applied, and the
    // real cause that time was a probe that inserted before its channel had
    // acknowledged SUBSCRIBED. A wrong cause on a red gate is worse than no
    // cause: it points the reader at the database instead of at the tool.
    const marker =
      out.includes("PROBE_RESULT=LATE") ? "LATE" :
      out.includes("PROBE_RESULT=DELIVERY_FAILED") ? "DELIVERY_FAILED" :
      out.includes("PROBE_RESULT=NOT_SUBSCRIBED") ? "NOT_SUBSCRIBED" :
      null;

    if (marker === "LATE") {
      // The event arrived, just over budget. Realtime works; delivery is slow.
      // This is its own outcome so a latency regression is never reported as an
      // outage, and never quietly folded into the pass count either.
      throw new Error(
        "realtime delivery is LATE — the event arrived, but outside the probe's budget.\n" +
          out.trim().slice(-800),
      );
    }

    // `--skip-migration` deliberately does NOT apply here any more.
    //
    // It used to, and the excuse it granted was false. It turned a failed
    // delivery probe into a skipped step citing "migration 20261006140000 not
    // pushed yet" — a migration `supabase migration list` shows as applied on the
    // remote. So a broken notification path could be waved through a release
    // gate with a cause that does not exist, on the authority of a flag whose
    // only other job was to skip a migration check there was none of.
    //
    // A skip here would not even be safe: `skippedSteps` keeps the run from
    // printing "Ship it", but it also removes the failure from the count a
    // reader scans first. Notifications that silently stop arriving is a
    // shipping defect, so it fails, with the probe's own words.
    throw new Error(
      out.trim().slice(-800) || `realtime probe exited ${r.status} with no output`,
    );
  });
} else {
  step("Live DB connection", () => {
    throw new Error("supabase env not configured");
  });
}

step("DB row counts (target)", () => {
  const r = spawnSync("node", ["scripts/audit/read-state.mjs"], { cwd: ROOT, encoding: "utf8", env: childEnv() });
  if (r.status !== 0) throw new Error(r.stderr || r.stdout);
  const lines = r.stdout.toString().split("\n");
  const tables = [
    "services", "industries", "faqs", "testimonials", "case_studies", "blog_posts",
    "departments", "teams", "holidays", "payroll_profiles", "payslips",
    "client_contacts", "billing_accounts", "invoice_items",
    "performance_cycles", "performance_kpis",
    "notifications", "audit_logs",
  ];
  for (const t of tables) {
    const line = lines.find((l) => l.startsWith(t + " "));
    if (!line) continue;
    const count = parseInt(line.replace(/\s+/g, " ").split(" ")[1], 10);
    if (!Number.isFinite(count)) continue;
    console.log(`  ${DIM}${t.padEnd(22)} ${count}${RESET}`);
  }
});

// Production build. NOTE: `next build` and `next dev` both write .next and will
// corrupt each other, so stop any dev server before running this gate.
step("Production build (next build)", () => {
  const r = spawnSync(NEXT, ["build"], {
    cwd: ROOT,
    encoding: "utf8",
    env: {
      ...childEnv(),
      NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
      AUTH_SECRET: process.env.AUTH_SECRET ?? "verify-all-build-placeholder-secret",
    },
    shell: true,
  });
  if (r.status !== 0) {
    const out = (r.stdout || "") + (r.stderr || "");
    throw new Error(`next build exit ${r.status}:\n${out.slice(-2000) || "no output"}`);
  }
  const built = (r.stdout || "").match(/Compiled successfully in [\d.]+s/);
  console.log(`  ${DIM}${built ? built[0] : "build completed"}${DIM}`);
});

// Summary
const failedSteps = failedStepList.length;

// The three counts must account for every step exactly once. This is not
// defensive arithmetic — it is the one place a reader checks the tool's work,
// so it is asserted rather than assumed.
const accounted = passedSteps + failedSteps + skippedSteps.length;
if (accounted !== totalSteps) {
  console.log(
    `${RED}${BOLD}INTERNAL COUNT ERROR: ${passedSteps} passed + ${failedSteps} failed + ${skippedSteps.length} skipped = ${accounted}, but ${totalSteps} steps ran.${RESET}\n`,
  );
  process.exit(2);
}

console.log(`\n${BOLD}${passedSteps}/${totalSteps} steps passed${RESET}`);
if (skippedSteps.length) {
  console.log(`${YELLOW}${skippedSteps.length} step(s) skipped — not verified${RESET}`);
}
if (failedSteps) {
  console.log(`${RED}Failing steps:${RESET}`);
  for (const s of failedStepList) console.log(`${RED}  - ${s.label}${RESET}`);
}
console.log("");

if (failedSteps === 0 && skippedSteps.length === 0) {
  console.log(`${GREEN}${BOLD}All checks passed. Ship it.${RESET}\n`);
  process.exit(0);
}
if (failedSteps > 0 && skippedSteps.length > 0) {
  console.log(
    `${RED}${BOLD}${failedSteps} step(s) failed, ${skippedSteps.length} skipped. Do not ship.${RESET}\n`,
  );
} else if (failedSteps > 0) {
  console.log(`${RED}${BOLD}${failedSteps} step(s) failed. See above. Do not ship.${RESET}\n`);
} else {
  console.log(
    `${YELLOW}${BOLD}No failures, but ${skippedSteps.length} check(s) were not verified.${RESET}\n`,
  );
}
process.exit(1);