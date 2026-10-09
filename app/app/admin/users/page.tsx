import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { IconUsers } from "@tabler/icons-react";
import { PageContainer } from "@/components/app/page-container";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { FilterBar, FilterSelect } from "@/components/app/filter-bar";
import { ListPager } from "@/components/app/list-pager";
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
import {
  resolveWorkspace,
  requirePermission,
  requireInternal,
} from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";
import { stringParam, ilikePattern, pageParam } from "@/lib/app/search-params";

export const metadata: Metadata = { title: "Users" };

const PAGE_SIZE = 25;

type MembershipRow = {
  id: string;
  status: string;
  membership_type: string;
  profiles: unknown;
  organizations: unknown;
  membership_roles: unknown;
};

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const workspace = await resolveWorkspace();
  if (!workspace) redirect("/login");
  requireInternal(workspace);
  requirePermission(workspace, "system.manage");

  const params = await searchParams;
  const q = stringParam(params.q);
  const roleCode = stringParam(params.role);
  const page = pageParam(params.page);
  const pattern = q ? ilikePattern(q) : undefined;

  const supabase = await createClient();

  // Roles are read from the database, not hardcoded. `admin-invite-form.tsx`
  // has a ROLE_OPTIONS list but it is deliberately a *subset* — it omits Owner
  // and Super Admin because you cannot invite yourself as one. Reusing it here
  // would make "who has Owner?" unanswerable, which is one of the questions this
  // filter exists to answer.
  const { data: availableRoles } = await supabase
    .from("roles")
    .select("id, code, name")
    .order("name", { ascending: true });

  let roleIds: string[] | null = null;
  if (roleCode) {
    const role = (availableRoles ?? []).find((r) => r.code === roleCode);
    const { data: membershipRoles } = role
      ? await supabase
          .from("membership_roles")
          .select("membership_id")
          .eq("role_id", role.id)
          // Bounded because these ids are inlined into a PostgREST `.in()`
          // filter on the next query, and a URL has a length ceiling. Matches
          // the caps on the text-search sub-queries below; a role held by more
          // people than that would report an undercount, which is preferable to
          // a 414 and a page that renders nothing at all.
          .limit(1000)
      : { data: [] as { membership_id: string }[] };
    roleIds = (membershipRoles ?? []).map((r) => r.membership_id);
  }

  let userIds: string[] = [];
  let orgIds: string[] = [];
  if (pattern) {
    const [{ data: profiles }, { data: orgs }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id")
        .or(
          `display_name.ilike.${pattern},first_name.ilike.${pattern},last_name.ilike.${pattern}`,
        )
        .limit(100),
      supabase
        .from("organizations")
        .select("id")
        .ilike("name", pattern)
        .limit(50),
    ]);
    userIds = (profiles ?? []).map((p) => p.id);
    orgIds = (orgs ?? []).map((o) => o.id);
  }

  let memberships: MembershipRow[] = [];

  // A selected role that matches nobody short-circuits, exactly like a text
  // search with no hits. Without this, `.in("id", [])` has to be sent to
  // PostgREST and its empty-list behaviour relied upon.
  const roleExhausted = roleIds !== null && roleIds.length === 0;
  const textExhausted = !!pattern && userIds.length === 0 && orgIds.length === 0;

  if (roleExhausted || textExhausted) {
    memberships = [];
  } else {
    let query = supabase
      .from("organization_memberships")
      .select(
        "id, status, membership_type, profiles:user_id(display_name, first_name, last_name), organizations(name, type), membership_roles(roles(name, code))",
      )
      .in("status", ["active", "invited"])
      .order("created_at", { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

    // PostgREST ANDs separate filter calls, so the role narrowing and the text
    // narrowing compose. A single `.or()` cannot express "role X AND name Y",
    // which is why the role filter constrains `id` rather than joining inline.
    if (roleIds) query = query.in("id", roleIds);

    if (pattern) {
      const parts: string[] = [];
      if (userIds.length) parts.push(`user_id.in.(${userIds.join(",")})`);
      if (orgIds.length) parts.push(`organization_id.in.(${orgIds.join(",")})`);
      query = query.or(parts.join(","));
    }

    const { data } = await query;
    memberships = (data ?? []) as MembershipRow[];
  }

  return (
    <PageContainer>
      <PageHeader
        title="Users"
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
        <FilterBar placeholder="Search by name or organization…" defaultValue={q}>
          <FilterSelect
            name="role"
            label="Role"
            defaultValue={roleCode}
            options={[
              { value: "", label: "All roles" },
              ...(availableRoles ?? []).map((r) => ({
                value: r.code,
                label: r.name,
              })),
            ]}
          />
        </FilterBar>
      </form>

      {memberships.length === 0 ? (
        <EmptyState
          icon={IconUsers}
          title={
            q || roleCode ? "No users match those filters" : "No users found"
          }
          description={
            q || roleCode
              ? "Try a different role, or clear the search box to match everyone."
              : "Active and invited memberships will appear here."
          }
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
              {memberships.map((row) => {
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
            </TableBody>
          </Table>
        </div>
      )}

      <ListPager
        page={page}
        pageSize={PAGE_SIZE}
        rowCount={memberships.length}
        // Both filters must survive a page change. Listing only `q` meant
        // paging forward from ?role=owner silently widened the result to every
        // role — the admin asked a question, got an answer, and the answer
        // described a different population.
        query={{ q, role: roleCode }}
      />

      <Link
        href="/app/admin"
        className="inline-flex min-h-11 items-center text-sm font-medium text-green-strong hover:underline"
      >
        ← Back to admin
      </Link>
    </PageContainer>
  );
}
