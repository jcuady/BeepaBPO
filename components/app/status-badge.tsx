import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const attendanceStyles: Record<string, { label: string; className: string }> = {
  present: {
    label: "Present",
    className: "bg-soft-green text-green-strong border-transparent",
  },
  late: {
    label: "Late",
    className: "bg-lime/20 text-green-strong border-transparent",
  },
  absent: {
    label: "Absent",
    className: "bg-muted text-slate border-transparent",
  },
  leave: {
    label: "On Leave",
    className: "bg-orange-50 text-orange-700 border-transparent",
  },
  wfh: {
    label: "WFH",
    className: "bg-sky-50 text-sky-700 border-transparent",
  },
  rest_day: {
    label: "Rest Day",
    className: "bg-muted text-slate border-transparent",
  },
  holiday: {
    label: "Holiday",
    className: "bg-sky-50 text-sky-700 border-transparent",
  },
  incomplete: {
    label: "Incomplete",
    className: "bg-amber-50 text-amber-800 border-transparent",
  },
};

const entityStyles: Record<string, { label: string; className: string }> = {
  // shared
  pending: {
    label: "Pending",
    className: "bg-amber-50 text-amber-800 border-transparent",
  },
  approved: {
    label: "Approved",
    className: "bg-soft-green text-green-strong border-transparent",
  },
  rejected: {
    label: "Rejected",
    className: "bg-red-50 text-red-700 border-transparent",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-muted text-slate border-transparent",
  },
  invited: {
    label: "Invited",
    className: "bg-sky-50 text-sky-700 border-transparent",
  },
  // tickets
  new: {
    label: "New",
    className: "bg-sky-50 text-sky-700 border-transparent",
  },
  assigned: {
    label: "Assigned",
    className: "bg-sky-50 text-sky-700 border-transparent",
  },
  in_progress: {
    label: "In progress",
    className: "bg-lime/20 text-green-strong border-transparent",
  },
  waiting_for_client: {
    label: "Waiting",
    className: "bg-amber-50 text-amber-800 border-transparent",
  },
  resolved: {
    label: "Resolved",
    className: "bg-soft-green text-green-strong border-transparent",
  },
  closed: {
    label: "Closed",
    className: "bg-muted text-slate border-transparent",
  },
  // cash advance
  hr_review: {
    label: "HR review",
    className: "bg-amber-50 text-amber-800 border-transparent",
  },
  finance_review: {
    label: "Finance review",
    className: "bg-amber-50 text-amber-800 border-transparent",
  },
  released: {
    label: "Released",
    className: "bg-soft-green text-green-strong border-transparent",
  },
  completed: {
    label: "Completed",
    className: "bg-soft-green text-green-strong border-transparent",
  },
  // CRM
  contacted: {
    label: "Contacted",
    className: "bg-sky-50 text-sky-700 border-transparent",
  },
  qualified: {
    label: "Qualified",
    className: "bg-soft-green text-green-strong border-transparent",
  },
  unqualified: {
    label: "Unqualified",
    className: "bg-muted text-slate border-transparent",
  },
  converted: {
    label: "Converted",
    className: "bg-soft-green text-green-strong border-transparent",
  },
  lost: {
    label: "Lost",
    className: "bg-red-50 text-red-700 border-transparent",
  },
  // NTE (resolved shared with tickets)
  issued: {
    label: "Issued",
    className: "bg-amber-50 text-amber-800 border-transparent",
  },
  awaiting_response: {
    label: "Awaiting response",
    className: "bg-amber-50 text-amber-800 border-transparent",
  },
  under_review: {
    label: "Under review",
    className: "bg-sky-50 text-sky-700 border-transparent",
  },
  // ATS stages
  applied: {
    label: "Applied",
    className: "bg-sky-50 text-sky-700 border-transparent",
  },
  screening: {
    label: "Screening",
    className: "bg-lime/20 text-green-strong border-transparent",
  },
  initial_interview: {
    label: "Initial interview",
    className: "bg-lime/20 text-green-strong border-transparent",
  },
  assessment: {
    label: "Assessment",
    className: "bg-amber-50 text-amber-800 border-transparent",
  },
  client_endorsement: {
    label: "Client endorsement",
    className: "bg-amber-50 text-amber-800 border-transparent",
  },
  client_interview: {
    label: "Client interview",
    className: "bg-amber-50 text-amber-800 border-transparent",
  },
  offer: {
    label: "Offer",
    className: "bg-soft-green text-green-strong border-transparent",
  },
  hired: {
    label: "Hired",
    className: "bg-soft-green text-green-strong border-transparent",
  },
  withdrawn: {
    label: "Withdrawn",
    className: "bg-muted text-slate border-transparent",
  },
  talent_pool: {
    label: "Talent pool",
    className: "bg-sky-50 text-sky-700 border-transparent",
  },
  on_hold: {
    label: "On hold",
    className: "bg-amber-50 text-amber-800 border-transparent",
  },
  // priority
  low: { label: "Low", className: "bg-muted text-slate border-transparent" },
  normal: {
    label: "Normal",
    className: "bg-sky-50 text-sky-700 border-transparent",
  },
  high: {
    label: "High",
    className: "bg-amber-50 text-amber-800 border-transparent",
  },
  urgent: {
    label: "Urgent",
    className: "bg-red-50 text-red-700 border-transparent",
  },
  // employment / org
  active: {
    label: "Active",
    className: "bg-soft-green text-green-strong border-transparent",
  },
  draft: {
    label: "Draft",
    className: "bg-muted text-slate border-transparent",
  },
  // CMS / jobs
  published: {
    label: "Published",
    className: "bg-soft-green text-green-strong border-transparent",
  },
  archived: {
    label: "Archived",
    className: "bg-muted text-slate border-transparent",
  },
  // CRM deals
  new_lead: {
    label: "New lead",
    className: "bg-sky-50 text-sky-700 border-transparent",
  },
  discovery: {
    label: "Discovery",
    className: "bg-lime/20 text-green-strong border-transparent",
  },
  proposal: {
    label: "Proposal",
    className: "bg-amber-50 text-amber-800 border-transparent",
  },
  negotiation: {
    label: "Negotiation",
    className: "bg-amber-50 text-amber-800 border-transparent",
  },
  won: {
    label: "Won",
    className: "bg-soft-green text-green-strong border-transparent",
  },
  follow_up_later: {
    label: "Follow up later",
    className: "bg-muted text-slate border-transparent",
  },
};

const allStyles = { ...attendanceStyles, ...entityStyles };

type StatusBadgeProps = {
  status: string;
  className?: string;
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = allStyles[status] ?? {
    label: status.replace(/_/g, " "),
    className: "bg-muted text-slate border-transparent",
  };

  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
        config.className,
        className,
      )}
    >
      {config.label}
    </Badge>
  );
}
