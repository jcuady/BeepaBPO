/**
 * Which roles a membership should hold after its functional role changes.
 *
 * Extracted from `lib/admin/actions.ts` so the rule can be tested without a
 * signed-in admin, an auth user, or a working SMTP provider — the invite path
 * in particular cannot be exercised end to end in an environment where
 * Supabase rate-limits outbound email.
 *
 * THE RULE: `employee` is the self-service baseline, not a job title. Every
 * internal membership in this system carries it alongside its functional role,
 * and it is what carries `leave.self`, `payroll.self`, `attendance.self`,
 * `tickets.self`, `approvals.act`, `cash_advance.self`, `nte.self` and
 * `performance.self` — a person's own leave, payslips, attendance and tickets.
 *
 * Replacing every role, as the action used to do, meant promoting somebody to
 * Finance silently removed all eight of those. It is not re-added to a
 * membership that never had it: this function preserves, it does not invent.
 */
export const SELF_SERVICE_BASELINE_ROLE_CODE = "employee";

export type RoleChangePlan = {
  /** Roles that stay exactly as they are. */
  preserved: string[];
  /** Roles to delete before inserting the new one. */
  removed: string[];
  /** The single functional role to (re)insert. */
  granted: string;
  /** The full set of role codes the membership will hold afterwards. */
  result: string[];
};

export function planFunctionalRoleChange(
  currentCodes: readonly string[],
  newFunctionalCode: string,
): RoleChangePlan {
  const current = [...new Set(currentCodes.filter(Boolean))];
  const preserved = current.filter((c) => c === SELF_SERVICE_BASELINE_ROLE_CODE);
  const removed = current.filter((c) => c !== SELF_SERVICE_BASELINE_ROLE_CODE && c !== newFunctionalCode);
  const result = [...new Set([...preserved, newFunctionalCode])].sort();
  return { preserved, removed, granted: newFunctionalCode, result };
}

/**
 * Roles to grant a newly created internal membership: the chosen functional
 * role plus the self-service baseline, unless the chosen role IS the baseline.
 *
 * Inviting somebody as HR used to produce `[hr]` alone, so the person just
 * hired could not open their own leave, payslips, attendance or tickets and
 * only found out after signing in.
 */
export function planInternalInviteRoles(chosenFunctionalCode: string): string[] {
  return chosenFunctionalCode === SELF_SERVICE_BASELINE_ROLE_CODE
    ? [SELF_SERVICE_BASELINE_ROLE_CODE]
    : [SELF_SERVICE_BASELINE_ROLE_CODE, chosenFunctionalCode].sort();
}