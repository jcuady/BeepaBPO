import type { TablerIcon } from "@tabler/icons-react";
import {
  IconBriefcase,
  IconBuilding,
  IconCalendar,
  IconChartBar,
  IconClock,
  IconCash,
  IconCoin,
  IconDashboard,
  IconFileText,
  IconGitBranch,
  IconHeadset,
  IconHome,
  IconHourglass,
  IconLayoutDashboard,
  IconReceipt,
  IconReportAnalytics,
  IconSettings,
  IconTicket,
  IconUser,
  IconUserCircle,
  IconUsers,
  IconUsersGroup,
  IconNews,
} from "@tabler/icons-react";
import { can, canAny } from "@/lib/permissions/can";

export type NavItem = {
  title: string;
  href: string;
  icon: TablerIcon;
  permission?: string | string[];
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export const employeeNav: NavItem[] = [
  { title: "Dashboard", href: "/app/my", icon: IconLayoutDashboard },
  { title: "Attendance", href: "/app/my/attendance", icon: IconClock },
  { title: "Schedule", href: "/app/my/schedule", icon: IconCalendar },
  { title: "Leave", href: "/app/my/leave", icon: IconCalendar },
  { title: "Payroll", href: "/app/my/payroll", icon: IconCoin },
  { title: "Cash advances", href: "/app/my/cash-advances", icon: IconCash },
  { title: "NTE", href: "/app/my/nte", icon: IconFileText },
  { title: "Requests", href: "/app/my/requests", icon: IconFileText },
  { title: "Documents", href: "/app/my/documents", icon: IconFileText },
  { title: "Profile", href: "/app/my/profile", icon: IconUserCircle },
  { title: "Support", href: "/app/my/support", icon: IconHeadset },
];

export const clientNav: NavItem[] = [
  { title: "Dashboard", href: "/app/client", icon: IconLayoutDashboard },
  { title: "My Team", href: "/app/client/team", icon: IconUsersGroup },
  { title: "Attendance", href: "/app/client/attendance", icon: IconClock },
  { title: "Timesheets", href: "/app/client/timesheets", icon: IconReceipt },
  {
    title: "Approvals",
    href: "/app/client/approvals",
    icon: IconReportAnalytics,
    permission: ["attendance.approve", "approvals.act"],
  },
  { title: "Performance", href: "/app/client/performance", icon: IconChartBar },
  { title: "Requests", href: "/app/client/requests", icon: IconFileText },
  { title: "Tickets", href: "/app/client/tickets", icon: IconTicket },
  { title: "Reports", href: "/app/client/reports", icon: IconReportAnalytics },
  { title: "Documents", href: "/app/client/documents", icon: IconFileText },
  { title: "Billing", href: "/app/client/billing", icon: IconCoin },
  { title: "Settings", href: "/app/client/settings", icon: IconSettings },
];

export const applicantNav: NavItem[] = [
  { title: "Applications", href: "/app/applicant", icon: IconBriefcase },
  { title: "Profile", href: "/app/applicant/profile", icon: IconUserCircle },
];

export const adminNavGroups: NavGroup[] = [
  {
    label: "HR",
    items: [
      {
        title: "HR",
        href: "/app/hr",
        icon: IconUsers,
        permission: ["employees.read", "employees.manage", "leave.read"],
      },
      {
        title: "NTE Cases",
        href: "/app/hr/nte",
        icon: IconFileText,
        permission: ["nte.read", "nte.manage"],
      },
    ],
  },
  {
    label: "Payroll",
    items: [
      {
        title: "Payroll",
        href: "/app/payroll",
        icon: IconCoin,
        permission: ["payroll.read", "payroll.manage"],
      },
      {
        title: "Billing",
        href: "/app/billing",
        icon: IconReceipt,
        permission: ["billing.read", "billing.manage"],
      },
    ],
  },
  {
    label: "Recruitment",
    items: [
      {
        title: "Recruitment",
        href: "/app/recruitment",
        icon: IconBriefcase,
        permission: ["recruitment.read", "recruitment.manage"],
      },
    ],
  },
  {
    label: "CRM",
    items: [
      {
        title: "CRM",
        href: "/app/crm",
        icon: IconBuilding,
        permission: ["crm.read", "crm.manage"],
      },
      {
        title: "Deals",
        href: "/app/crm/deals",
        icon: IconBriefcase,
        permission: ["crm.read", "crm.manage"],
      },
      {
        title: "Proposals",
        href: "/app/crm/proposals",
        icon: IconFileText,
        permission: ["crm.read", "crm.manage"],
      },
    ],
  },
  {
    label: "Clients",
    items: [
      {
        title: "Clients",
        href: "/app/clients",
        icon: IconUsersGroup,
        permission: ["clients.read", "clients.manage"],
      },
    ],
  },
  {
    label: "Tickets",
    items: [
      {
        title: "Tickets",
        href: "/app/tickets",
        icon: IconTicket,
        permission: ["tickets.read", "tickets.manage"],
      },
      {
        title: "SLA policies",
        href: "/app/tickets/sla",
        icon: IconHourglass,
        permission: "tickets.manage",
      },
    ],
  },
  {
    label: "Reports",
    items: [
      {
        title: "Reports",
        href: "/app/reports",
        icon: IconReportAnalytics,
        permission: ["reports.read", "reports.export"],
      },
    ],
  },
  {
    label: "Marketing",
    items: [
      {
        title: "CMS",
        href: "/app/cms",
        icon: IconNews,
        permission: "cms.manage",
      },
    ],
  },
  {
    label: "Admin",
    items: [
      {
        title: "Approvals",
        href: "/app/approvals",
        icon: IconFileText,
        // ponytail: hide Approvals unless user can open a real queue (seeded employee role also has approvals.act)
        permission: [
          "leave.approve",
          "cash_advance.approve",
          "cash_advance.manage",
          "tickets.manage",
          "attendance.approve",
          "attendance.correct",
          "attendance.manage",
          "payroll.manage",
          "payroll.approve",
        ],
      },
      {
        title: "Corrections",
        href: "/app/attendance/corrections",
        icon: IconClock,
        permission: [
          "attendance.approve",
          "attendance.correct",
          "attendance.manage",
        ],
      },
      {
        title: "Admin",
        href: "/app/admin",
        icon: IconSettings,
        permission: "system.manage",
      },
      {
        title: "Users",
        href: "/app/admin/users",
        icon: IconUsers,
        permission: "system.manage",
      },
      {
        title: "Organizations",
        href: "/app/admin/organizations",
        icon: IconBuilding,
        permission: "system.manage",
      },
      {
        title: "Audit Log",
        href: "/app/admin/audit",
        icon: IconFileText,
        permission: "system.manage",
      },
      {
        title: "Workflows",
        href: "/app/admin/workflows",
        icon: IconGitBranch,
        permission: "system.manage",
      },
      {
        title: "Dashboard",
        href: "/app/dashboard",
        icon: IconDashboard,
        permission: "system.manage",
      },
    ],
  },
];

export const employeeMobileNav: NavItem[] = [
  { title: "Home", href: "/app/my", icon: IconHome },
  { title: "Schedule", href: "/app/my/schedule", icon: IconCalendar },
  { title: "Payroll", href: "/app/my/payroll", icon: IconCoin },
  { title: "Requests", href: "/app/my/requests", icon: IconFileText },
  { title: "More", href: "/app/my/profile", icon: IconUser },
];

export const clientMobileNav: NavItem[] = [
  { title: "Home", href: "/app/client", icon: IconHome },
  { title: "Team", href: "/app/client/team", icon: IconUsersGroup },
  { title: "Tickets", href: "/app/client/tickets", icon: IconTicket },
  { title: "Reports", href: "/app/client/reports", icon: IconReportAnalytics },
  { title: "More", href: "/app/client/settings", icon: IconSettings },
];

export const applicantMobileNav: NavItem[] = [
  { title: "Apps", href: "/app/applicant", icon: IconBriefcase },
  { title: "Profile", href: "/app/applicant/profile", icon: IconUser },
];

export function filterNavByPermissions(
  items: NavItem[],
  permissions: string[],
): NavItem[] {
  return items.filter((item) => {
    if (!item.permission) return true;
    if (Array.isArray(item.permission)) {
      return canAny(permissions, item.permission);
    }
    return can(permissions, item.permission);
  });
}

export function getAdminNavGroups(permissions: string[]): NavGroup[] {
  return adminNavGroups
    .map((group) => ({
      ...group,
      items: filterNavByPermissions(group.items, permissions),
    }))
    .filter((group) => group.items.length > 0);
}

export function getPrimaryNavGroups(workspace: {
  isApplicantOnly: boolean;
  isInternal: boolean;
  isClient: boolean;
  permissions: string[];
}): { label: string; items: NavItem[] }[] {
  if (workspace.isApplicantOnly) {
    return [{ label: "Applications", items: applicantNav }];
  }
  const groups: { label: string; items: NavItem[] }[] = [];
  if (workspace.isInternal) {
    groups.push({ label: "My Workspace", items: employeeNav });
  }
  if (workspace.isClient) {
    groups.push({
      label: "Client Portal",
      items: filterNavByPermissions(clientNav, workspace.permissions),
    });
  }
  return groups;
}

export function getMobileNav(workspace: {
  isApplicantOnly: boolean;
  isInternal: boolean;
  isClient: boolean;
  permissions: string[];
}): NavItem[] {
  if (workspace.isApplicantOnly) return applicantMobileNav;
  if (workspace.isClient && !workspace.isInternal) {
    return filterNavByPermissions(clientMobileNav, workspace.permissions);
  }
  if (workspace.isInternal) return employeeMobileNav;
  return filterNavByPermissions(clientMobileNav, workspace.permissions);
}

export function getCommandLinks(
  permissions: string[],
  isClient: boolean,
  isInternal: boolean,
  isApplicantOnly = false,
): NavItem[] {
  const links: NavItem[] = [];
  if (isApplicantOnly) links.push(...applicantNav);
  if (isClient) links.push(...clientNav);
  if (isInternal) links.push(...employeeNav);
  links.push(...adminNavGroups.flatMap((g) => g.items));
  return filterNavByPermissions(
    links.filter(
      (item, index, arr) => arr.findIndex((x) => x.href === item.href) === index,
    ),
    permissions,
  );
}

export function getGreeting(): "morning" | "afternoon" | "evening" {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

export function greetingLabel(): string {
  const part = getGreeting();
  return part.charAt(0).toUpperCase() + part.slice(1);
}
