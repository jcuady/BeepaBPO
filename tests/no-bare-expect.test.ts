import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * No test file may contain an `expect(...)` with no chained matcher.
 *
 * WHAT THIS IS ABOUT
 * ------------------
 * In Vitest, as in Jest, `expect(value)` on its own records nothing and passes.
 * It is not a weak assertion; it is **no assertion at all**. It reads exactly
 * like a real one, which is the whole danger: it stays green while the condition
 * it was written to check is false.
 *
 * This was not hypothetical. One was written in this repo the same afternoon
 * these tests were added:
 *
 *     expect(
 *       /blockedPaths:[^,\n]*.../.test(code),
 *       `${f} maps blockedPaths down to a bare name`,
 *     );                                  // <-- no matcher: asserted nothing
 *
 * It passed against the exact defect it was written to catch. It was found only
 * because the guard was mutation-proved — the mutation "goes red" was checked
 * and the guard stayed green — and that failure prompted this file. The fix was
 * `expect(...).toBe(false)`, which fails correctly.
 *
 * So the rule this repo has written into §2.12b and the census work, *a check
 * that cannot fail is not a check*, turns out to have been violated by a check
 * in the repo's own guard. That is the reason for this file rather than a
 * lint nit.
 *
 * WHY THE TYPESCRIPT AST, AND NOT A REGEX
 * ---------------------------------------
 * The first attempt scanned for `expect(` and balanced parentheses. It is wrong,
 * and wrong in the dangerous direction: `/writeEvidence\(/g` contains an
 * unbalanced-looking paren, so the depth never returned to zero, the scan
 * **broke out of that file entirely**, and it reported three "findings" that were
 * artifacts of the scanner stopping early. A hand-rolled scanner that quietly
 * covers part of a file is the same defect class as the census's `el.value`
 * fallback — it produces confident output about less than it appears to.
 *
 * `typescript` is already a dependency, so the parse is free and exact.
 *
 * `expect.soft(...)` and `expect.poll(...)` are factory calls, not assertions, and
 * are deliberately not counted.
 */

const ROOT = process.cwd();

function testFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) {
      if (entry === "node_modules" || entry === ".next" || entry === ".git") continue;
      testFiles(p, out);
    } else if (/\.(test|spec)\.[cm]?[jt]sx?$/.test(entry)) out.push(p);
  }
  return out;
}

/** Matcher-less `expect(...)` calls, with a 1-based line number. */
function bareExpects(file: string): { line: number; text: string }[] {
  const src = readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true);
  const hits: { line: number; text: string }[] = [];

  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "expect") {
      const parent = node.parent;
      const chained = ts.isPropertyAccessExpression(parent) || ts.isElementAccessExpression(parent);
      if (!chained) {
        const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
        hits.push({ line: line + 1, text: src.split("\n")[line].trim().slice(0, 100) });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return hits;
}

describe("no matcher-less expect() anywhere in the suite", () => {
  const files = existsSync(join(ROOT, "tests"))
    ? testFiles(join(ROOT, "tests")).sort()
    : [];

  it("the scan actually covers the suite", () => {
    // Without this, a renamed `tests/` directory makes every assertion below
    // vacuously true — a green suite proving nothing, which is the exact failure
    // mode this file exists to prevent.
    expect(files.length).toBeGreaterThan(20);
    expect(files.some((f) => f.endsWith("workflow-evidence-ownership.test.ts"))).toBe(true);
  });

  it("the AST scan finds the known violation shape", () => {
    // Control. `expect(x)` with no matcher is a hit; `expect(x).toBe(y)` and
    // `expect(x, msg).toBe(y)` are not. If this fails, the scan has stopped
    // working and the rule below is reporting all-clear for the wrong reason.
    const probe = join(ROOT, "tests", "__bare-expect-probe.test.ts");
    const body = [
      "const x = 1;",
      "expect(x);",
      "expect(x).toBe(1);",
      "expect(x, 'why').toBe(1);",
      "expect.soft(x).toBe(1);",
    ].join("\n");
    const sf = ts.createSourceFile("p.ts", body, ts.ScriptTarget.Latest, true);
    let hits = 0;
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "expect") {
        const p = node.parent;
        if (!ts.isPropertyAccessExpression(p) && !ts.isElementAccessExpression(p)) hits += 1;
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
    // Exactly one: the bare `expect(x)`. The two-argument form is still an
    // assertion, and `expect.soft` is a factory.
    expect(hits).toBe(1);
    expect(existsSync(probe)).toBe(false);
  });

  const offenders = files
    .flatMap((f) => bareExpects(f).map((h) => ({ file: relative(ROOT, f), ...h })))
    .sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);

  it("no test file contains a bare expect()", () => {
    expect(
      offenders,
      offenders.length
        ? offenders.map((o) => `${o.file}:${o.line}  ${o.text}`).join("\n")
        : "",
    ).toEqual([]);
  });
});