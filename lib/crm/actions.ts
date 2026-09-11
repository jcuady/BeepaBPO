"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/actions/types";
import { resolveWorkspace, requirePermission } from "@/lib/auth/workspace";
import { can, canAll } from "@/lib/permissions/can";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  crmLeadSchema,
  crmLeadStatusSchema,
  crmDealSchema,
  crmDealStageSchema,
  convertDealToClientSchema,
  crmProposalSchema,
  crmProposalStatusSchema,
} from "@/lib/validation/app";
import { BEEPA_ORG_ID } from "@/lib/permissions/codes";
import type { Database } from "@/types/database";

type CrmLeadStatus = Database["public"]["Enums"]["crm_lead_status"];
type CrmDealStage = Database["public"]["Enums"]["crm_deal_stage"];

function parseMoney(raw: string | undefined): number | null | { error: string } {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) {
    return { error: "Enter a valid non-negative amount." };
  }
  return n;
}

export async function createCrmLead(input: unknown): Promise<ActionResult> {
  const workspace = await resolveWorkspace();
  if (!workspace) return { ok: false, error: "You must be signed in." };
  if (!workspace.isInternal) return { ok: false, error: "Staff access required." };
  requirePermission(workspace, "crm.manage");

  const parsed = crmLeadSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
      error: "Please check the form and try again.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("crm_leads").insert({
    company_name: parsed.data.company_name,
    contact_name: parsed.data.contact_name || null,
    contact_email: parsed.data.contact_email || null,
    contact_phone: parsed.data.contact_phone || null,
    industry: parsed.data.industry || null,
    notes: parsed.data.notes ?? "",
    source: parsed.data.source ?? "manual",
    status: "new",
  });

  if (error) {
    return { ok: false, error: error.message ?? "Unable to create lead." };
  }

  revalidatePath("/app/crm/leads");
  revalidatePath("/app/crm");
  return { ok: true, message: "Lead created." };
}

export async function updateCrmLeadStatus(
  input: unknown,
): Promise<ActionResult> {
  const workspace = await resolveWorkspace();
  if (!workspace) return { ok: false, error: "You must be signed in." };
  if (!workspace.isInternal) return { ok: false, error: "Staff access required." };
  requirePermission(workspace, "crm.manage");

  const parsed = crmLeadStatusSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
      error: "Invalid status update.",
    };
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("crm_leads")
    .select("id, status, company_name, notes")
    .eq("id", parsed.data.lead_id)
    .maybeSingle();

  if (!existing) {
    return { ok: false, error: "Lead not found." };
  }

  const nextStatus = parsed.data.status as CrmLeadStatus;
  if (existing.status === nextStatus && !parsed.data.notes?.trim()) {
    return { ok: true, message: "Lead status unchanged." };
  }

  const noteLine = parsed.data.notes?.trim();
  const notes =
    noteLine && noteLine.length > 0
      ? `${existing.notes ? `${existing.notes}\n\n` : ""}[${new Date().toISOString().slice(0, 10)} · ${nextStatus}] ${noteLine}`
      : existing.notes;

  const { error } = await supabase
    .from("crm_leads")
    .update({
      status: nextStatus,
      notes,
    })
    .eq("id", parsed.data.lead_id);

  if (error) {
    return { ok: false, error: error.message ?? "Unable to update lead." };
  }

  if (existing.status !== nextStatus || noteLine) {
    await supabase.from("crm_activities").insert({
      lead_id: parsed.data.lead_id,
      activity_type: "note",
      subject: `Status → ${nextStatus}`,
      body:
        noteLine ||
        `Status changed from ${existing.status} to ${nextStatus}.`,
      completed_at: new Date().toISOString(),
      owner_user_id: workspace.user.id,
    });
  }

  try {
    const { logAudit } = await import("@/lib/audit/log");
    await logAudit(supabase, {
      actorUserId: workspace.user.id,
      organizationId: BEEPA_ORG_ID,
      action: "crm_lead.status_update",
      entityType: "crm_lead",
      entityId: parsed.data.lead_id,
      before: { status: existing.status },
      after: { status: nextStatus },
    });
  } catch {
    // Non-blocking
  }

  revalidatePath("/app/crm/leads");
  revalidatePath(`/app/crm/leads/${parsed.data.lead_id}`);
  revalidatePath("/app/crm");
  return { ok: true, message: "Lead status updated." };
}

