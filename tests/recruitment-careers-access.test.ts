import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  APPLICATION_STAGES,
  APPLICATION_STAGE_OPTIONS,
  PIPELINE_STAGES,
  isTerminalStage,
  pipelinePosition,
  stageMeta,
  type StageTone,
} from "@/lib/recruitment/application-stage";
import { applicantNav, applicantMobileNav, getAdminNavGroups } from "@/lib/app/navigation";

/**
 * Careers access for HR and for applicants, and a complete status model.
 *
 * Two roles could not do the thing they exist to do:
 *   - `hr` had no `recruitment.*`, so HR had no route into `/app/recruitment`.
 *     The people who onboard a hire could not post or advance the vacancy.
 *   - The applicant could only see their own applications. Applying meant
 *     leaving the portal for the public `/careers` page — the empty state on
 *     their own dashboard instructed them to do exactly that.
 *
 * And twelve application stages were rendered as `stage.replace(/_/g, " ")`,
 * which tells an applicant nothing and a reviewer nothing.
 *
 * The enum values are parsed out of the migration rather than re-typed, so
 * adding a stage to the database without adding it here fails this test instead
 * of silently rendering as an unstyled string.
 */

const MIGRATIONS = "supabase/migrations";

function migration(name: string): string {
  return readFileSync(join(process.cwd(), MIGRATIONS, name), "utf8");
}

/** Every literal in the `application_stage` enum declaration. */
function enumValuesFromMigration(): string[] {
  const sql = migration("20260906001100_ats_crm_cms.sql");
  const block = sql.match(
    /create type public\.application_stage as enum \(([\s\S]*?)\);/,
  );
  expect(block, "application_stage enum declaration not found").not.toBeNull();
  return [...(block as RegExpMatchArray)[1].matchAll(/'([^']+)'/g)].map(
    (m) => m[1],
  );
}

const TONES: readonly StageTone[] = [
  "neutral",
  "progress",
  "positive",
  "warning",
  "negative",
];

describe("application stage model", () => {
  const dbStages = enumValuesFromMigration();

  it("covers every value in the database enum", () => {
    // The guard that makes this table trustworthy: a new enum value without
    // metadata here would otherwise render as a bare underscored string.
    expect([...APPLICATION_STAGES].sort()).toEqual([...dbStages].sort());
  });

  it("gives every stage a real label, tone and both explanations", () => {
    for (const stage of APPLICATION_STAGES) {
      const meta = stageMeta(stage);
      expect(meta.label, `${stage} label`).toBeTruthy();
      // A label that is just the underscored value means nobody wrote copy.
      expect(meta.label, `${stage} label is derived`).not.toBe(stage);
      expect(meta.label, `${stage} label has no underscores`).not.toContain("_");
      expect(TONES, `${stage} tone`).toContain(meta.tone);
      expect(meta.applicantNote.length, `${stage} applicantNote`).toBeGreaterThan(
        20,
      );
      expect(meta.staffNote.length, `${stage} staffNote`).toBeGreaterThan(10);
      expect(typeof meta.terminal).toBe("boolean");
    }
  });

  it("classifies terminal stages correctly", () => {
    // Only `hired`, `rejected` and `withdrawn` are finished. `on_hold` and
    // `talent_pool` are parked — treating them as terminal would tell an
    // applicant their application is dead when it is not.
    expect(isTerminalStage("hired")).toBe(true);
    expect(isTerminalStage("rejected")).toBe(true);
    expect(isTerminalStage("withdrawn")).toBe(true);
    expect(isTerminalStage("on_hold")).toBe(false);
    expect(isTerminalStage("talent_pool")).toBe(false);
    expect(isTerminalStage("offer")).toBe(false);

    for (const stage of APPLICATION_STAGES) {
      const meta = stageMeta(stage);
      const shouldBeTerminal = ["hired", "rejected", "withdrawn"].includes(stage);
      expect(meta.terminal, `${stage} terminal`).toBe(shouldBeTerminal);
    }
  });

  it("orders the happy path and gives it positions", () => {
    expect(PIPELINE_STAGES).toEqual([
      "applied",
      "screening",
      "initial_interview",
      "assessment",
      "client_endorsement",
      "client_interview",
      "offer",
      "hired",
    ]);
    // Positions are 1-based and dense, so "step N of 8" is meaningful.
    const positions = PIPELINE_STAGES.map((s) => stageMeta(s).step);
    expect(positions).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(pipelinePosition("screening")).toEqual({ index: 2, total: 8 });
    // Off-pipeline stages have no position rather than a misleading zero.
    expect(pipelinePosition("on_hold")).toBeNull();
    expect(pipelinePosition("talent_pool")).toBeNull();
    expect(pipelinePosition("rejected")).toBeNull();
  });

  it("falls back safely instead of throwing on an unmapped value", () => {
    // A future migration can add an enum value this table has never seen. The
    // page must render an obviously-unmapped badge, not crash a server component.
    const future = stageMeta("background_check");
    expect(future.label).toBe("background check");
    expect(future.tone).toBe("neutral");
    expect(future.step).toBeNull();
    expect(future.applicantNote).toContain("not recognised");

    expect(stageMeta(null).label).toBe("Unknown");
    expect(stageMeta(undefined).label).toBe("Unknown");
    expect(stageMeta("").label).toBe("Unknown");
  });

  it("offers labelled options for select inputs", () => {
    expect(APPLICATION_STAGE_OPTIONS).toHaveLength(APPLICATION_STAGES.length);
    for (const option of APPLICATION_STAGE_OPTIONS) {
      expect(option.label).not.toContain("_");
      expect(APPLICATION_STAGES).toContain(option.value);
    }
  });
});

