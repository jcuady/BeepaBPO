import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A field declared on `ActionState` but returned by no action is an orphan, and an
 * orphan field is not inert.
 *
 * `verifyToken` sat on the type while nothing in the repository ever set it. Two
 * components read it — a "Dev verification link" on the signup confirmation and a
 * "Dev reset link" on the forgot-password confirmation — so both blocks were
 * unreachable, and neither was gated to a development environment. They were one
 * assignment away from shipping in production, on a surface whose stated rule is
 * never to advertise something that is not built.
 *
 * The reset one was worse than unreachable. It pointed at
 * `/reset-password?token=…`, and `/reset-password` gates on the SESSION and renders
 * "Invalid link" for exactly that URL. So had the field been populated, the app
 * would have handed a person a link whose entire message is that the link is
 * invalid.
 *
 * This file is the general guard, so the next orphan fails a test instead of
 * shipping.
 */

const ROOT = process.cwd();
const ACTIONS = join(ROOT, "lib", "auth", "actions.ts");

/**
 * Strip comments before any negative assertion.
 *
 * This is the ordinary way a careful author records a rule, so a raw text search
 * for the forbidden identifier is guaranteed to hit the very comment explaining
 * why it is forbidden. The `[^:]` guard keeps `https://` inside a string from
 * being read as the start of a line comment.
 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const read = (...parts: string[]) => stripComments(readFileSync(join(ROOT, ...parts), "utf8"));

describe("ActionState declares no field that no action returns", () => {
  const src = stripComments(readFileSync(ACTIONS, "utf8"));
  const block = /export type ActionState = \{([\s\S]*?)\n\};/.exec(src);

  it("finds the type block it is guarding", () => {
    // A parser that matched nothing would make the test below vacuously true.
    expect(block, "ActionState type block was not found").not.toBeNull();
    expect(block![1]).toMatch(/\bok\b/);
  });

  it("every declared field is produced by an action", () => {
    const fields = [...block![1].matchAll(/^\s{2}(\w+)\??:/gm)].map((m) => m[1]);
    expect(fields.length, "no fields parsed from ActionState").toBeGreaterThan(1);

    // Everything outside the type block is where actions live and return.
    const bodies = src.replace(block![0], "");
    const orphans = fields.filter((f) => !new RegExp(`\\b${f}\\b`).test(bodies));

    expect(
      orphans,
      `declared on ActionState and returned by nothing: ${orphans.join(", ")}. ` +
        "A component reading one of these renders a branch that can never execute.",
    ).toEqual([]);
  });
});

describe("the verifyToken orphan is gone from code", () => {
  it.each([
    ["lib", "auth", "actions.ts"],
    ["components", "auth", "signup-form.tsx"],
    ["components", "auth", "forgot-password-form.tsx"],
  ])("%s has no reference to it", (...parts) => {
    // Comments stripped: the comment explaining the removal names it deliberately.
    expect(read(...parts)).not.toContain("verifyToken");
  });
});

describe("no auth surface links to a token URL the app treats as invalid", () => {
  it.each([
    ["components", "auth", "forgot-password-form.tsx"],
    ["components", "auth", "signup-form.tsx"],
    ["components", "auth", "login-form.tsx"],
    ["components", "auth", "reset-password-form.tsx"],
    ["components", "auth", "employee-login-form.tsx"],
  ])("%s does not offer /reset-password?token=", (...parts) => {
    // `/reset-password` reads `token` only to hand it to a form that gates on the
    // session and never reads it, so any link carrying it renders "Invalid link".
    // `/verify-email?token=` IS real — that page calls `verifyEmailAction(token)` —
    // which is why the guard is scoped to the one that is not.
    const src = read(...parts);
    expect(src, "links to a URL the app answers with Invalid link").not.toMatch(
      /\/reset-password\?token=/,
    );
  });
});