export async function createLeadFromContact(input: {
  name: string;
  email: string;
  company: string;
  message: string;
  utm?: {
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    utm_content?: string;
    utm_term?: string;
    landing_page?: string;
    referrer_url?: string;
  };
}): Promise<{ leadId: string | null; error?: string }> {
  // Public marketing form has no crm.manage JWT — service role bypasses RLS.
  const supabase = createAdminClient();
  const { data: lead, error } = await supabase
    .from("crm_leads")
    .insert({
      company_name: input.company,
      contact_name: input.name,
      contact_email: input.email,
      notes: input.message,
      source: "website_contact",
      status: "new",
    })
    .select("id")
    .single();

  if (error || !lead) {
    return { leadId: null, error: error?.message ?? "Unable to save lead." };
  }

  const utm = input.utm;
  if (
    utm &&
    (utm.utm_source ||
      utm.utm_medium ||
      utm.utm_campaign ||
      utm.landing_page)
  ) {
    const { error: attributionError } = await supabase
      .from("lead_attribution")
      .insert({
        lead_id: lead.id,
        utm_source: utm.utm_source ?? null,
        utm_medium: utm.utm_medium ?? null,
        utm_campaign: utm.utm_campaign ?? null,
        utm_content: utm.utm_content ?? null,
        utm_term: utm.utm_term ?? null,
        landing_page: utm.landing_page ?? null,
        referrer_url: utm.referrer_url ?? null,
      });
    // Lead already saved; attribution is best-effort.
    if (attributionError) {
      console.error(
        "[crm] lead_attribution insert failed",
        attributionError.message,
      );
    }
  }

  return { leadId: lead.id };
}

export async function createCrmDeal(input: unknown): Promise<ActionResult> {
  const workspace = await resolveWorkspace();
  if (!workspace) return { ok: false, error: "You must be signed in." };
  if (!workspace.isInternal) return { ok: false, error: "Staff access required." };
  requirePermission(workspace, "crm.manage");

  const parsed = crmDealSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
      error: "Please check the form and try again.",
    };
  }

  const money = parseMoney(parsed.data.estimated_value);
  if (money && typeof money === "object" && "error" in money) {
    return {
      ok: false,
      fieldErrors: { estimated_value: [money.error] },
      error: money.error,
    };
  }

  const leadId = parsed.data.lead_id?.trim() || null;
  const supabase = await createClient();

  if (leadId) {
    const { data: lead } = await supabase
      .from("crm_leads")
      .select("id")
      .eq("id", leadId)
      .maybeSingle();
    if (!lead) return { ok: false, error: "Lead not found." };
  }

  const { data: deal, error } = await supabase
    .from("crm_deals")
    .insert({
      title: parsed.data.title,
      lead_id: leadId,
      estimated_value: money as number | null,
      currency: (parsed.data.currency ?? "USD").toUpperCase(),
      expected_close_date: parsed.data.expected_close_date?.trim() || null,
      owner_user_id: workspace.user.id,
      stage: "new_lead",
    })
    .select("id")
    .single();

  if (error || !deal) {
    return { ok: false, error: error?.message ?? "Unable to create deal." };
  }

  await supabase.from("crm_activities").insert({
    deal_id: deal.id,
    lead_id: leadId,
    activity_type: "note",
    subject: "Deal created",
    body: `Pipeline deal “${parsed.data.title}” opened.`,
    completed_at: new Date().toISOString(),
    owner_user_id: workspace.user.id,
  });

  try {
    const { logAudit } = await import("@/lib/audit/log");
    await logAudit(supabase, {
      actorUserId: workspace.user.id,
      organizationId: BEEPA_ORG_ID,
      action: "crm_deal.create",
      entityType: "crm_deal",
      entityId: deal.id,
      after: { title: parsed.data.title, stage: "new_lead", lead_id: leadId },
    });
  } catch {
    // Non-blocking
  }

  revalidatePath("/app/crm");
  revalidatePath("/app/crm/deals");
  if (leadId) revalidatePath(`/app/crm/leads/${leadId}`);
  return { ok: true, message: "Deal created." };
}