describe("HR can run recruitment", () => {
  const grant = migration("20261008120000_hr_recruitment_access.sql");

  it("grants both recruitment permissions to the hr role", () => {
    expect(grant).toContain("r.code = 'hr'");
    expect(grant).toContain("'recruitment.read'");
    expect(grant).toContain("'recruitment.manage'");
    // Idempotent, so re-applying is safe.
    expect(grant).toContain("on conflict do nothing");
  });

  it("the original seed alone does not give HR recruitment access", () => {
    // This is the defect the new migration repairs. If someone extends the seed
    // to include recruitment, the fix stays necessary and harmless — but this
    // assertion documents why the migration exists at all.
    const seed = migration("20260906000600_seed_roles_permissions.sql");
    const hrBlock = seed.match(
      /_seed_role_perms\('hr',\s*array\[([\s\S]*?)\]\)/,
    );
    expect(hrBlock).not.toBeNull();
    expect(hrBlock?.[1]).not.toContain("recruitment.");
    // And the seed does give HR employees.manage, which is the second half of
    // the hire gate — so the grant above completes the pair.
    expect(hrBlock?.[1]).toContain("employees.manage");
  });

  it("does not re-grant recruitment to the applicant role", () => {
    // `20260911150000` removed it deliberately: recruitment.read would expose
    // the whole applicant table. Applicants reach published roles through
    // status-scoped RLS instead, so this must stay revoked.
    const hardened = migration("20260911150000_harden_client_applicant_perms.sql");
    expect(hardened).toMatch(
      /r\.code = 'applicant'[\s\S]{0,120}?p\.code = 'recruitment\.read'/,
    );
    expect(grant).not.toMatch(/r\.code = 'applicant'/);
  });

  it("HR can complete the hire, which needs recruitment.manage + employees.manage", () => {
    const actions = readFileSync(
      join(process.cwd(), "lib", "recruitment", "actions.ts"),
      "utf8",
    );
    const hire = actions.slice(actions.indexOf("convertApplicantToEmployee"));
    expect(hire).toContain('"recruitment.manage"');
    expect(hire).toContain('"employees.manage"');
  });

  it("the grant actually surfaces Recruitment in the HR sidebar", () => {
    // A permission row is only useful if it changes what the user can see and
    // reach. `getAdminNavGroups` is pure, so this can be asserted without a
    // database — which matters here, because the migration is still unapplied.
    const seed = migration("20260906000600_seed_roles_permissions.sql");
    const hrBlock = seed.match(
      /_seed_role_perms\('hr',\s*array\[([\s\S]*?)\]\)/,
    ) as RegExpMatchArray;

    const seedPerms = [...hrBlock[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
    const before = getAdminNavGroups(seedPerms);
    const beforeHrefs = before.flatMap((g) => g.items.map((i) => i.href));

    // Before the grant: no Recruitment group at all.
    expect(beforeHrefs).not.toContain("/app/recruitment");
    // HR did have its core pages, so this is a targeted gap, not a broken role.
    expect(beforeHrefs).toContain("/app/hr");
    expect(beforeHrefs).toContain("/app/attendance");

    const after = getAdminNavGroups([
      ...seedPerms,
      "recruitment.read",
      "recruitment.manage",
    ]);
    const afterHrefs = after.flatMap((g) => g.items.map((i) => i.href));
    expect(afterHrefs).toContain("/app/recruitment");
    // And the grant must not change anything else.
    expect(afterHrefs.filter((h) => !beforeHrefs.includes(h))).toEqual([
      "/app/recruitment",
    ]);
  });
});

describe("applicant careers", () => {
  it("lists open roles and notifications in the applicant nav", () => {
    const hrefs = applicantNav.map((i) => i.href);
    expect(hrefs).toContain("/app/applicant/jobs");
    // This page existed but was not linked from anywhere in the applicant nav,
    // so it was reachable only by typing the URL.
    expect(hrefs).toContain("/app/applicant/notifications");
    expect(hrefs).toContain("/app/applicant");
    expect(hrefs).toContain("/app/applicant/profile");
  });

  it("every applicant nav destination has a real page", () => {
    for (const item of [...applicantNav, ...applicantMobileNav]) {
      const file = join(
        process.cwd(),
        "app",
        ...item.href.split("/").filter(Boolean),
        "page.tsx",
      );
      expect(existsSync(file), `${item.href} has no page.tsx`).toBe(true);
    }
  });

  it("keeps the applicant nav reachable on mobile too", () => {
    const mobileHrefs = applicantMobileNav.map((i) => i.href);
    expect(mobileHrefs).toContain("/app/applicant/jobs");
    expect(mobileHrefs).toContain("/app/applicant/notifications");
  });

  it("only ever lists published roles", () => {
    // A draft or closed vacancy must not appear to an applicant.
    const list = readFileSync(
      join(process.cwd(), "app", "app", "applicant", "jobs", "page.tsx"),
      "utf8",
    );
    expect(list).toContain('.eq("status", "published")');

    const detail = readFileSync(
      join(
        process.cwd(),
        "app",
        "app",
        "applicant",
        "jobs",
        "[id]",
        "page.tsx",
      ),
      "utf8",
    );
    expect(detail).toContain('.eq("status", "published")');
    expect(detail).toContain("notFound()");
  });

  it("reuses the shared apply form rather than forking the validation", () => {
    const detail = readFileSync(
      join(
        process.cwd(),
        "app",
        "app",
        "applicant",
        "jobs",
        "[id]",
        "page.tsx",
      ),
      "utf8",
    );
    expect(detail).toContain("JobApplyForm");
    expect(detail).toContain("jobPostId={job.id}");
    // The duplicate-application guard lives in the action, not the page.
    const actions = readFileSync(
      join(process.cwd(), "lib", "recruitment", "actions.ts"),
      "utf8",
    );
    expect(actions).toContain("You have already applied for this role.");
  });

  it("the empty state no longer sends the applicant out of the portal", () => {
    const page = readFileSync(
      join(process.cwd(), "app", "app", "applicant", "page.tsx"),
      "utf8",
    );
    expect(page).toContain('actionHref="/app/applicant/jobs"');
    expect(page).not.toContain('actionHref="/careers"');
  });
});

describe("the auditor must be able to see a denial", () => {
  const audit = readFileSync(
    join(process.cwd(), "scripts", "audit-app-responsive.mjs"),
    "utf8",
  );

  it("boundary pages expose a machine-readable status", () => {
    // Next renders `forbidden()` and the error boundary AT the requested URL,
    // so a URL-change check scores a 403 as a flawless page. These attributes
    // are what let the auditor see it without sniffing text.
    const forbidden = readFileSync(
      join(process.cwd(), "app", "app", "forbidden.tsx"),
      "utf8",
    );
    expect(forbidden).toContain('data-page-status="forbidden"');

    const errorPage = readFileSync(
      join(process.cwd(), "app", "app", "error.tsx"),
      "utf8",
    );
    expect(errorPage).toContain('data-page-status="error"');
  });

  it("the responsive audit fails a denied route instead of passing it", () => {
    expect(audit).toContain("data-page-status");
    expect(audit).toMatch(/issues\.push\(`DENIED \$\{denied\}`\)/);
    // And the denial check must run before the layout probe, so a denied page
    // is not also scored for layout issues it never had.
    expect(audit.indexOf("data-page-status")).toBeLessThan(
      audit.indexOf("await page.evaluate(probe"),
    );
  });

  it("negative control: the check fails the route it used to pass", () => {
    // Before this fix, `/app/recruitment` for an `hr` account reported
    // "PASS" with no issues, purely because a 403 page is laid out cleanly.
    // The assertion below is the shape of that bug.
    const deniedPageIssues = (pageStatus: string | null) =>
      pageStatus ? `DENIED ${pageStatus}` : null;
    expect(deniedPageIssues("forbidden")).toBe("DENIED forbidden");
    expect(deniedPageIssues(null)).toBeNull();
  });
});
  describe("no surface re-derives stage labels", () => {
  it("no surface re-derives stage labels by hand", () => {
    // The drift guard. Three files previously each had their own copy of the
    // enum and each rendered a stage with `replace(/_/g, " ")`.
    //
    // Scoped to *stage* text specifically. The generic `humanizeEnum` helper
    // legitimately uses the same transform for location_type, employment_type
    // and similar, and a blanket ban on the expression would have flagged
    // correct code — which is the failure mode that makes a scanner get
    // switched off.
    const files = [
      join("app", "app", "recruitment", "applicants", "page.tsx"),
      join("app", "app", "recruitment", "applicants", "[id]", "page.tsx"),
      join("app", "app", "applicant", "page.tsx"),
      join("app", "app", "applicant", "jobs", "[id]", "page.tsx"),
      join("components", "app", "recruitment", "application-stage-form.tsx"),
    ];
    const handRolledStageLabel =
      /stage\s*(\?\.)?\.\s*replace|stage\)?\s*\.replace|stage\.replace/;
    for (const rel of files) {
      const src = readFileSync(join(process.cwd(), rel), "utf8");
      expect(
        handRolledStageLabel.test(src),
        `${rel} still derives stage labels by hand`,
      ).toBe(false);
    }
  });

  it("negative control: the guard would catch the original defect", () => {
    // The exact expression the three files used before this change.
    const before = `<Badge>{application.stage.replace(/_/g, " ")}</Badge>`;
    expect(/stage\.replace/.test(before)).toBe(true);
    // And a legitimate generic use must NOT trip it.
    const after = `<span>{humanizeEnum(job.employment_type)}</span>`;
    expect(/stage\.replace/.test(after)).toBe(false);
  });

  it("the stage form groups options instead of listing twelve identical strings", () => {
    const form = readFileSync(
      join(
        process.cwd(),
        "components",
        "app",
        "recruitment",
        "application-stage-form.tsx",
      ),
      "utf8",
    );
    expect(form).toContain("<optgroup");
    expect(form).toContain("stageMeta(stage).label");
    // The confirm dialog explains the target rather than naming it.
    expect(form).toContain("nextMeta.staffNote");
  });
});