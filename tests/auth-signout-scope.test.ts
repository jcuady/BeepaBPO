import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Every sign-out in the auth layer must state its scope explicitly.
 *
 * This is a real defect that shipped, not a style rule. supabase-js v2 defines
 * `signOut(options = { scope: 'global' })` — the default is GLOBAL. So a bare
 * `supabase.auth.signOut()` revokes every refresh token the user has, on every
 * device.
 *
 * `employeeLoginAction` did exactly that when a non-internal user typed their
 * credentials into the employee portal: the rejection path called a bare
 * `signOut()`, which logged that client out of their *working* client-portal
 * session on their phone. The e2e suite found it as 11 unrelated-looking
 * failures ("redirected away from a client", "did not render a denial for a
 * client") because the persisted `.auth/clientadmin.json` session had been
 * revoked from under it by an unrelated test in another spec.
 *
 * The project already had the right shape — `logoutAllAction` passes
 * `{ scope: "global" }` explicitly — which is what makes the bare calls an
 * oversight rather than a decision.
 */

const actions = readFileSync(
  join(process.cwd(), "lib/auth/actions.ts"),
  "utf8",
);

/**
 * Strip comments before scanning.
 *
 * Without this the test accuses the code of calling `signOut()` twice because
 * the explanatory comments written *about* that bug contain the string
 * `signOut()`. A scanner that reads prose as code reports findings that do not
 * exist, and a gate that cries wolf gets ignored. Comments are not call sites.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split(/\r?\n/)
    .map((line) => {
      // Drop full-line comments outright.
      if (line.trim().startsWith("//")) return "";
      // Drop a trailing comment. The `://` guard keeps URL literals such as
      // "https://..." intact, since those slashes are not a comment marker.
      const idx = line.indexOf("//");
      return idx === -1 || line.slice(0, idx).includes(":") ? line : line.slice(0, idx);
    })
    .join("\n");
}

const code = stripComments(actions);

/** Every real `auth.signOut(...)` call site, with its full argument list. */
function signOutCalls(source: string): string[] {
  return [...source.matchAll(/\.auth\.signOut\s*\(([\s\S]*?)\)/g)].map((m) =>
    m[1].trim(),
  );
}

/**
 * Every source file that could plausibly call signOut.
 *
 * The first version of this test read only `lib/auth/actions.ts`, which is why
 * `scripts/sales-marketing-modules-smoke.cjs` was missed: it signed in as a
 * real demo user and then called a bare `signOut()`, so running that smoke test
 * revoked that person's session on every device — including any e2e session
 * sharing the demo accounts. A guard that only watches the file where the bug
 * was found guards nothing. `tests/` and `docs/` are excluded: this file quotes
 * the offending call in prose, and the changelog documents it.
 */
function sourceFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((f) => /\.(ts|mts|mjs|cjs|js|tsx)$/.test(f))
    .map((f) => join(dir, f));
}

const scannable = [...sourceFiles("lib"), ...sourceFiles("scripts")];

describe("auth sign-out scope", () => {
  const calls = signOutCalls(code);

  it("finds sign-out call sites to check (guards against a vacuous pass)", () => {
    expect(calls.length).toBeGreaterThan(0);
  });

  it("scans more than the file the bug was found in", () => {
    expect(scannable.length).toBeGreaterThan(5);
  });

  it("never calls a bare signOut(), whose default scope is global", () => {
    const bare = calls.filter((args) => args === "");
    expect(
      bare,
      `bare signOut() revokes every session on every device; found ${bare.length}`,
    ).toEqual([]);
  });

  it("no bare signOut anywhere in lib/ or scripts/", () => {
    const offenders: string[] = [];
    for (const file of scannable) {
      for (const args of signOutCalls(stripComments(readFileSync(file, "utf8")))) {
        if (!/scope\s*:\s*"(local|global|others)"/.test(args)) {
          offenders.push(`${file}: signOut(${args})`);
        }
      }
    }
    expect(
      offenders,
      `every signOut must state a scope; global is the default when omitted:\n  ${offenders.join("\n  ")}`,
    ).toEqual([]);
  });

  it("passes an explicit scope at every sign-out site", () => {
    for (const args of calls) {
      expect(args, `signOut(${args}) does not state a scope`).toMatch(
        /scope\s*:\s*"(local|global|others)"/,
      );
    }
  });

  it("rejects a wrong-portal login locally, not across the user's devices", () => {
    // The employee portal must not evict a client's legitimate session when it
    // refuses their credentials. Only the session this attempt just created is
    // discarded.
    const employeeAction = code.slice(
      code.indexOf("export async function employeeLoginAction"),
      code.indexOf("async function assignApplicantMembership"),
    );
    expect(employeeAction).toContain('signOut({ scope: "local" })');
    expect(employeeAction).not.toMatch(/signOut\s*\(\s*\)/);
  });

  it("keeps an explicit global sign-out available for 'log out everywhere'", () => {
    // Negative control: without this, the fix above could be 'passed' by simply
    // making every call local, silently deleting the ability to revoke all
    // sessions. The distinction is deliberate and must survive.
    expect(actions).toContain('signOut({ scope: "global" })');
    expect(actions).toContain("logoutAllAction");
  });

  it("does not globally sign out when the user clicks Sign out", () => {
    // `logoutAction` is what the app header actually calls. Global scope here
    // means signing out on a work laptop also signs the user out of their
    // phone — `logoutAllAction` exists precisely to be that the deliberate
    // choice, not the default.
    const logoutAction = code.slice(
      code.indexOf("export async function logoutAction"),
      code.indexOf("export async function logoutAllAction"),
    );
    expect(logoutAction).toContain('signOut({ scope: "local" })');
  });
});