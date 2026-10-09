/**
 * Payroll period / record status coherence.
 *
 * `payroll_periods.status` and `payroll_records.status` are independent enums and
 * nothing in the schema used to keep them consistent. Live data proved the gap:
 * a period still in `draft` held ten `finalized` records totalling 500,000 in net
 * pay, and an employee could download the PDF.
 *
 * The rule this module encodes:
 *
 *   A payroll record is **payable** only when the record looks final *and* the
 *   parent period has been approved. Record status alone is never sufficient.
 *
 * Every surface that can expose money — the `/app/my/payroll` list, the payslip
 * PDF route, the seed script, the coherence audit, and the database trigger in
 * `20261007130000_payroll_record_status_coherence.sql` — must agree on where
 * that line sits. They did not: the list and the route agreed with each other,
 * while the seed script finalized records without ever touching the period. One
 * definition, imported everywhere, is what stops that from drifting again.
 *
 * `lib/payroll/actions.ts` is the only place allowed to move a period to
 * `finalized`, and it does so *before* cascading `finalized` to its records.
 * That ordering is what lets the database trigger permit the legitimate path.
 */

/** A period in one of these states has been signed off; its records are payable. */
export const APPROVED_PERIOD_STATUSES = ["finalized", "disbursed", "closed"] as const;

/**
 * Record states that make money payable to an employee.
 *
 * `approved` is included because the enum has it, but the current app never
 * writes it for payroll records — period approval jumps straight to `finalized`.
 * It is listed so the rule does not have to change if that step is ever added.
 */
export const PAYABLE_RECORD_STATUSES = ["finalized", "paid", "approved"] as const;

/**
 * Record states that must never exist inside an unapproved period.
 *
 * Narrower than {@link PAYABLE_RECORD_STATUSES}: `approved` is a legitimate
 * intermediate state (a record signed off while the period is still working
 * through its own approval chain), whereas `finalized` and `paid` assert that
 * the money is owed. This is the set the database trigger rejects.
 */
export const PAYOUT_RECORD_STATUSES = ["finalized", "paid"] as const;

export type PeriodStatus = string | null | undefined;

/** Has this period been approved? `null`/`undefined` means "no". */
export function isPeriodApproved(status: PeriodStatus): boolean {
  return (
    typeof status === "string" &&
    (APPROVED_PERIOD_STATUSES as readonly string[]).includes(status)
  );
}

/**
 * Does the record's own status look final, ignoring the period?
 *
 * Exposed separately so callers can tell the employee *which* of the two
 * conditions is blocking them: "not finalized yet" is routine, "this run isn't
 * approved" is the one worth explaining.
 */
export function isRecordStatusPayable(recordStatus: string): boolean {
  return (PAYABLE_RECORD_STATUSES as readonly string[]).includes(recordStatus);
}

/**
 * May this employee see and download this payslip?
 *
 * Both conditions, never either one alone. The period check is the load-bearing
 * one: it is what closes the exposure when a record was finalized out of band.
 */
export function isRecordPayable(
  recordStatus: string,
  periodStatus: PeriodStatus,
): boolean {
  if (!isRecordStatusPayable(recordStatus)) {
    return false;
  }
  return isPeriodApproved(periodStatus);
}

/**
 * The strongest record status a period may hold.
 *
 * Used by seed scripts so they derive status from the period instead of
 * choosing it. An unapproved period can only contain `calculated` records; an
 * approved one may contain `finalized` records.
 */
export function deriveRecordStatusFromPeriod(
  periodStatus: PeriodStatus,
): "calculated" | "finalized" {
  return isPeriodApproved(periodStatus) ? "finalized" : "calculated";
}

/**
 * Would writing `recordStatus` into a period at `periodStatus` break the
 * invariant? Mirrors the database trigger, so callers can fail fast in
 * application code with the same message the database would produce.
 */
export function violatesStatusCoherence(
  recordStatus: string,
  periodStatus: PeriodStatus,
): boolean {
  if (!(PAYOUT_RECORD_STATUSES as readonly string[]).includes(recordStatus)) {
    return false;
  }
  return !isPeriodApproved(periodStatus);
}