export async function updateCrmDealStage(
  input: unknown,
): Promise<ActionResult> {
  const workspace = await resolveWorkspace();
  if (!workspace) return { ok: false, error: "You must be signed in." };
  if (!workspace.isInternal) return { ok: false, error: "Staff access required." };
  requirePermission(workspace, "crm.manage");

  const parsed = crmDealStageSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
      error: "Invalid stage update.",
    };
  }

  const nextStage = parsed.data.stage as CrmDealStage;
  if (nextStage === "lost" && !parsed.data.lost_reason?.trim()) {
    return {
      ok: false,
      fieldErrors: { lost_reason: ["Lost reason is required."] },
      error: "Add a lost reason when marking a deal lost.",
    };
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("crm_deals")
    .select("id, stage, title, lost_reason, lead_id")
    .eq("id", parsed.data.deal_id)
    .maybeSingle();

  if (!existing) return { ok: false, error: "Deal not found." };

  if (
    existing.stage === nextStage &&
    !parsed.data.notes?.trim() &&
    !parsed.data.lost_reason?.trim()
  ) {
    return { ok: true, message: "Deal stage unchanged." };
  }

  const { error } = await supabase
    .from("crm_deals")
    .update({
      stage: nextStage,
      lost_reason:
        nextStage === "lost"
          ? parsed.data.lost_reason?.trim() || existing.lost_reason
          : nextStage === "won"
            ? null
            : existing.lost_reason,
    })
    .eq("id", parsed.data.deal_id);

  if (error) {
    return { ok: false, error: error.message ?? "Unable to update deal." };
  }

  const noteLine = parsed.data.notes?.trim();
  await supabase.from("crm_activities").insert({
    deal_id: parsed.data.deal_id,
    lead_id: existing.lead_id,
    activity_type: "note",
    subject: `Stage → ${nextStage}`,
    body:
      noteLine ||
      parsed.data.lost_reason?.trim() ||
      `Stage changed from ${existing.stage} to ${nextStage}.`,
    completed_at: new Date().toISOString(),
    owner_user_id: workspace.user.id,
  });

  try {
    const { logAudit } = await import("@/lib/audit/log");
    await logAudit(supabase, {
      actorUserId: workspace.user.id,
      organizationId: BEEPA_ORG_ID,
      action: "crm_deal.stage_update",
      entityType: "crm_deal",
      entityId: parsed.data.deal_id,
      before: { stage: existing.stage },
      after: { stage: nextStage },
    });
  } catch {
    // Non-blocking
  }

  revalidatePath("/app/crm");
  revalidatePath("/app/crm/deals");
  revalidatePath(`/app/crm/deals/${parsed.data.deal_id}`);
  if (existing.lead_id) {
    revalidatePath(`/app/crm/leads/${existing.lead_id}`);
  }
  return { ok: true, message: "Deal stage updated." };
}

function slugifyOrgName(name: string) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base || "client";
}

