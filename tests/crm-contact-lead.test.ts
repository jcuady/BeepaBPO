import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Regression: public contact → CRM must not use the user-scoped Supabase client.
 * RLS on crm_leads requires crm.manage; anon/public forms only work via service role.
 */
describe("createLeadFromContact trust boundary", () => {
  const src = readFileSync(
    join(process.cwd(), "lib/crm/actions.ts"),
    "utf8",
  );
  const start = src.indexOf("export async function createLeadFromContact");
  const nextExport =
    start >= 0
      ? src.indexOf("\nexport async function", start + 1)
      : -1;
  const body =
    start >= 0
      ? src.slice(start, nextExport > 0 ? nextExport : undefined)
      : "";

  it("exports createLeadFromContact", () => {
    expect(start).toBeGreaterThanOrEqual(0);
  });

  it("uses createAdminClient for the public contact path", () => {
    expect(body).toMatch(/const supabase = createAdminClient\(\)/);
  });

  it("does not use user createClient inside createLeadFromContact", () => {
    expect(body).not.toMatch(/await createClient\(\)/);
  });
});
