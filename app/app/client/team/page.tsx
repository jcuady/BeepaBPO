import type { Metadata } from "next";
import { IconUsersGroup } from "@tabler/icons-react";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { getClientOrganizationId } from "@/lib/organizations/client";
import { resolveWorkspace } from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PageContainer } from "@/components/app/page-container";

export const metadata: Metadata = { title: "My Team" };

export default async function ClientTeamPage() {
  const workspace = await resolveWorkspace();
  if (!workspace) redirect("/login");

  const clientOrgId = getClientOrganizationId(workspace);
  const supabase = await createClient();

  let members: {
    employee_id: string | null;
    display_name: string | null;
    job_title: string | null;
    role_title: string | null;
    assignment_status: string | null;
    employee_number: string | null;
  }[] = [];

  if (clientOrgId) {
    const { data } = await supabase
      .from("client_visible_employees")
      .select(
        "employee_id, display_name, job_title, role_title, assignment_status, employee_number",
      )
      .eq("client_organization_id", clientOrgId)
      .order("display_name")
      .limit(200);
    members = data ?? [];
  }

  return (
    <PageContainer>
      <PageHeader
        name={workspace.profile.first_name}
        subtitle="Assigned roster and engagement status (not live clock-in)."
      />

      {!clientOrgId ? (
        <EmptyState
          icon={IconUsersGroup}
          title="No client organization"
          description="Your account is not linked to a client organization yet."
        />
      ) : members.length === 0 ? (
        <EmptyState
          icon={IconUsersGroup}
          title="No team members assigned"
          description="Your dedicated Beepa team roster will appear here."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {members.map((member) => {
            const name = member.display_name ?? member.employee_number ?? "Team member";
            const initials = name
              .split(" ")
              .map((p) => p[0])
              .join("")
              .slice(0, 2)
              .toUpperCase();
            return (
              <Card
                key={member.employee_id ?? member.employee_number}
                className=""
              >
                <CardContent className="flex items-start gap-3 p-4">
                  <Avatar className="size-10">
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-navy">{name}</p>
                    <p className="text-sm text-slate">
                      {member.role_title || member.job_title || "—"}
                    </p>
                    {member.assignment_status ? (
                      <Badge variant="outline" className="mt-2 capitalize">
                        {member.assignment_status.replace(/_/g, " ")}
                      </Badge>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}
