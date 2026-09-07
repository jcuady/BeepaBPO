export type MembershipFlagInput = {
  membership_type: string;
  status: string;
  organization: { type: string };
  roles: { scope: string }[];
};

export function computeWorkspaceFlags(memberships: MembershipFlagInput[]) {
  const active = memberships.filter((m) => m.status === "active");

  const isInternal = active.some(
    (m) =>
      m.membership_type === "internal" &&
      m.organization.type === "internal" &&
      m.roles.some((r) => r.scope !== "applicant"),
  );

  const isClient = active.some((m) => m.membership_type === "client");

  const hasStaffOrClientRole = active.some((m) =>
    m.roles.some((r) => r.scope !== "applicant"),
  );

  const isApplicantOnly =
    active.length > 0 && !hasStaffOrClientRole && !isInternal && !isClient;

  return { isInternal, isClient, isApplicantOnly };
}
