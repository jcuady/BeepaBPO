import { differenceInCalendarDays, format, parseISO } from "date-fns";

/**
 * The body a team lead sees when someone requests leave.
 *
 * Extracted from the server action so it can be tested directly. The action
 * previously hard-coded a single string, and the live table held 27 of them
 * byte-identical — a team lead reading the notification list had no way to tell
 * any two apart, which makes the notification useless for its only purpose.
 *
 * Every field here is something the recipient would otherwise have to open the
 * app to discover.
 */
export function buildLeaveRequestNotificationBody(input: {
  requesterName: string | null | undefined;
  leaveTypeName?: string | null;
  startDate: string;
  endDate: string;
}): string {
  const requester = input.requesterName?.trim() || "An employee";
  const days =
    differenceInCalendarDays(parseISO(input.endDate), parseISO(input.startDate)) + 1;
  const dayWord = days === 1 ? "day" : "days";
  const span =
    days <= 1
      ? format(parseISO(input.startDate), "MMM d")
      : `${format(parseISO(input.startDate), "MMM d")} – ${format(
          parseISO(input.endDate),
          "MMM d",
        )}`;

  const type = input.leaveTypeName?.trim();
  return type
    ? `${requester} requested ${days} ${dayWord} of ${type} (${span}).`
    : `${requester} requested ${days} ${dayWord} of leave (${span}).`;
}

/**
 * What the EMPLOYEE sees once the approval workflow finishes.
 *
 * Built from parts rather than by rewriting the pending body — stripping the
 * "X requested " prefix off that sentence produced
 * "Your 3 days of leave (Oct 30 – Nov 1). was approved by Demo HR.", with a
 * stray full stop and a sentence fragment in front of it.
 */
export function buildLeaveDecisionNotificationBody(input: {
  startDate: string;
  endDate: string;
  leaveTypeName?: string | null;
  approved: boolean;
  decidedBy?: string | null;
}): string {
  const days =
    differenceInCalendarDays(parseISO(input.endDate), parseISO(input.startDate)) + 1;
  const dayWord = days === 1 ? "day" : "days";
  const span =
    days <= 1
      ? format(parseISO(input.startDate), "MMM d")
      : `${format(parseISO(input.startDate), "MMM d")} – ${format(
          parseISO(input.endDate),
          "MMM d",
        )}`;

  const of = input.leaveTypeName?.trim() ? ` of ${input.leaveTypeName.trim()}` : "";
  const by = input.decidedBy?.trim() ? ` by ${input.decidedBy.trim()}` : "";
  const verdict = input.approved ? "approved" : "rejected";
  return `Your leave request for ${days} ${dayWord}${of} (${span}) was ${verdict}${by}.`;
}