import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A browser-driven audit must not DECIDE a fact by sampling the app at an
 * arbitrary moment.
 *
 * The incident this guards is specific and cost a day. Four runs of
 * `qa-exercise-uncovered-roles.mjs` failed on four different accounts --
 * finance, client_admin, client_viewer, then all four at once -- and every one
 * of those accounts worked. The cause was a fixed 2500ms sleep after the login
 * submit, followed by `page.url()`: a duration is not an outcome. It read long
 * enough on a fast machine and short enough on a slow one, so the failure set
 * moved every run and never meant the same thing twice.
 *
 * Two measurements had to be disproved to get here, and both are now recorded
 * in REMAINING_WORK 2.12: the provider answered HTTP 200 for all six demo
 * accounts (`scripts/audit/test-auth-direct.mjs`), and the server sat at
 * 142 MB working set with `audit-server-fresh` reporting `fresh`. Neither face
 * of "the suite is under load" was active. The instrument was the defect.
 *
 * These assertions run on comments stripped. The file's own header explains
 * that it used to sleep 2500ms and why, so a raw text search for that number is
 * guaranteed to hit the comment documenting the fix -- the self-reference trap
 * already recorded in SYSTEM_AUDIT 20.5. The last test in this file is the
 * control that proves the stripping is load-bearing.
 */
const FILE = join(process.cwd(), "scripts/audit/qa-exercise-uncovered-roles.mjs");
const raw = readFileSync(FILE, "utf8");

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split(/\r?\n/)
    .map((line) => {
      if (line.trim().startsWith("//")) return "";
      const idx = line.indexOf("//");
      return idx === -1 || line.slice(0, idx).includes(":") ? line : line.slice(0, idx);
    })
    .join("\n");
}

const code = stripComments(raw);

/**
 * The body of a declaration, up to the first closing brace at column 0.
 *
 * Both forms have to match: `async function foo` and `const foo = () => {}`
 * both appear in this file, and a helper that only understood one of them
 * reports "not found" for a function that is plainly there -- which is what
 * the first run of this test did.
 */
function functionBody(source: string, name: string): string {
  const start = [`function ${name}`, `const ${name} =`, `const ${name}=`].reduce((best, decl) => {
    const i = source.indexOf(decl);
    return i === -1 ? best : Math.min(best, i);
  }, Number.POSITIVE_INFINITY);
  expect(start, `${name} not found`).not.toBe(Number.POSITIVE_INFINITY);
  const end = source.indexOf("\n}", start);
  return source.slice(start, end === -1 ? source.length : end);
}

