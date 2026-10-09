import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * `page.waitForURL()` defaults to `waitUntil: "load"`.
 *
 * The app shell opens realtime subscriptions, which keep the `load` event
 * pending indefinitely. A `waitForURL` left on the default therefore times out
 * even though the navigation it was waiting for already succeeded — the login
 * worked, the test reported a failure anyway.
 *
 * This is not theoretical: three of the authenticated viewport tests failed for
 * exactly this reason while their sibling test passed, which reads like a
 * product bug and is not one. Every wait in this suite now commits on
 * `domcontentloaded`, which is all any of them actually needs.
 */
const E2E_DIR = join(process.cwd(), "e2e");

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split(/\r?\n/)
    .map((line) => {
      if (line.trim().startsWith("//")) return "";
      const idx = line.indexOf("//");
      return idx === -1 || line.slice(0, idx).includes(":")
        ? line
        : line.slice(0, idx);
    })
    .join("\n");
}

const specFiles = readdirSync(E2E_DIR).filter((f) => f.endsWith(".ts"));

describe("e2e specs wait on domcontentloaded, never the default 'load'", () => {
  it("has spec files to scan (guards against a vacuous pass)", () => {
    expect(specFiles.length).toBeGreaterThan(0);
  });

  for (const file of specFiles) {
    it(`${file} has no waitForURL that can hang on the load event`, () => {
      const source = stripComments(readFileSync(join(E2E_DIR, file), "utf8"));
      const calls = [
        ...source.matchAll(/waitForURL\s*\(([\s\S]*?)\);/g),
      ].map((m) => m[1]);

      const offenders = calls.filter((args) => !/waitUntil\s*:/.test(args));
      expect(
        offenders,
        `${file}: waitForURL must set waitUntil — the app shell keeps 'load' ` +
          `pending via realtime subscriptions. Offending call(s): ${offenders.length}`,
      ).toEqual([]);
    });
  }
});