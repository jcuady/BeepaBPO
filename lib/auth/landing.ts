import { can, canAny, canAll } from "@/lib/permissions/can";

export type LandingFlags = {
  membershipCount: number;
  isApplicantOnly: boolean;
  isInternal: boolean;
  isClient: boolean;
  permissions: Set<string> | string[];
};

/**
 * Home routing for /app.
 * Internal wins over client for dual memberships.
 * Sales → CRM hub; Marketing → CMS (CRM remains in nav).
 */
export function landingPathFor(flags: LandingFlags): string {
  if (flags.membershipCount === 0) return "/app/access-denied";
  if (flags.isApplicantOnly) return "/app/applicant";
  if (can(flags.permissions, "system.manage")) return "/app/dashboard";
  if (flags.isInternal) {
    // Marketing primary surface is CMS; they also keep CRM in admin nav.
    if (can(flags.permissions, "cms.manage")) return "/app/cms";
    // Sales (and other CRM-first internals) land on the CRM hub.
    if (canAny(flags.permissions, ["crm.read", "crm.manage"])) {
      return "/app/crm";
    }
    return "/app/my";
  }
  if (flags.isClient) return "/app/client";
  return "/app/access-denied";
}