describe("uncovered-roles exercise — the instrument, not the product, decides a failure", () => {
  it("has the functions these guards are about (guards against a vacuous pass)", () => {
    for (const fn of ["settleUrl", "readAuthAlert", "signInAs", "sampleAt"]) {
      expect(code, `${fn} is missing`).toMatch(new RegExp(`(function|const)\\s+${fn}\\b`));
    }
  });

  it("waits for a sign-in OUTCOME instead of sleeping a fixed duration", () => {
    const body = functionBody(code, "signInAs");
    expect(body).toContain("waitForFunction");
    // The predicate has to name both ways a sign-in can finish: a session
    // existing, or the app publishing why it does not.
    expect(body).toMatch(/location\.pathname/);
    expect(body).toContain('role="alert"');
  });

  it("has no duration standing in for an outcome", () => {
    const body = functionBody(code, "signInAs");
    // Not "no sleep at all". `fillHeld` settles 250ms and reads the field
    // back, which is a VERIFICATION step -- it proves hydration finished, so it
    // is a guarantee rather than another hope. What must not exist is a sleep
    // long enough that whether it elapses depends on the machine's mood.
    const sleeps = [...body.matchAll(/waitForTimeout\(\s*(\d+)\s*\)/g)]
      .map((m) => Number(m[1]))
      .filter((ms) => ms >= 1000);
    expect(sleeps, "signInAs still waits a second or more instead of waiting for the outcome").toEqual([]);
  });

  it("submits only a form that is holding its values", () => {
    const body = functionBody(code, "signInAs");
    // Hydration resets what `fill` wrote, so a click in that window submits an
    // empty form. The server rejects it at schema validation, `signInWithPassword`
    // is never called, and every probe outside the browser stays green while
    // the browser refuses -- measured, not inferred.
    expect(body).toContain("inputValue");
    expect(body).toContain("held");
    // And the check has to be able to name THAT as the cause, or the next
    // occurrence is unattributable again.
    expect(functionBody(code, "checkSignIn")).toMatch(/s\.held/);
  });

  it("settles on two consecutive unchanged reads, not one", () => {
    const body = functionBody(code, "settleUrl");
    // One unchanged read breaks out while the navigation has not started yet,
    // which is the state a page is in immediately after a submit is clicked.
    expect(body).toContain("stable >= 2");
  });

  it("does not decide 'signed in' from the URL", () => {
    const check = functionBody(code, "checkSignIn");
    expect(check).not.toMatch(/url\(\)\.includes/);
    // The claim is the session, and the session is the form no longer being
    // there. `landingPathFor` sends a client to /app/client on a SECOND hop;
    // asserting it inside signInAs is what raced.
    expect(check).toContain("stillOnForm");
    expect(code).not.toContain('check(`${role.label} signs in`, page.url()');
  });

  it("reads the URL beside the DOM in sampleAt, after settling", () => {
    const body = functionBody(code, "sampleAt");
    const settleAt = body.indexOf("settleUrl");
    const urlAt = body.indexOf("return { url");
    expect(settleAt, "sampleAt never settles").toBeGreaterThan(-1);
    expect(urlAt, "sampleAt returns no url").toBeGreaterThan(-1);
    // Order is the assertion. Capturing the url before the settle is how a
    // client sitting on /app/client was reported as sitting on /app.
    expect(settleAt).toBeLessThan(urlAt);
  });

  it("tells a thrown alert read apart from an alert that is simply absent", () => {
    const body = functionBody(code, "readAuthAlert");
    expect(body).toContain("read: false");
    expect(body).toContain("read: true");
    // `.catch(() => null)` made "the evaluate threw" and "there is no alert"
    // the same value, which is the silent no-op this repo has been bitten by
    // before: every caller's refusal gets absorbed by an `if`.
    expect(body).not.toContain(".catch(() => null)");
  });

  it("asserts a page is the right page before asserting what is on it", () => {
    // `sales sees a populated lead list` passed while the browser was on the
    // public marketing page, because that page contains none of the negative
    // phrases the check looked for. A check that cannot fail is not a check.
    expect(code).toMatch(/leads\.includes\("\/app\/crm\/leads"\)/);
  });

  it("writes its own evidence, so a stale red record cannot outlive a fix", () => {
    // This file sat at `verdict: FAIL`, 16/17, describing a defect in its own
    // instrument while passing 19/19 twice in a row -- because nothing but the
    // orchestrator wrote it, and the orchestrator could not finish under load.
    //
    // These assertions changed shape when the writer moved into
    // `scripts/audit/lib/evidence.mjs`: the file no longer spells the evidence
    // path or an `assertions:` field itself, so matching on those would have
    // tested the old shape rather than the property. What is asserted is the
    // property -- this exercise writes its OWN evidence, for ITS OWN id, with
    // the per-account detail and a measurement rather than a bare verdict.
    // `tests/workflow-evidence-integrity.test.ts` covers what the writer emits.
    expect(code).toMatch(/writeEvidence\(\{/);
    expect(code).toMatch(/id:\s*"uncovered-roles"/);
    // The per-account destinations, so "the failing account changed every run"
    // is checkable from the evidence rather than taken on trust.
    expect(code).toMatch(/signIns/);
    // A measurement, not a bare verdict: the assertions themselves are handed over.
    expect(code).toMatch(/checks:\s*results/);
  });

  it("proves stripComments is load-bearing rather than silently passing", () => {
    // The header documents the 2500ms sleep this suite removed. If someone
    // drops `stripComments`, the guards above start failing for the wrong
    // reason; if they instead assert on `raw`, they start passing for the
    // wrong reason. Both halves are pinned.
    expect(raw).toContain("2500ms");
    expect(code).not.toContain("2500ms");
  });
});