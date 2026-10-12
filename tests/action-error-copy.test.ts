import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { writeFailed } from "@/lib/actions/error-copy";

/**
 * `writeFailed` looks like a no-op, and the test says exactly that on purpose.
 *
 * The whole point is that the driver's message is never shown. If a future edit
 * "helpfully" threaded the error through and classified it, the signature would
 * change and these assertions would need rewriting — which is the moment to ask
 * whether 68 new copy decisions are being made on purpose.
 */
describe("writeFailed", () => {
  it("returns the copy the caller supplied", () => {
    expect(writeFailed("Unable to create lead.")).toBe("Unable to create lead.");
  });

  it("cannot be made to return a database message", () => {
    // The function takes a string and returns a string. There is no channel by
    // which a PostgREST error could reach the output.
    expect(writeFailed.length).toBe(1);
    expect(writeFailed("")).toBe("");
  });
});

/**
 * The behavioural guard: no `"use server"` module may hand a raw provider message
 * to a caller again.
 *
 * This scans every action module rather than asserting on one file, because the
 * pattern was spread across eighteen of them and a per-file test would only pin
 * the file somebody remembered to write one for. A later module that reintroduces
 * `error: error?.message ?? …` is rejected by this test, not by whoever reads
 * the report next quarter.
 */
describe("no server action returns a raw provider message", () => {
  function walk(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full, out);
      else if (/\.tsx?$/.test(entry)) out.push(full);
    }
    return out;
  }

  const actionFiles = walk(join(process.cwd(), "lib")).filter((f) =>
    readFileSync(f, "utf8").includes('"use server"'),
  );

  it("found the action modules to scan", () => {
    // If this ever reads zero, the scan is broken and the next test proves
    // nothing — a guard that silently checks nothing is worse than no guard.
    expect(actionFiles.length).toBeGreaterThan(10);
  });

  it("finds no `error: <expr>.message ?? <copy>` anywhere in lib/", () => {
    const offenders: string[] = [];
    for (const file of walk(join(process.cwd(), "lib"))) {
      const src = readFileSync(file, "utf8");
      // `error: error?.message ?? "…"` and `error: roleError.message ?? "…"`.
      // Deliberately narrow: it matches the shape, not every mention of
      // `.message`, so legitimate reads elsewhere in a module are untouched.
      const re = /error:\s*\w+(?:\?\.)?\.message\s*\?\?\s*(?:"[^"]*"|[A-Z_][A-Z0-9_]*)/g;
      const hits = src.match(re);
      if (hits) {
        offenders.push(
          `${file.slice(process.cwd().length + 1)}: ${hits.length} site(s) — ${hits[0]}`,
        );
      }
    }
    expect(offenders).toEqual([]);
  });

  it("finds no action returning a bare `error: <expr>.message`", () => {
    const offenders: string[] = [];
    for (const file of walk(join(process.cwd(), "lib"))) {
      const src = readFileSync(file, "utf8");
      if (!src.includes('"use server"')) continue;
      const hits = src.match(/error:\s*\w+(?:\?\.)?\.message\s*[,}]/g);
      if (hits) {
        offenders.push(`${file.slice(process.cwd().length + 1)}: ${hits.length}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("keeps the auth mappers, which are a different and correct mechanism", () => {
    // error-messages.ts is not a "use server" module and deliberately holds
    // hand-written copy per cause. It must not be swept up by the fix.
    const authCopy = readFileSync(
      join(process.cwd(), "lib/auth/error-messages.ts"),
      "utf8",
    );
    expect(authCopy).toContain("authFailureKind");
    expect(authCopy).not.toContain("writeFailed");
  });
});