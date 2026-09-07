import { can } from "@/lib/permissions/can";

export type LandingFlags = {
  membershipCount: number;
  isApplicantOnly: boolean;
  isInternal: boolean;
  isClient: boolean;
  permissions: Set<string> | string[];
};

/** Home routing for /app. Internal wins over client for dual memberships. */
export function landingPathFor(flags: LandingFlags): string {
  if (flags.membershipCount === 0) return "/app/access-denied";
  if (flags.isApplicantOnly) return "/app/applicant";
  if (can(flags.permissions, "system.manage")) return "/app/dashboard";
  if (flags.isInternal) return "/app/my";
  if (flags.isClient) return "/app/client";
  return "/app/access-denied";
}
