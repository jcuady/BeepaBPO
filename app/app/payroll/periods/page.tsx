import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { FilterBar, FilterSelect } from "@/components/app/filter-bar";
import { ListPager } from "@/components/app/list-pager";
import { resolveWorkspace, requirePermission, requireInternal } from "@/lib/auth/workspace";
import { can } from "@/lib/permissions/can";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { IconCoin } from "@tabler/icons-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageContainer } from "@/components/app/page-container";
import { PayrollRunWizard } from "@/components/app/payroll/payroll-run-wizard";
import { enumParam, pageParam } from "@/lib/app/search-params";

export const metadata: Metadata = { title: "Payroll Periods" };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const PERIOD_STATUSES = [
  "draft",
  "preparing",
  "review",
  "approval",
  "finalized",
  "disbursed",
  "closed",
] as const;
const PAGE_SIZE = 24;

function showDate(iso: string) {
  const [year, month, day] = iso.slice(0, 10).split("-");
  return `${MONTHS[Number(month) - 1]} ${Number(day)}, ${year}`;
}

export default async function PayrollPeriodsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const workspace = await resolveWorkspace();
  if (!workspace) redirect("/login");
  requireInternal(workspace);
  requirePermission(workspace, "payroll.read");

  const params = await searchParams;
  const status = enumParam(params.status, PERIOD_STATUSES);
  const page = pageParam(params.page);

  const canManage = can(workspace.permissions, "payroll.manage");
  const supabase = await createClient();

  // Two queries: one for the wizard context (latest 12), one for the filtered list.
  let listQuery = supabase
    .from("payroll_periods")
    .select("id, name, start_date, end_date, pay_date, status")
    .order("start_date", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  if (status) listQuery = listQuery.eq("status", status);

  const [{ data: periodRows }, { data: periodCtx }] = await Promise.all([
    listQuery,
    canManage
      ? supabase
          .from("payroll_periods")
          .select("name, start_date, end_date")
          .order("start_date", { ascending: false })
          .limit(12)
      : Promise.resolve({ data: [] as { name: string; start_date: string; end_date: string }[] }),
  ]);

  // One extra row proves a next page exists; drop it so rowCount is the rendered count.
  const periods = periodRows?.slice(0, PAGE_SIZE);

  return (
    <PageContainer>
      <PageHeader
        title="Payroll Periods"
        name={workspace.profile.first_name}
        subtitle="Open payroll cycles and review employee draft records."
      />

      {canManage ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">New payroll run</CardTitle>
          </CardHeader>
          <CardContent>
            <PayrollRunWizard periods={periodCtx ?? []} />
          </CardContent>
        </Card>
      ) : null}

      <form method="get">
        <FilterBar showSearch={false}>
          <FilterSelect
            name="status"
            label="Status"
            defaultValue={status ?? ""}
            options={[
              { value: "", label: "All statuses" },
              ...PERIOD_STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, " ") })),
            ]}
          />
        </FilterBar>
      </form>

      {!periods?.length ? (
        <EmptyState
          icon={IconCoin}
          title={status ? "No runs in this status" : "No payroll periods"}
          description={
            status
              ? "Choose another status, or open a run for the current cutoff."
              : canManage
                ? "Use the payroll run steps above. A cutoff that already has a run cannot be opened again."
                : "Ask finance to open a period, or use seed data in demo environments."
          }
        />
      ) : (
        <div className="space-y-2">
          {periods.map((period) => (
            <Card key={period.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <Link
                  href={`/app/payroll/periods/${period.id}`}
                  className="flex min-h-11 min-w-0 flex-1 items-center"
                >
                  <p className="font-medium text-base text-navy sm:text-sm">{period.name}</p>
                  <p className="text-base text-slate sm:text-sm">
                    {showDate(period.start_date)} to {showDate(period.end_date)} · Pay{" "}
                    {showDate(period.pay_date)}
                  </p>
                </Link>
                <Badge variant="outline" className="capitalize">
                  {period.status}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ListPager
        page={page}
        pageSize={PAGE_SIZE}
        rowCount={periods?.length ?? 0}
        query={{ status }}
      />
    </PageContainer>
  );
}