/**
 * Module access matrix for Sales & Marketing — public seam for CRM + Tickets usability.
 * Keep in sync with:
 * - supabase/migrations/*seed_roles* and *sales_marketing_crm_tickets*
 * - docs/PERMISSIONS.md
 */
export const SALES_MODULE_PERMISSIONS = [
  "crm.read",
  "crm.manage",
  "crm.reports",
  "tickets.read",
  "tickets.manage",
  "tickets.self",
] as const;

export const MARKETING_MODULE_PERMISSIONS = [
  "cms.manage",
  "crm.read",
  "crm.manage",
  "tickets.read",
  "tickets.manage",
  "tickets.self",
] as const;

export type SalesMarketingRole = "sales" | "marketing";

export function modulePermissionsForRole(
  role: SalesMarketingRole,
): readonly string[] {
  return role === "sales"
    ? SALES_MODULE_PERMISSIONS
    : MARKETING_MODULE_PERMISSIONS;
}

/** Routes both roles must reach for CRM + ticketing QA. */
export const SALES_MARKETING_QA_ROUTES = [
  "/app/crm",
  "/app/crm/leads",
  "/app/crm/deals",
  "/app/crm/proposals",
  "/app/tickets",
] as const;
