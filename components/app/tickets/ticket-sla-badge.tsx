import { format } from "date-fns";
import { StatusBadge } from "@/components/app/status-badge";
import { evaluateTicketSla } from "@/lib/tickets/sla";

type Props = {
  slaDueAt: string | null;
  resolvedAt?: string | null;
  status: string;
  createdAt?: string | null;
  showDue?: boolean;
};

export function TicketSlaBadge({
  slaDueAt,
  resolvedAt,
  status,
  createdAt,
  showDue = true,
}: Props) {
  const { state, label } = evaluateTicketSla({
    slaDueAt,
    resolvedAt,
    status,
    createdAt,
  });

  if (state === "none") {
    return (
      <span className="text-xs text-slate" title="No SLA policy applied">
        No SLA
      </span>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <StatusBadge status={state} />
      {showDue && slaDueAt ? (
        <span className="text-xs text-slate">
          Due {format(new Date(slaDueAt), "MMM d, h:mm a")}
          <span className="sr-only"> ({label})</span>
        </span>
      ) : null}
    </span>
  );
}
