import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("job post update/close seam", () => {
  const actions = readFileSync(
    join(process.cwd(), "lib/recruitment/actions.ts"),
    "utf8",
  );
  const list = readFileSync(
    join(process.cwd(), "app/app/recruitment/jobs/page.tsx"),
    "utf8",
  );
  const detail = readFileSync(
    join(process.cwd(), "app/app/recruitment/jobs/[id]/page.tsx"),
    "utf8",
  );

  it("exports update, close, and publish actions", () => {
    expect(actions).toContain("export async function updateJobPost");
    expect(actions).toContain("export async function closeJobPost");
    expect(actions).toContain("export async function publishJobPost");
  });

  it("requires recruitment.manage for mutations", () => {
    for (const name of ["updateJobPost", "closeJobPost", "publishJobPost"]) {
      const start = actions.indexOf(`export async function ${name}`);
      const body = actions.slice(start, start + 400);
      expect(body).toContain('requirePermission(workspace, "recruitment.manage")');
    }
  });

  it("jobs list no longer marks update/close as missing", () => {
    expect(list).not.toContain("Update/close UI is not built yet");
    expect(list).toContain("JobPostStatusActions");
    expect(detail).toContain("JobPostForm");
    expect(detail).toContain("JobPostStatusActions");
  });
});
