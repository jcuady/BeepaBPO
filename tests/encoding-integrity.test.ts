import { readFileSync, readdirSync } from "node:fs";
import { extname, join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * This repo has been damaged by UTF-8 mojibake three separate times: PowerShell
 * round-tripping files through `Get-Content -Raw` and writing them back decoded
 * as the ANSI code page turned every em dash in `e2e/`, in
 * `refresh-demo-timeline.mjs`, and in a migration into `â€”`.
 *
 * Two things make that failure expensive:
 *
 * 1. **It is silent.** The build passes, the types are correct, the tests are
 *    green, and a customer's contact form reads "No spam â€” just a clear next
 *    step". Nothing fails until a human reads the rendered page.
 * 2. **A console lies about it.** `Get-Content` prints mojibake for a file that
 *    is perfectly fine, and prints a clean em dash for a file that is corrupted,
 *    depending on the code page. Reading the file to decide whether to "fix" it
 *    produced exactly the wrong conclusion in both directions. The check has to
 *    be on bytes, not on what the terminal shows.
 *
 * So: assert zero mojibake across every tracked text file, and assert a healthy
 * count of *real* Unicode punctuation so the scanner cannot pass by failing to
 * detect anything at all.
 */
const ROOT = process.cwd();
const EXTS = new Set([".sql", ".md", ".ts", ".tsx", ".mjs", ".cjs", ".js", ".json"]);
const SKIP = new Set(["node_modules", ".git", ".next", ".auth", "e2e-evidence", ".turbo"]);
// This file necessarily contains the mojibake signatures as string literals, so it
// would otherwise report itself as the offender.
const SELF = "tests/encoding-integrity.test.ts";
const SCAN_ROOTS = [
  "supabase",
  "docs",
  "lib",
  "app",
  "components",
  "scripts",
  "tests",
  "types",
  "e2e",
];

/** Byte sequences that only appear when UTF-8 is mis-decoded as cp1252. */
const MOJIBAKE: Array<[string, string]> = [
  ["em dash", "â€”"],
  ["right single quote", "â€™"],
  ["left double quote", "â€œ"],
  ["right double quote", "â€\x9d"],
  ["ellipsis", "â€¦"],
  ["bullet", "â€¢"],
  ["non-breaking space", "Â "],
  ["arrow", "â†’"],
];

const LEGITIMATE = /[\u2014\u2013\u2018\u2019\u201c\u201d\u2026\u2022\u2192]/g;

function collect(dir: string, out: string[] = []): string[] {
  let entries;
  try {
    entries = readdirSync(join(ROOT, dir), { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (SKIP.has(e.name)) continue;
    const rel = `${dir}/${e.name}`;
    if (rel === SELF) continue;
    if (e.isDirectory()) collect(rel, out);
    else if (EXTS.has(extname(e.name))) out.push(rel);
  }
  return out;
}

const files = SCAN_ROOTS.flatMap((r) => collect(r));

describe("encoding integrity", () => {
  // These four tests read every tracked text file TWICE (once for mojibake, once for
  // the legitimate-punctuation control) and the file list is built at module load, so
  // the first test pays for the walk as well. That is ~640 files of synchronous I/O
  // on Windows/OneDrive, which blows past vitest's 5s default whenever the suite runs
  // alongside `next build` or a live dev server.
  //
  // The timeout is raised rather than the work reduced: no assertion here is timing
  // related, so a longer budget cannot make any of them pass that should fail. The
  // failure it replaces was reported as `contains no UTF-8 mojibake` — vitest names
  // the test that was running when the clock expired, and the real cause (a timeout)
  // only appears in the full failure message. That mislabel is worth not repeating.
  const FILE_SCAN_TIMEOUT = 120_000;

  it("finds source files to scan", () => {
    expect(files.length, "the scanner walked no files, so every check below would pass vacuously").toBeGreaterThan(100);
  }, FILE_SCAN_TIMEOUT);

  it("contains no UTF-8 mojibake", () => {
    const offenders: string[] = [];
    for (const f of files) {
      const text = readFileSync(join(ROOT, f), "utf8");
      const lines = text.split(/\r?\n/);
      lines.forEach((line, i) => {
        for (const [name, seq] of MOJIBAKE) {
          if (line.includes(seq)) offenders.push(`${f}:${i + 1} ${name}`);
        }
      });
    }
    expect(
      offenders,
      `mojibake found; these bytes are UTF-8 that was decoded as cp1252:\n${offenders.join("\n")}`,
    ).toEqual([]);
  }, FILE_SCAN_TIMEOUT);

  it("still contains real Unicode punctuation, so the scan above is not vacuous", () => {
    // The control for the test above. A repo stripped of em dashes would satisfy
    // "no mojibake" perfectly while being the actual bug.
    let count = 0;
    for (const f of files) count += (readFileSync(join(ROOT, f), "utf8").match(LEGITIMATE) ?? []).length;
    expect(count, "no real em dashes or curly quotes anywhere; the scanner may be inert").toBeGreaterThan(100);
  }, FILE_SCAN_TIMEOUT);

  it("keeps migrations free of mojibake, since it is copied straight into the database", () => {
    // A corrupted migration writes corrupted customer-facing copy into the CMS
    // permanently, and the fix has to be a new migration rather than an edit.
    const migrations = files.filter((f) => f.startsWith("supabase/migrations/"));
    expect(migrations.length).toBeGreaterThan(10);
    const offenders: string[] = [];
    for (const f of migrations) {
      const text = readFileSync(join(ROOT, f), "utf8");
      for (const [name, seq] of MOJIBAKE) if (text.includes(seq)) offenders.push(`${f} ${name}`);
    }
    expect(offenders).toEqual([]);
  }, FILE_SCAN_TIMEOUT);
});