/**
 * Module access matrix for Sales & Marketing — public seam for CRM + Tickets usability.
 * Keep in sync with:
 * - supabase/migrations/*seed_roles* and *sales_marketing_crm_tickets*
 * - docs/PERMISSIONS.md
 * - lib/app/navigation.ts admin groups
 */
export const SALES_MODULE_PERMISSIONS = [
  "crm.read",
  "crm.manage",
  "crm.reports",
  "clients.read",
  "reports.read",
  "tickets.read",
  "tickets.manage",
  "tickets.self",
] as const;

export const MARKETING_MODULE_PERMISSIONS = [
  "cms.manage",
  "crm.read",
  "crm.manage",
  "reports.read",
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

/** Admin nav hrefs each role should see (and only these CRM/ops groups). */
export const SALES_ADMIN_NAV_HREFS = [
  "/app/crm",
  "/app/crm/leads",
  "/app/crm/deals",
  "/app/crm/proposals",
  "/app/clients",
  "/app/tickets",
  "/app/reports",
] as const;

export const MARKETING_ADMIN_NAV_HREFS = [
  "/app/crm",
  "/app/crm/leads",
  "/app/crm/deals",
  "/app/crm/proposals",
  "/app/tickets",
  "/app/reports",
  "/app/cms",
] as const;

/** Routes both roles must reach for CRM + ticketing QA. */
export const SALES_MARKETING_QA_ROUTES = [
  "/app/crm",
  "/app/crm/leads",
  "/app/crm/deals",
  "/app/crm/proposals",
  "/app/tickets",
] as const;

/** Nav items that must NOT appear for sales/marketing. */
export const SALES_MARKETING_FORBIDDEN_NAV_HREFS = [
  "/app/tickets/sla",
  "/app/approvals",
  "/app/hr",
  "/app/payroll",
  "/app/recruitment",
  "/app/admin",
  "/app/dashboard",
] as const;
