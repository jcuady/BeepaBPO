import { describe, expect, it } from "vitest";
import { landingPathFor } from "@/lib/auth/landing";

describe("landingPathFor", () => {
  it("sends empty memberships to access-denied", () => {
    expect(
      landingPathFor({
        membershipCount: 0,
        isApplicantOnly: false,
        isInternal: false,
        isClient: false,
        permissions: [],
      }),
    ).toBe("/app/access-denied");
  });

  it("sends applicants to /app/applicant", () => {
    expect(
      landingPathFor({
        membershipCount: 1,
        isApplicantOnly: true,
        isInternal: false,
        isClient: false,
        permissions: [],
      }),
    ).toBe("/app/applicant");
  });

  it("prefers system.manage dashboard over internal/client", () => {
    expect(
      landingPathFor({
        membershipCount: 1,
        isApplicantOnly: false,
        isInternal: true,
        isClient: true,
        permissions: ["system.manage"],
      }),
    ).toBe("/app/dashboard");
  });

  it("prefers internal over client for dual memberships", () => {
    expect(
      landingPathFor({
        membershipCount: 2,
        isApplicantOnly: false,
        isInternal: true,
        isClient: true,
        permissions: [],
      }),
    ).toBe("/app/my");
  });

  it("sends client-only users to /app/client", () => {
    expect(
      landingPathFor({
        membershipCount: 1,
        isApplicantOnly: false,
        isInternal: false,
        isClient: true,
        permissions: [],
      }),
    ).toBe("/app/client");
  });
});
