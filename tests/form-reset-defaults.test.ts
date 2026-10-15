import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Form-reset-defaults contract.
 *
 * The rule under test is not "every field has a default". It is narrower and
 * load-bearing, and it came from a measured bug:
 *
 *   1. `reset()` writes into an UNCONTROLLED input only when it has a value to
 *      write. A registered field with no default survives a reset the user
 *      believes cleared it.
 *   2. `""` is only a SAFE default when the control can actually display `""`.
 *      A `<select>` with no empty option shows a real value while the form model
 *      holds `""`, so validation disagrees with what is on screen.
 *
 * Rule 2 is not hypothetical. `create-ticket-form` had a category select with no
 * placeholder and its schema requires `min(1)`; the form submitted "Select a
 * category." on a select that visibly had one chosen, and the tickets workflow
 * exercise fell from 33 assertions to a FAIL.
 *
 * Every case below is planted, because a check that cannot be proved to fire is
 * indistinguishable from one that always passes.
 *
 * The fixture MUST contain a `form.reset(...)` call: the audit only considers
 * forms that can exhibit the bug, and the first draft of this file omitted the
 * reset — so all five cases "passed" for the wrong reason, which is the exact
 * failure this file exists to prevent.
 */

const ROOT = process.cwd();
const SCRIPT = join(ROOT, "scripts", "audit", "audit-form-reset-defaults.mjs");

function run(files: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), "form-reset-"));
  try {
    for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body, "utf8");
    const r = spawnSync(process.execPath, [SCRIPT, `--dir=${dir}`], { cwd: ROOT, encoding: "utf8" });
    return { status: r.status, out: (r.stdout ?? "") + (r.stderr ?? "") };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** `defaultsLiteral` is a JS object literal; `body` is the JSX. */
const form = (defaultsLiteral: string, body: string) => `"use client";
import { useForm } from "react-hook-form";
const defaults = ${defaultsLiteral};
export function F() {
  const form = useForm({ defaultValues: defaults });
  function onSubmit() {
    form.reset(defaults);
  }
  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
${body}
    </form>
  );
}
`;

const selectWithPlaceholder = `<select id="category" {...form.register("category")}>
      <option value="">Select a category…</option>
      <option value="general">general</option>
    </select>`;

const selectWithoutPlaceholder = `<select id="category" {...form.register("category")}>
      <option value="general">general</option>
    </select>`;

describe("form reset defaults — negative controls", () => {
  it("passes a form that defaults every field it registers", () => {
    const r = run({
      "ok.tsx": form('{ category: "", subject: "" }', `${selectWithPlaceholder}
      <input id="subject" {...form.register("subject")} />`),
    });
    expect(r.status).toBe(0);
    expect(r.out).toContain("VERDICT");
  });

  it("FAILS a registered field with no default", () => {
    // The original bug: `reason` is registered but absent from `defaults`, so it
    // survives reset() with whatever the user typed.
    const r = run({
      "bad.tsx": form('{ note: "" }', `<input id="reason" {...form.register("reason")} />`),
    });
    expect(r.status).toBe(1);
    expect(r.out).toContain("SURVIVES RESET");
    expect(r.out).toContain("reason");
  });
});

describe("form reset defaults — a default must be a state the control can display", () => {
  it("FAILS a field defaulted to \"\" whose select has no empty option", () => {
    // create-ticket-form before the fix, reduced to its essence. The select
    // displays "general" while the model holds "", and the schema requires
    // min(1) — so the form shows an error on a control that looks correctly
    // filled in and never submits.
    const r = run({
      "select.tsx": form('{ category: "" }', selectWithoutPlaceholder),
    });
    expect(r.status).toBe(1);
    expect(r.out).toContain("cannot display");
    expect(r.out).toContain("category");
  });

  it("passes the same select once it has a placeholder", () => {
    // The fix, in isolation: adding `<option value="">` makes "" a real state, so
    // the default and the control finally agree.
    const r = run({
      "fixed.tsx": form('{ category: "" }', selectWithPlaceholder),
    });
    expect(r.status).toBe(0);
  });

  it("does not flag a text input defaulted to \"\"", () => {
    // The rule is about selects. A text input CAN display "", so flagging it
    // would be noise nobody reads.
    const r = run({
      "text.tsx": form('{ subject: "" }', `<input id="subject" {...form.register("subject")} />`),
    });
    expect(r.status).toBe(0);
  });
});