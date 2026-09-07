import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { slugifyTitle } from "@/lib/cms/slug";
import { parseAboutSetting } from "@/lib/cms/about";

describe("cms slugifyTitle", () => {
  it("kebabs and trims", () => {
    expect(slugifyTitle("  How We Staff Teams! ")).toBe("how-we-staff-teams");
  });

  it("returns empty for blank", () => {
    expect(slugifyTitle("   ")).toBe("");
  });
});

describe("parseAboutSetting", () => {
  it("accepts valid object", () => {
    expect(
      parseAboutSetting({ headline: " Hi ", body: " Story here long enough " }),
    ).toEqual({ headline: "Hi", body: "Story here long enough" });
  });

  it("rejects junk", () => {
    expect(parseAboutSetting(null)).toBeNull();
    expect(parseAboutSetting({ headline: "x" })).toBeNull();
    expect(parseAboutSetting("nope")).toBeNull();
  });
});

describe("cms admin wiring", () => {
  const actions = readFileSync(
    join(process.cwd(), "lib/cms/actions.ts"),
    "utf8",
  );
  const page = readFileSync(join(process.cwd(), "app/app/cms/page.tsx"), "utf8");
  const nav = readFileSync(
    join(process.cwd(), "lib/app/navigation.ts"),
    "utf8",
  );
  const resources = readFileSync(
    join(process.cwd(), "app/(marketing)/resources/page.tsx"),
    "utf8",
  );
  const services = readFileSync(
    join(process.cwd(), "app/(marketing)/services/page.tsx"),
    "utf8",
  );

  const about = readFileSync(
    join(process.cwd(), "app/(marketing)/about/page.tsx"),
    "utf8",
  );
  const contact = readFileSync(
    join(process.cwd(), "app/(marketing)/contact/page.tsx"),
    "utf8",
  );

  it("gates mutations on cms.manage", () => {
    expect(actions).toContain('requirePermission(workspace, "cms.manage")');
    expect(page).toContain('requirePermission(workspace, "cms.manage")');
  });

  it("exposes CMS nav for cms.manage", () => {
    expect(nav).toContain('href: "/app/cms"');
    expect(nav).toContain('permission: "cms.manage"');
  });

  it("public pages read published rows", () => {
    expect(resources).toContain('.eq("status", "published")');
    expect(resources).toContain('from("blog_posts")');
    expect(services).toContain('.eq("status", "published")');
    expect(services).toContain('from("services")');
    expect(contact).toContain('from("faqs")');
    expect(contact).toContain('.eq("status", "published")');
  });

  it("about page reads public_about settings", () => {
    expect(actions).toContain("upsertAboutPage");
    expect(actions).toContain("createFaq");
    expect(about).toContain("ABOUT_SETTING_KEY");
    expect(about).toContain("parseAboutSetting");
    expect(page).toContain("AboutPageForm");
    expect(page).toContain("FaqForm");
  });

  it("covers remaining CMS content types", () => {
    expect(actions).toContain("createIndustry");
    expect(actions).toContain("createTestimonial");
    expect(actions).toContain("createCaseStudy");
    expect(page).toContain("IndustryForm");
    expect(page).toContain("TestimonialForm");
    expect(page).toContain("CaseStudyForm");
    expect(about).toContain('from("industries")');
    expect(about).toContain('from("testimonials")');
  });

  it("supports edit-in-place updates", () => {
    expect(actions).toContain("export async function updateBlogPost");
    expect(actions).toContain("export async function updateService");
    expect(actions).toContain("export async function updateFaq");
    expect(actions).toContain("export async function updateIndustry");
    expect(actions).toContain("export async function updateTestimonial");
    expect(actions).toContain("export async function updateCaseStudy");
    expect(page).toContain("CmsEditButton");
    const editDialog = readFileSync(
      join(process.cwd(), "components/app/cms/cms-edit-dialog.tsx"),
      "utf8",
    );
    expect(editDialog).toContain("Edit blog post");
    expect(editDialog).toContain("BlogPostForm");
    expect(editDialog).toContain("onSaved={closeAndRefresh}");
  });
});