export async function convertWonDealToClient(
  input: unknown,
): Promise<ActionResult> {
  const workspace = await resolveWorkspace();
  if (!workspace) return { ok: false, error: "You must be signed in." };
  if (!workspace.isInternal) return { ok: false, error: "Staff access required." };
  if (!canAll(workspace.permissions, ["crm.manage", "clients.manage"])) {
    return {
      ok: false,
      error: "You need CRM and clients manage permissions to convert a deal.",
    };
  }

  const parsed = convertDealToClientSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
      error: "Please check the form and try again.",
    };
  }

  const supabase = await createClient();
  const { data: deal } = await supabase
    .from("crm_deals")
    .select(
      "id, title, stage, client_organization_id, lead_id, currency, estimated_value, crm_leads(company_name, contact_email, country)",
    )
    .eq("id", parsed.data.deal_id)
    .maybeSingle();

  if (!deal) return { ok: false, error: "Deal not found." };
  if (deal.stage !== "won") {
    return {
      ok: false,
      error: "Mark the deal as won before creating a client organization.",
    };
  }
  if (deal.client_organization_id) {
    return {
      ok: false,
      error: "This deal is already linked to a client organization.",
    };
  }

  const lead = Array.isArray(deal.crm_leads)
    ? deal.crm_leads[0]
    : deal.crm_leads;
  const orgName =
    parsed.data.organization_name?.trim() ||
    lead?.company_name?.trim() ||
    deal.title.trim();

  if (orgName.length < 2) {
    return {
      ok: false,
      fieldErrors: {
        organization_name: ["Organization name is required."],
      },
      error: "Organization name is required.",
    };
  }

  let slug = slugifyOrgName(orgName);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate =
      attempt === 0 ? slug : `${slug}-${Math.floor(100 + Math.random() * 900)}`;
    const { data: clash } = await supabase
      .from("organizations")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();
    if (!clash) {
      slug = candidate;
      break;
    }
    if (attempt === 4) {
      return {
        ok: false,
        error: "Unable to allocate a unique organization slug.",
      };
    }
  }

  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .insert({
      type: "client",
      name: orgName,
      slug,
      legal_name: orgName,
      country: lead?.country ?? null,
      status: "active",
    })
    .select("id, name")
    .single();

  if (orgError || !org) {
    return {
      ok: false,
      error: orgError?.message ?? "Unable to create client organization.",
    };
  }

  const { error: settingsError } = await supabase
    .from("client_settings")
    .insert({
      client_organization_id: org.id,
      allow_attendance_view: true,
      allow_billing_view: true,
      allow_documents_view: true,
      allow_performance_view: true,
      allow_ticketing: true,
      allow_timesheet_approval: true,
    });

  if (settingsError) {
    await supabase.from("organizations").delete().eq("id", org.id);
    return {
      ok: false,
      error: settingsError.message ?? "Unable to create client settings.",
    };
  }

  // ponytail: billing account is optional; billing.manage may be absent for sales roles.
  if (can(workspace.permissions, "billing.manage")) {
    await supabase.from("billing_accounts").insert({
      client_organization_id: org.id,
      currency: (deal.currency || "USD").toUpperCase(),
      billing_email: lead?.contact_email ?? null,
      status: "active",
    });
  }

  const { error: linkError } = await supabase
    .from("crm_deals")
    .update({ client_organization_id: org.id })
    .eq("id", deal.id);

  if (linkError) {
    await supabase.from("billing_accounts").delete().eq("client_organization_id", org.id);
    await supabase.from("client_settings").delete().eq("client_organization_id", org.id);
    await supabase.from("organizations").delete().eq("id", org.id);
    return {
      ok: false,
      error: linkError.message ?? "Unable to link deal to client organization.",
    };
  }

  await supabase.from("crm_activities").insert({
    deal_id: deal.id,
    lead_id: deal.lead_id,
    activity_type: "note",
    subject: "Client organization created",
    body: `Created client org “${org.name}” from won deal.`,
    completed_at: new Date().toISOString(),
    owner_user_id: workspace.user.id,
  });

  try {
    const { logAudit } = await import("@/lib/audit/log");
    await logAudit(supabase, {
      actorUserId: workspace.user.id,
      organizationId: BEEPA_ORG_ID,
      action: "crm_deal.convert_client",
      entityType: "crm_deal",
      entityId: deal.id,
      after: {
        client_organization_id: org.id,
        organization_name: org.name,
        slug,
      },
    });
  } catch {
    // Non-blocking
  }

  revalidatePath("/app/crm");
  revalidatePath("/app/crm/deals");
  revalidatePath(`/app/crm/deals/${deal.id}`);
  revalidatePath("/app/clients");
  revalidatePath("/app/billing");
  if (deal.lead_id) revalidatePath(`/app/crm/leads/${deal.lead_id}`);

  return {
    ok: true,
    message: `Client organization “${org.name}” created. Invite users from Clients.`,
  };
}

const EARLY_DEAL_STAGES: CrmDealStage[] = [
  "new_lead",
  "contacted",
  "qualified",
  "discovery",
];

