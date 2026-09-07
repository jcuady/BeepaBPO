import { NextResponse } from "next/server";
import { resolveWorkspace } from "@/lib/auth/workspace";
import { logAudit } from "@/lib/audit/log";
import { can } from "@/lib/permissions/can";
import { BEEPA_ORG_ID } from "@/lib/permissions/codes";
import {
  isReportDataset,
  rowsToCsv,
  type ReportDataset,
} from "@/lib/reports/csv";
import { createClient } from "@/lib/supabase/server";

// ponytail: hard cap per export; raise or stream if reports grow past ~2k rows.
const ROW_LIMIT = 2000;

function csvResponse(filename: string, body: string) {
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(request: Request) {
  const workspace = await resolveWorkspace();
  if (!workspace) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!can(workspace.permissions, "reports.export")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const datasetParam =
    new URL(request.url).searchParams.get("dataset") ?? "snapshot";
  if (!isReportDataset(datasetParam)) {
    return NextResponse.json(
      {
        error: `Unknown dataset. Use one of: snapshot, employees, attendance, tickets, leads.`,
      },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const dataset = datasetParam as ReportDataset;
  let csv: string;
  let filename: string;

  switch (dataset) {
    case "snapshot": {
      const [
        { count: employees },
        { count: present },
        { count: tickets },
        { count: leads },
      ] = await Promise.all([
        supabase
          .from("employees")
          .select("*", { count: "exact", head: true })
          .eq("employment_status", "active"),
        supabase
          .from("attendance_records")
          .select("*", { count: "exact", head: true })
          .eq("work_date", today)
          .in("status", ["present", "late"]),
        supabase
          .from("tickets")
          .select("*", { count: "exact", head: true })
          .not("status", "in", "(resolved,closed)"),
        supabase.from("crm_leads").select("*", { count: "exact", head: true }),
      ]);
      csv = rowsToCsv(
        ["metric", "value", "as_of"],
        [
          ["active_employees", employees ?? 0, today],
          ["present_today", present ?? 0, today],
          ["open_tickets", tickets ?? 0, today],
          ["crm_leads", leads ?? 0, today],
        ],
      );
      filename = `beepa-snapshot-${today}.csv`;
      break;
    }
    case "employees": {
      const { data, error } = await supabase
        .from("employees")
        .select(
          "employee_number, job_title, employment_status, employment_type, work_email, hire_date",
        )
        .eq("employment_status", "active")
        .order("employee_number")
        .limit(ROW_LIMIT);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      csv = rowsToCsv(
        [
          "employee_number",
          "job_title",
          "employment_status",
          "employment_type",
          "work_email",
          "hire_date",
        ],
        (data ?? []).map((row) => [
          row.employee_number,
          row.job_title,
          row.employment_status,
          row.employment_type,
          row.work_email,
          row.hire_date,
        ]),
      );
      filename = `beepa-employees-${today}.csv`;
      break;
    }
    case "attendance": {
      const { data, error } = await supabase
        .from("attendance_records")
        .select(
          "work_date, status, approval_status, worked_minutes, late_minutes, clock_in_at, clock_out_at, employees(employee_number, job_title)",
        )
        .eq("work_date", today)
        .in("status", ["present", "late"])
        .order("clock_in_at", { ascending: true })
        .limit(ROW_LIMIT);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      csv = rowsToCsv(
        [
          "work_date",
          "employee_number",
          "job_title",
          "status",
          "approval_status",
          "worked_minutes",
          "late_minutes",
          "clock_in_at",
          "clock_out_at",
        ],
        (data ?? []).map((row) => {
          const emp = row.employees as {
            employee_number: string;
            job_title: string;
          } | null;
          return [
            row.work_date,
            emp?.employee_number ?? "",
            emp?.job_title ?? "",
            row.status,
            row.approval_status,
            row.worked_minutes,
            row.late_minutes,
            row.clock_in_at,
            row.clock_out_at,
          ];
        }),
      );
      filename = `beepa-attendance-${today}.csv`;
      break;
    }
    case "tickets": {
      const { data, error } = await supabase
        .from("tickets")
        .select(
          "ticket_number, subject, category, priority, status, assigned_team, created_at",
        )
        .not("status", "in", "(resolved,closed)")
        .order("created_at", { ascending: false })
        .limit(ROW_LIMIT);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      csv = rowsToCsv(
        [
          "ticket_number",
          "subject",
          "category",
          "priority",
          "status",
          "assigned_team",
          "created_at",
        ],
        (data ?? []).map((row) => [
          row.ticket_number,
          row.subject,
          row.category,
          row.priority,
          row.status,
          row.assigned_team,
          row.created_at,
        ]),
      );
      filename = `beepa-open-tickets-${today}.csv`;
      break;
    }
    case "leads": {
      const { data, error } = await supabase
        .from("crm_leads")
        .select(
          "company_name, contact_name, contact_email, contact_phone, industry, source, status, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(ROW_LIMIT);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      csv = rowsToCsv(
        [
          "company_name",
          "contact_name",
          "contact_email",
          "contact_phone",
          "industry",
          "source",
          "status",
          "created_at",
        ],
        (data ?? []).map((row) => [
          row.company_name,
          row.contact_name,
          row.contact_email,
          row.contact_phone,
          row.industry,
          row.source,
          row.status,
          row.created_at,
        ]),
      );
      filename = `beepa-crm-leads-${today}.csv`;
      break;
    }
  }

  await logAudit(supabase, {
    actorUserId: workspace.user.id,
    organizationId: BEEPA_ORG_ID,
    action: "reports.export",
    entityType: "report",
    entityId: dataset,
    after: { dataset, filename },
  });

  return csvResponse(filename, csv);
}
