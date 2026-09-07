import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { redirect } from "next/navigation";
import { IconFileText } from "@tabler/icons-react";
import { PageContainer } from "@/components/app/page-container";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { FilterBar } from "@/components/app/filter-bar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { resolveWorkspace, requirePermission } from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";
import { stringParam, ilikePattern } from "@/lib/app/search-params";

export const metadata: Metadata = { title: "Audit Log" };

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const workspace = await resolveWorkspace();
  if (!workspace) redirect("/login");
  requirePermission(workspace, "system.manage");

  const params = await searchParams;
  const q = stringParam(params.q);
  const pattern = q ? ilikePattern(q) : undefined;

  const supabase = await createClient();
  let query = supabase
    .from("audit_logs")
    .select(
      "id, action, entity_type, entity_id, created_at, profiles:actor_user_id(display_name)",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (pattern) {
    query = query.or(`action.ilike.${pattern},entity_type.ilike.${pattern}`);
  }

  const { data: logs } = await query;

  return (
    <PageContainer>
      <PageHeader
        name={workspace.profile.first_name}
        subtitle="Recent audited mutations."
      />

      <form method="get">
        <FilterBar
          placeholder="Search action or entity type…"
          defaultValue={q}
        />
      </form>

      {!logs?.length ? (
        <EmptyState
          icon={IconFileText}
          title="No audit entries"
          description="Mutations that write audit logs will appear here."
        />
      ) : (
        <div className="overflow-x-auto rounded-[16px] border border-line bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((row) => {
                const actor = row.profiles as { display_name: string } | null;
                return (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium text-navy">
                      {row.action}
                    </TableCell>
                    <TableCell className="text-slate">
                      {row.entity_type}
                      {row.entity_id
                        ? ` · ${row.entity_id.slice(0, 8)}`
                        : ""}
                    </TableCell>
                    <TableCell className="text-slate">
                      {actor?.display_name ?? "System"}
                    </TableCell>
                    <TableCell className="text-slate">
                      {format(new Date(row.created_at), "MMM d, yyyy h:mm a")}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Link
        href="/app/admin"
        className="text-sm font-medium text-green-strong hover:underline"
      >
        ← Back to admin
      </Link>
    </PageContainer>
  );
}
