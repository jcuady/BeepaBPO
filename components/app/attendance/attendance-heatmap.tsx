"use client";

import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import {
  cellKind,
  cellLabel,
  cellMark,
  recordKey,
  type AttendanceStatus,
  type HeatmapKind,
} from "@/lib/attendance/heatmap";
import {
  AttendanceRecordDialog,
  type AttendanceDialogEmployee,
  type AttendanceDialogRecord,
} from "@/components/app/attendance/attendance-record-dialog";

export type HeatmapEmployee = {
  id: string;
  name: string;
  title: string | null;
};

export type HeatmapRecord = {
  id: string;
  employee_id: string;
  work_date: string;
  status: AttendanceStatus;
  clock_in_at: string | null;
  clock_out_at: string | null;
  approval_status: string;
};

const KIND_CLASS: Record<HeatmapKind, string> = {
  empty: "bg-[#e8eaee] text-slate",
  present: "bg-green text-white",
  late: "bg-[#f0c94d] text-navy",
  absent: "bg-[#f3c1c1] text-navy",
  incomplete: "bg-amber-100 text-amber-900",
  off: "bg-navy/15 text-navy",
};

const KIND_SWATCH: Record<HeatmapKind, string> = {
  empty: "bg-[#e8eaee]",
  present: "bg-green",
  late: "bg-[#f0c94d]",
  absent: "bg-[#f3c1c1]",
  incomplete: "bg-amber-100",
  off: "bg-navy/15",
};

function timeHm(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return format(d, "HH:mm");
}

export function AttendanceHeatmap({
  employees,
  dates,
  records,
  canManage,
}: {
  employees: HeatmapEmployee[];
  dates: string[];
  records: HeatmapRecord[];
  canManage: boolean;
}) {
  const byKey = useMemo(() => {
    const map = new Map<string, HeatmapRecord>();
    for (const row of records) {
      map.set(recordKey(row.employee_id, row.work_date), row);
    }
    return map;
  }, [records]);

  const [dialog, setDialog] = useState<{
    employee?: HeatmapEmployee;
    date: string;
    record?: HeatmapRecord;
    pickEmployee?: boolean;
  } | null>(null);

  const dialogEmployees: AttendanceDialogEmployee[] = employees.map((e) => ({
    id: e.id,
    name: e.name,
  }));
  const active = dialog;
  const dialogRecord: AttendanceDialogRecord | undefined = active?.record
    ? {
        id: active.record.id,
        status: active.record.status,
        clock_in: timeHm(active.record.clock_in_at),
        clock_out: timeHm(active.record.clock_out_at),
        approval_status: active.record.approval_status,
      }
    : undefined;
  const fallbackDate = dates[0] ?? "";
  const dialogDate = active?.date || fallbackDate;

  function openCell(employee: HeatmapEmployee, date: string) {
    setDialog({
      employee,
      date,
      record: byKey.get(recordKey(employee.id, date)),
    });
  }

  return (
    <div className="rounded-[16px] border border-line bg-white p-4 sm:p-5">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-separate border-spacing-y-2">
          <thead>
            <tr>
              <th className="w-40 px-2 text-left text-[11px] font-semibold tracking-wide text-slate uppercase">
                Team
              </th>
              {dates.map((date) => (
                <th
                  key={date}
                  className="px-1 text-center text-[11px] font-medium text-slate"
                >
                  {format(parseISO(date), "EEE d")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {employees.map((employee) => (
              <tr key={employee.id}>
                <td className="px-2 py-1 align-middle">
                  <p className="font-medium text-navy">{employee.name}</p>
                  {employee.title ? (
                    <p className="text-xs text-slate">{employee.title}</p>
                  ) : null}
                </td>
                {dates.map((date) => {
                  const rec = byKey.get(recordKey(employee.id, date));
                  const kind = cellKind(rec?.status);
                  const label = `${employee.name}, ${format(parseISO(date), "EEE d MMM")}, ${cellLabel(kind)}`;
                  const mark = cellMark(kind);
                  return (
                    <td key={date} className="px-1 py-1">
                      <button
                        type="button"
                        className={cn(
                          "mx-auto flex size-11 items-center justify-center rounded-[12px] text-xs font-semibold transition-colors",
                          KIND_CLASS[kind],
                          "cursor-pointer hover:ring-2 hover:ring-green-strong/40 focus-visible:ring-2 focus-visible:ring-green-strong focus-visible:outline-none",
                        )}
                        aria-label={`${label}. Open`}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          openCell(employee, date);
                        }}
                      >
                        {mark}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-3 text-xs text-slate">
        {(
          [
            "empty",
            "absent",
            "late",
            "present",
            "incomplete",
            "off",
          ] as HeatmapKind[]
        ).map((kind) => (
          <li key={kind} className="inline-flex items-center gap-1.5">
            <span
              className={cn(
                "inline-flex size-3.5 items-center justify-center rounded-[4px] text-[8px] font-bold",
                KIND_SWATCH[kind],
                kind === "present" ? "text-white" : "text-navy",
              )}
              aria-hidden
            >
              {cellMark(kind)}
            </span>
            {cellLabel(kind)}
          </li>
        ))}
      </ul>

      {canManage ? (
        <div className="mt-3">
          <button
            type="button"
            className="inline-flex min-h-11 items-center text-sm font-medium text-green-strong hover:underline"
            onClick={() =>
              setDialog({
                date: fallbackDate,
                pickEmployee: true,
              })
            }
          >
            Add attendance record
          </button>
        </div>
      ) : null}

      <AttendanceRecordDialog
        open={active != null}
        onOpenChange={(next) => {
          if (!next) setDialog(null);
        }}
        employee={active?.pickEmployee ? undefined : active?.employee}
        employees={dialogEmployees}
        workDate={dialogDate}
        dateLabel={
          dialogDate ? format(parseISO(dialogDate), "EEEE, MMM d") : ""
        }
        record={dialogRecord}
        canManage={canManage}
      />
    </div>
  );
}
