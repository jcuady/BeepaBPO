import type { Metadata } from "next";
import { format } from "date-fns";
import { IconCash } from "@tabler/icons-react";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { FilterBar, FilterSelect } from "@/components/app/filter-bar";
import { ListPager } from "@/components/app/list-pager";
import { CashAdvanceForm } from "@/components/app/cash-advance/cash-advance-form";
import { resolveWorkspace } from "@/lib/auth/workspace";
import { resolveEmployeeForUser } from "@/lib/employees/resolve";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageContainer } from "@/components/app/page-container";
import { enumParam, pageParam } from "@/lib/app/search-params";

export const metadata: Metadata = { title: "Cash Advances" };

const PAGE_SIZE = 20;
const STATUSES = [
  "pending",
  "hr_review",
  "finance_review",
  "approved",
  "rejected",
  "released",
  "completed",
  "cancelled",
] as const;

export default async function MyCashAdvancesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const workspace = await resolveWorkspace();
  if (!workspace) redirect("/login");

  const params = await searchParams;
  const status = enumParam(params.status, STATUSES);
  const page = pageParam(params.page);

  const employee = await resolveEmployeeForUser(workspace.user.id);
  const supabase = await createClient();

  let requests: {
    id: string;
    requested_amount: number;
    remaining_balance: number;
    status: string;
    reason: string;
    created_at: string;
  }[] = [];

  if (employee) {
    let q = supabase
      .from("cash_advance_requests")
      .select("id, requested_amount, remaining_balance, status, reason, created_at")
      .eq("employee_id", employee.id)
      .order("created_at", { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    if (status) q = q.eq("status", status);
    const { data } = await q;
    requests = data ?? [];
  }

  return (
    <PageContainer>
      <PageHeader
        name={workspace.profile.first_name}
        subtitle="Request and track cash advances."
      />

      <Card className="">
        <CardHeader>
          <CardTitle className="font-display text-base text-navy">
            New request
          </CardTitle>
        </CardHeader>
        <CardContent>
          {employee ? (
            <CashAdvanceForm />
          ) : (
            <p className="text-sm text-slate">
              Link your employee profile to request a cash advance.
            </p>
          )}
        </CardContent>
      </Card>

      <form method="get">
        <FilterBar showSearch={false}>
          <FilterSelect
            name="status"
            label="Status"
            defaultValue={status ?? ""}
            options={[
              { value: "", label: "All statuses" },
              ...STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, " ") })),
            ]}
          />
        </FilterBar>
      </form>

      {requests.length === 0 ? (
        <EmptyState
          icon={IconCash}
          title="No cash advance requests"
          description="Your submitted requests will appear here."
        />
      ) : (
        <div className="space-y-2">
          {requests.map((row) => (
            <Card key={row.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium text-navy">
                    ₱{Number(row.requested_amount).toLocaleString()}
                  </p>
                  <p className="text-sm text-slate">{row.reason}</p>
                  <p className="text-xs text-slate">
                    {format(new Date(row.created_at), "MMM d, yyyy")}
                  </p>
                </div>
                <Badge variant="outline" className="capitalize">
                  {row.status.replace(/_/g, " ")}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ListPager
        page={page}
        pageSize={PAGE_SIZE}
        rowCount={requests.length}
        query={{ status }}
      />
    </PageContainer>
  );
}