"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/actions/types";
import { resolveWorkspace, requirePermission } from "@/lib/auth/workspace";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { crmLeadSchema, crmLeadStatusSchema, crmDealSchema, crmDealStageSchema } from "@/lib/validation/app";
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
