import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("NTE close-out slice", () => {
  const actions = readFileSync(
    join(process.cwd(), "lib/hr/nte-actions.ts"),
    "utf8",
  );
  const hrPage = readFileSync(
    join(process.cwd(), "app/app/hr/nte/page.tsx"),
    "utf8",
  );
  const form = readFileSync(
    join(process.cwd(), "components/app/nte/nte-resolve-form.tsx"),
    "utf8",
  );
  const validation = readFileSync(
    join(process.cwd(), "lib/validation/app.ts"),
    "utf8",
  );

  it("exports resolveNteCase gated by nte.manage", () => {
    expect(actions).toContain("export async function resolveNteCase");
    const start = actions.indexOf("export async function resolveNteCase");
    const body = actions.slice(start);
    expect(body).toContain('can(workspace.permissions, "nte.manage")');
    expect(body).toContain('status: "resolved"');
    expect(body).toContain("nte.resolve");
  });

  it("writes disciplinary_actions when not cleared", () => {
    const start = actions.indexOf("export async function resolveNteCase");
    const body = actions.slice(start);
    expect(body).toContain('from("disciplinary_actions")');
    expect(body).toContain('resolution_type !== "cleared"');
  });

  it("validates nteResolveSchema", () => {
    expect(validation).toContain("nteResolveSchema");
    expect(validation).toContain('"written_warning"');
    expect(validation).toContain('"dismissal"');
  });

  it("wires NteResolveForm on HR page", () => {
    expect(form).toContain("resolveNteCase");
    expect(form).toContain("ConfirmDialog");
    expect(hrPage).toContain("NteResolveForm");
    expect(hrPage).toContain("StatusBadge");
  });
});
