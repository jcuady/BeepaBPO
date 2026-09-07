export type DemoPortal = "employee" | "client";

export type DemoUser = {
  email: string;
  label: string;
  role: string;
  portal: DemoPortal;
  landing: string;
};

/** Canonical demo accounts — keep in sync with `scripts/seed-demo.mts`. */
export const DEMO_USERS: readonly DemoUser[] = [
  {
    email: "owner@demo.beepabpo.com",
    label: "Owner",
    role: "owner",
    portal: "employee",
    landing: "/app/dashboard",
  },
  {
    email: "superadmin@demo.beepabpo.com",
    label: "Super Admin",
    role: "super_admin",
    portal: "employee",
    landing: "/app/dashboard",
  },
  {
    email: "hr@demo.beepabpo.com",
    label: "HR",
    role: "hr",
    portal: "employee",
    landing: "/app/my",
  },
  {
    email: "recruiter@demo.beepabpo.com",
    label: "Recruiter",
    role: "recruiter",
    portal: "employee",
    landing: "/app/my",
  },
  {
    email: "sales@demo.beepabpo.com",
    label: "Sales",
    role: "sales",
    portal: "employee",
    landing: "/app/my",
  },
  {
    email: "marketing@demo.beepabpo.com",
    label: "Marketing",
    role: "marketing",
    portal: "employee",
    landing: "/app/my",
  },
  {
    email: "operations@demo.beepabpo.com",
    label: "Operations",
    role: "operations",
    portal: "employee",
    landing: "/app/my",
  },
  {
    email: "teamlead@demo.beepabpo.com",
    label: "Team Lead",
    role: "team_lead",
    portal: "employee",
    landing: "/app/my",
  },
  {
    email: "finance@demo.beepabpo.com",
    label: "Finance",
    role: "finance",
    portal: "employee",
    landing: "/app/my",
  },
  {
    email: "employee@demo.beepabpo.com",
    label: "Employee",
    role: "employee",
    portal: "employee",
    landing: "/app/my",
  },
  {
    email: "clientadmin@demo.beepabpo.com",
    label: "Client Admin",
    role: "client_admin",
    portal: "client",
    landing: "/app/client",
  },
  {
    email: "clientviewer@demo.beepabpo.com",
    label: "Client Viewer",
    role: "client_viewer",
    portal: "client",
    landing: "/app/client",
  },
  {
    email: "applicant@demo.beepabpo.com",
    label: "Applicant",
    role: "applicant",
    portal: "client",
    landing: "/app/applicant",
  },
] as const;

export function demoUsersForPortal(portal: DemoPortal): DemoUser[] {
  return DEMO_USERS.filter((u) => u.portal === portal);
}