export async function createCrmProposal(
  input: unknown,
): Promise<ActionResult> {
  const workspace = await resolveWorkspace();
  if (!workspace) return { ok: false, error: "You must be signed in." };
  if (!workspace.isInternal) return { ok: false, error: "Staff access required." };
  requirePermission(workspace, "crm.manage");

  const parsed = crmProposalSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
      error: "Please check the form and try again.",
    };
  }

  const money = parseMoney(parsed.data.amount);
  if (money && typeof money === "object" && "error" in money) {
    return {
      ok: false,
      fieldErrors: { amount: [money.error] },
      error: money.error,
    };
  }

  const supabase = await createClient();
  const { data: deal } = await supabase
    .from("crm_deals")
    .select("id, title, stage, lead_id")
    .eq("id", parsed.data.deal_id)
    .maybeSingle();

  if (!deal) return { ok: false, error: "Deal not found." };

  const { data: proposal, error } = await supabase
    .from("crm_proposals")
    .insert({
      deal_id: deal.id,
      title: parsed.data.title.trim(),
      amount: money as number | null,
      currency: (parsed.data.currency ?? "USD").toUpperCase(),
      status: "draft",
      created_by: workspace.user.id,
    })
    .select("id, title")
    .single();

  if (error || !proposal) {
    return {
      ok: false,
      error: error?.message ?? "Unable to create proposal.",
    };
  }

  if (EARLY_DEAL_STAGES.includes(deal.stage)) {
    await supabase
      .from("crm_deals")
      .update({ stage: "proposal" })
      .eq("id", deal.id);
  }

  await supabase.from("crm_activities").insert({
    deal_id: deal.id,
    lead_id: deal.lead_id,
    activity_type: "note",
    subject: "Proposal created",
    body: `Draft proposal “${proposal.title}” created.`,
    completed_at: new Date().toISOString(),
    owner_user_id: workspace.user.id,
  });

  try {
    const { logAudit } = await import("@/lib/audit/log");
    await logAudit(supabase, {
      actorUserId: workspace.user.id,
      organizationId: BEEPA_ORG_ID,
      action: "crm_proposal.create",
      entityType: "crm_proposal",
      entityId: proposal.id,
      after: {
        deal_id: deal.id,
        title: proposal.title,
        status: "draft",
      },
    });
  } catch {
    // Non-blocking
  }

  revalidatePath("/app/crm");
  revalidatePath("/app/crm/proposals");
  revalidatePath("/app/crm/deals");
  revalidatePath(`/app/crm/deals/${deal.id}`);
  return { ok: true, message: "Proposal created." };
}

export async function updateCrmProposalStatus(
  input: unknown,
): Promise<ActionResult> {
  const workspace = await resolveWorkspace();
  if (!workspace) return { ok: false, error: "You must be signed in." };
  if (!workspace.isInternal) return { ok: false, error: "Staff access required." };
  requirePermission(workspace, "crm.manage");

  const parsed = crmProposalStatusSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
      error: "Invalid proposal status.",
    };
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("crm_proposals")
    .select("id, status, title, deal_id, sent_at, crm_deals(lead_id)")
    .eq("id", parsed.data.proposal_id)
    .maybeSingle();

  if (!existing) return { ok: false, error: "Proposal not found." };

  const nextStatus = parsed.data.status;
  if (existing.status === nextStatus) {
    return { ok: true, message: "Proposal status unchanged." };
  }

  const allowed: Record<string, string[]> = {
    draft: ["sent", "withdrawn"],
    sent: ["accepted", "rejected", "withdrawn"],
  };
  const nextAllowed = allowed[existing.status];
  if (!nextAllowed || !nextAllowed.includes(nextStatus)) {
    return {
      ok: false,
      error: `Cannot move proposal from ${existing.status} to ${nextStatus}.`,
    };
  }

  const { error } = await supabase
    .from("crm_proposals")
    .update({
      status: nextStatus,
      sent_at:
        nextStatus === "sent"
          ? new Date().toISOString()
          : existing.sent_at,
    })
    .eq("id", existing.id);

  if (error) {
    return {
      ok: false,
      error: error.message ?? "Unable to update proposal.",
    };
  }

  const deal = Array.isArray(existing.crm_deals)
    ? existing.crm_deals[0]
    : existing.crm_deals;

  await supabase.from("crm_activities").insert({
    deal_id: existing.deal_id,
    lead_id: deal?.lead_id ?? null,
    activity_type: "note",
    subject: `Proposal → ${nextStatus}`,
    body: `Proposal “${existing.title}” marked ${nextStatus}.`,
    completed_at: new Date().toISOString(),
    owner_user_id: workspace.user.id,
  });

  try {
    const { logAudit } = await import("@/lib/audit/log");
    await logAudit(supabase, {
      actorUserId: workspace.user.id,
      organizationId: BEEPA_ORG_ID,
      action: "crm_proposal.status_update",
      entityType: "crm_proposal",
      entityId: existing.id,
      before: { status: existing.status },
      after: { status: nextStatus },
    });
  } catch {
    // Non-blocking
  }

  revalidatePath("/app/crm");
  revalidatePath("/app/crm/proposals");
  revalidatePath(`/app/crm/deals/${existing.deal_id}`);
  return { ok: true, message: `Proposal marked ${nextStatus}.` };
}
