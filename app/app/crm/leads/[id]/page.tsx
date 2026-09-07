import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { notFound, redirect } from "next/navigation";
import { PageContainer } from "@/components/app/page-container";
import { PageHeader } from "@/components/app/page-header";
import { LeadStatusForm } from "@/components/app/crm/lead-status-form";
import { CreateDealForm } from "@/components/app/crm/create-deal-form";
import { StatusBadge } from "@/components/app/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { resolveWorkspace, requirePermission } from "@/lib/auth/workspace";
import { can } from "@/lib/permissions/can";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "CRM Lead" };

export default async function CrmLeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const workspace = await resolveWorkspace();
  if (!workspace) redirect("/login");
  requirePermission(workspace, "crm.read");

  const supabase = await createClient();
  const [{ data: lead }, { data: activities }] = await Promise.all([
    supabase
      .from("crm_leads")
      .select(
        "id, company_name, contact_name, contact_email, contact_phone, industry, status, source, notes, created_at, updated_at",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("crm_activities")
      .select("id, activity_type, subject, body, created_at")
      .eq("lead_id", id)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  if (!lead) notFound();

  const canManage = can(workspace.permissions, "crm.manage");

  return (
    <PageContainer size="narrow">
      <PageHeader
        name={workspace.profile.first_name}
        subtitle={lead.company_name}
      />

      <p className="text-sm text-slate">
        <Link href="/app/crm/leads" className="text-teal underline-offset-2 hover:underline">
          ← Back to leads
        </Link>
      </p>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <CardTitle className="font-display text-base text-navy">
              {lead.company_name}
            </CardTitle>
            <StatusBadge status={lead.status} />
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-slate">
            Contact:{" "}
            <span className="font-medium text-navy">
              {lead.contact_name ?? "—"}
            </span>
          </p>
          <p className="text-slate">
            Email:{" "}
            <span className="font-medium text-navy">
              {lead.contact_email ?? "—"}
            </span>
          </p>
          <p className="text-slate">
            Phone:{" "}
            <span className="font-medium text-navy">
              {lead.contact_phone ?? "—"}
            </span>
          </p>
          <p className="text-slate">
            Industry:{" "}
            <span className="font-medium text-navy">
              {lead.industry ?? "—"}
            </span>
          </p>
          <p className="text-slate">
            Source:{" "}
            <span className="capitalize font-medium text-navy">
              {lead.source}
            </span>
          </p>
          <p className="text-xs text-slate">
            Created {format(new Date(lead.created_at), "MMM d, yyyy h:mm a")}
          </p>
          {lead.notes ? (
            <p className="whitespace-pre-wrap text-slate">{lead.notes}</p>
          ) : null}
          {canManage ? (
            <LeadStatusForm leadId={lead.id} currentStatus={lead.status} />
          ) : null}
        </CardContent>
      </Card>

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-base text-navy">
              Open a deal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CreateDealForm
              leadId={lead.id}
              defaultTitle={`${lead.company_name} opportunity`}
            />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base text-navy">
            Activity
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!activities?.length ? (
            <p className="text-sm text-slate">No activity yet.</p>
          ) : (
            activities.map((activity) => (
              <div
                key={activity.id}
                className="border-b border-line pb-3 last:border-0 last:pb-0"
              >
                <p className="text-sm font-medium text-navy">
                  {activity.subject}
                </p>
                <p className="text-xs capitalize text-slate">
                  {activity.activity_type} ·{" "}
                  {format(new Date(activity.created_at), "MMM d, yyyy h:mm a")}
                </p>
                {activity.body ? (
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate">
                    {activity.body}
                  </p>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}
