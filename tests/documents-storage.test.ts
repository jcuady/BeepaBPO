import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("documents storage seam", () => {
  const actions = readFileSync(
    join(process.cwd(), "lib/documents/actions.ts"),
    "utf8",
  );
  const myPage = readFileSync(
    join(process.cwd(), "app/app/my/documents/page.tsx"),
    "utf8",
  );
  const migration = readFileSync(
    join(
      process.cwd(),
      "supabase/migrations/20260907140000_documents_client_insert.sql",
    ),
    "utf8",
  );

  it("exports signed download without service-role signing", () => {
    expect(actions).toContain("export async function getDocumentDownloadUrl");
    expect(actions).toContain("createSignedUrl");
    expect(actions).not.toMatch(
      /getDocumentDownloadUrl[\s\S]{0,1200}createAdminClient/,
    );
  });

  it("uploads to path-scoped private buckets", () => {
    expect(actions).toContain('bucket = "employee-documents"');
    expect(actions).toContain('bucket = "client-documents"');
    expect(actions).toContain(".upload(");
  });

  it("my documents wires upload + download", () => {
    expect(myPage).toContain("DocumentUploadForm");
    expect(myPage).toContain("DocumentDownloadButton");
    expect(myPage).not.toContain("Secure download is not wired yet");
  });

  it("adds client documents insert RLS policy", () => {
    expect(migration).toContain("documents_insert_client");
    expect(migration).toContain("can_access_client");
  });
});
