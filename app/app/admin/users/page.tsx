import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { IconUsers } from "@tabler/icons-react";
import { PageContainer } from "@/components/app/page-container";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { FilterBar } from "@/components/app/filter-bar";
import { StatusBadge } from "@/components/app/status-badge";
import { AdminInviteForm } from "@/components/app/admin/admin-invite-form";
import { AdminMembershipActions } from "@/components/app/admin/admin-membership-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { stringParam } from "@/lib/app/search-params";

export const metadata: Metadata = { title: "Users" };

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const workspace = await resolveWorkspace();
  if (!workspace) redirect("/login");
  requirePermission(workspace, "system.manage");

  const params = await searchParams;
  const q = stringParam(params.q);

  const supabase = await createClient();
  const { data: memberships } = await supabase
    .from("organization_memberships")
    .select(
      "id, status, membership_type, profiles:user_id(display_name, first_name, last_name), organizations(name, type), membership_roles(roles(name, code))",
    )
    .in("status", ["active", "invited"])
    .order("created_at", { ascending: false })
    .limit(100);

  // ponytail: membership search spans nested joins; in-memory after DB fetch (≤100). Upgrade: search RPC.
  const filtered = (memberships ?? []).filter((row) => {
    if (!q) return true;
    const term = q.toLowerCase();
    const profile = row.profiles as {
      display_name: string;
      first_name: string;
      last_name: string;
    } | null;
    const org = row.organizations as { name: string } | null;
    const roles = (row.membership_roles as { roles: { name: string } }[] | null)
      ?.map((mr) => mr.roles.name)
      .join(" ");
    return [profile?.display_name, profile?.first_name, profile?.last_name, org?.name, roles]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(term);
  });

  return (
    <PageContainer>
      <PageHeader
        name={workspace.profile.first_name}
        subtitle="Invite teammates, change internal roles, or revoke access."
      />

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base text-navy">
            Invite internal user
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AdminInviteForm />
        </CardContent>
      </Card>

      <form method="get">
        <FilterBar placeholder="Search users…" defaultValue={q} />
      </form>

      {filtered.length === 0 ? (
        <EmptyState
          icon={IconUsers}
          title="No users found"
          description="Active and invited memberships will appear here."
        />
      ) : (
        <div className="overflow-x-auto rounded-[16px] border border-line bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Organization</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[220px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row) => {
                const profile = row.profiles as {
                  display_name: string;
                  first_name: string;
                  last_name: string;
                } | null;
                const org = row.organizations as {
                  name: string;
                  type: string;
                } | null;
                const roleRows =
                  (row.membership_roles as
                    | { roles: { name: string; code: string } }[]
                    | null) ?? [];
                const roles =
                  roleRows.map((mr) => mr.roles.name).join(", ") || "—";
                const primaryRoleCode = roleRows[0]?.roles.code ?? null;
                const protectedRoles = roleRows.some((mr) =>
                  ["owner", "super_admin"].includes(mr.roles.code),
                );
                const name =
                  profile?.display_name ||
                  [profile?.first_name, profile?.last_name]
                    .filter(Boolean)
                    .join(" ") ||
                  "User";

                return (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium text-navy">
                      {name}
                    </TableCell>
                    <TableCell className="text-slate">
                      {org?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-slate">{roles}</TableCell>
                    <TableCell>
                      <StatusBadge status={row.membership_type} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={row.status} />
                    </TableCell>
                    <TableCell>
                      <AdminMembershipActions
                        membershipId={row.id}
                        membershipType={row.membership_type}
                        currentRoleCode={primaryRoleCode}
                        protectedRoles={protectedRoles}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>          </Table>
        </div>
      )}

      <Link
        href="/app/admin"
        className="inline-flex min-h-11 items-center text-sm font-medium text-green-strong hover:underline"
      >
        ← Back to admin
      </Link>
    </PageContainer>
  );
}
