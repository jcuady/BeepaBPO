/** Pure SLA helpers for tickets (resolution deadline on `sla_due_at`). */

export type TicketSlaState =
  | "none"
  | "on_track"
  | "at_risk"
  | "breached"
  | "met";

export type TicketSlaInput = {
  slaDueAt: string | null;
  resolvedAt?: string | null;
  status: string;
  /** ISO created_at — used for at-risk window when open. */
  createdAt?: string | null;
  now?: Date;
};

const CLOSED = new Set(["resolved", "closed"]);

/** Remaining time ≤ 25% of total window (or ≤ 2h) → at_risk. */
export function evaluateTicketSla(input: TicketSlaInput): {
  state: TicketSlaState;
  label: string;
} {
  if (!input.slaDueAt) {
    return { state: "none", label: "No SLA" };
  }

  const due = new Date(input.slaDueAt).getTime();
  if (Number.isNaN(due)) {
    return { state: "none", label: "No SLA" };
  }

  const now = (input.now ?? new Date()).getTime();
  const closed = CLOSED.has(input.status);

  if (closed) {
    const resolvedMs = input.resolvedAt
      ? new Date(input.resolvedAt).getTime()
      : now;
    if (!Number.isNaN(resolvedMs) && resolvedMs <= due) {
      return { state: "met", label: "Met" };
    }
    return { state: "breached", label: "Breached" };
  }

  if (now > due) {
    return { state: "breached", label: "Breached" };
  }

  const createdMs = input.createdAt
    ? new Date(input.createdAt).getTime()
    : NaN;
  const totalMs = Number.isNaN(createdMs) ? null : due - createdMs;
  const remainingMs = due - now;
  const twoHours = 2 * 60 * 60 * 1000;
  const atRisk =
    remainingMs <= twoHours ||
    (totalMs != null && totalMs > 0 && remainingMs / totalMs <= 0.25);

  if (atRisk) {
    return { state: "at_risk", label: "At risk" };
  }

  return { state: "on_track", label: "On track" };
}

/** Share of tickets with SLA that are met or still on track / at risk (not breached). */
export function slaCompliancePercent(
  tickets: TicketSlaInput[],
  now?: Date,
): number | null {
  const scored = tickets
    .map((t) => evaluateTicketSla({ ...t, now }))
    .filter((r) => r.state !== "none");
  if (scored.length === 0) return null;
  const ok = scored.filter((r) => r.state !== "breached").length;
  return Math.round((ok / scored.length) * 100);
}
