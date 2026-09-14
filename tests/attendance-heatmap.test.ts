import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  cellKind,
  cellMark,
  mondayYmd,
  rowMatchesFilter,
  shiftWeek,
  weekDates,
  weekStartParam,
} from "@/lib/attendance/heatmap";
import { attendanceRecordUpsertSchema } from "@/lib/validation/app";

describe("attendance heatmap helpers", () => {
  it("snaps week query to Monday and rejects junk", () => {
    expect(weekStartParam("2026-09-16")).toBe("2026-09-14");
    expect(weekStartParam("nope")).toBe(mondayYmd());
    expect(weekDates("2026-09-14")).toEqual([
      "2026-09-14",
      "2026-09-15",
      "2026-09-16",
      "2026-09-17",
      "2026-09-18",
      "2026-09-19",
      "2026-09-20",
    ]);
    expect(shiftWeek("2026-09-14", 1)).toBe("2026-09-21");
  });

  it("maps statuses to heatmap kinds with marks (not color-only)", () => {
    expect(cellKind(undefined)).toBe("empty");
    expect(cellKind("present")).toBe("present");
    expect(cellKind("late")).toBe("late");
    expect(cellKind("absent")).toBe("absent");
    expect(cellKind("leave")).toBe("off");
    expect(cellMark("present")).toBe("P");
    expect(rowMatchesFilter(["empty", "present"], "present")).toBe(true);
    expect(rowMatchesFilter(["empty", "late"], "absent")).toBe(false);
  });

  it("accepts empty id and clock fields from the cell modal", () => {
    const parsed = attendanceRecordUpsertSchema.safeParse({
      id: "",
      employee_id: "11111111-1111-4111-8111-111111111111",
      work_date: "2026-09-14",
      status: "present",
      clock_in: "",
      clock_out: "",
    });
    expect(parsed.success).toBe(true);
  });
});

describe("attendance heatmap CRUD seams", () => {
  it("staff attendance page uses heatmap + manage actions", () => {
    const page = readFileSync(
      join(process.cwd(), "app/app/attendance/page.tsx"),
      "utf8",
    );
    const actions = readFileSync(
      join(process.cwd(), "lib/attendance/manage.ts"),
      "utf8",
    );
    const sql = readFileSync(
      join(
        process.cwd(),
        "supabase/migrations/20260914233000_attendance_heatmap_crud.sql",
      ),
      "utf8",
    );
    const heatmapUi = readFileSync(
      join(
        process.cwd(),
        "components/app/attendance/attendance-heatmap.tsx",
      ),
      "utf8",
    );
    expect(page).toContain("AttendanceHeatmap");
    expect(page).toContain("attendance.manage");
    expect(page).toContain("Hide heatmap");
    expect(heatmapUi).toContain("openCell");
    expect(heatmapUi).toContain("AttendanceRecordDialog");
    expect(actions).toContain("export async function upsertAttendanceRecord");
    expect(actions).toContain("export async function deleteAttendanceRecord");
    expect(actions).toContain('can(workspace.permissions, "attendance.manage")');
    expect(actions).toContain("finalized");
    expect(sql).toContain("attendance_records_delete");
    expect(sql).toContain("super_admin");
  });
});
