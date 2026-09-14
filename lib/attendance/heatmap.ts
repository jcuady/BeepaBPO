import { addDays, format, parseISO, startOfWeek } from "date-fns";
import type { Database } from "@/types/database";

export type AttendanceStatus =
  Database["public"]["Enums"]["attendance_record_status"];

export type HeatmapKind =
  | "empty"
  | "present"
  | "late"
  | "absent"
  | "incomplete"
  | "off";

export const HEATMAP_FILTERS = [
  "all",
  "present",
  "late",
  "absent",
  "empty",
  "incomplete",
  "off",
] as const;

export type HeatmapFilter = (typeof HEATMAP_FILTERS)[number];

const OFF_STATUSES = new Set<AttendanceStatus>([
  "leave",
  "rest_day",
  "holiday",
]);

export function mondayYmd(date = new Date()): string {
  return format(startOfWeek(date, { weekStartsOn: 1 }), "yyyy-MM-dd");
}

/** Clamp a `week` query to a Monday `yyyy-MM-dd`. Junk → this week's Monday. */
export function weekStartParam(
  value: string | string[] | undefined,
): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return mondayYmd();
  const parsed = parseISO(raw);
  if (Number.isNaN(parsed.getTime())) return mondayYmd();
  return mondayYmd(parsed);
}

export function weekDates(monday: string): string[] {
  const start = parseISO(monday);
  return Array.from({ length: 7 }, (_, i) => format(addDays(start, i), "yyyy-MM-dd"));
}

export function shiftWeek(monday: string, deltaWeeks: number): string {
  return format(addDays(parseISO(monday), deltaWeeks * 7), "yyyy-MM-dd");
}

export function cellKind(
  status: AttendanceStatus | null | undefined,
): HeatmapKind {
  if (!status) return "empty";
  if (status === "present" || status === "late" || status === "absent") {
    return status;
  }
  if (status === "incomplete") return "incomplete";
  if (OFF_STATUSES.has(status)) return "off";
  return "empty";
}

export function cellMark(kind: HeatmapKind): string {
  switch (kind) {
    case "present":
      return "P";
    case "late":
      return "L";
    case "absent":
      return "A";
    case "incomplete":
      return "I";
    case "off":
      return "O";
    default:
      return "";
  }
}

export function cellLabel(kind: HeatmapKind): string {
  switch (kind) {
    case "present":
      return "Present";
    case "late":
      return "Late";
    case "absent":
      return "Absent";
    case "incomplete":
      return "Incomplete";
    case "off":
      return "Off";
    default:
      return "Empty";
  }
}

export function rowMatchesFilter(
  kinds: HeatmapKind[],
  filter: HeatmapFilter,
): boolean {
  if (filter === "all") return true;
  return kinds.includes(filter);
}

export function recordKey(employeeId: string, workDate: string): string {
  return `${employeeId}:${workDate}`;
}
