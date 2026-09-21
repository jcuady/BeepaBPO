import { describe, expect, it } from "vitest";
import {
  SERVICES_CATALOG,
  resolveMarketingServices,
} from "../lib/marketing/services-catalog";

describe("services catalog", () => {
  it("includes the six principal additions", () => {
    const slugs = SERVICES_CATALOG.map((s) => s.slug);
    expect(slugs).toEqual(
      expect.arrayContaining([
        "it-support",
        "marketing",
        "elearning-course-dev",
        "slide-creator",
        "data-entry",
        "customer-relations",
      ]),
    );
    expect(SERVICES_CATALOG).toHaveLength(10);
  });

  it("fills missing CMS slugs from the catalog", () => {
    const list = resolveMarketingServices([
      {
        id: "cms-1",
        slug: "customer-support",
        title: "CMS Support",
        summary: "Override summary",
        description: "Override body",
      },
    ]);
    expect(list).toHaveLength(10);
    expect(list[0]).toMatchObject({
      id: "cms-1",
      title: "CMS Support",
      summary: "Override summary",
    });
    expect(list.find((s) => s.slug === "it-support")?.title).toBe("IT Support");
    expect(list.find((s) => s.slug === "slide-creator")?.id).toBe(
      "fallback-slide-creator",
    );
  });

  it("appends unknown CMS extras after the catalog", () => {
    const list = resolveMarketingServices([
      {
        id: "extra",
        slug: "custom-ops",
        title: "Custom Ops",
        summary: "Extra",
        description: "Body",
      },
    ]);
    expect(list).toHaveLength(11);
    expect(list.at(-1)).toMatchObject({ slug: "custom-ops", title: "Custom Ops" });
  });
});
