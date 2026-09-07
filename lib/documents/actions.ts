"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/actions/types";
import { resolveWorkspace } from "@/lib/auth/workspace";
import { resolveEmployeeForUser } from "@/lib/employees/resolve";
import { getClientOrganizationId } from "@/lib/organizations/client";
import { can } from "@/lib/permissions/can";
import { BEEPA_ORG_ID } from "@/lib/permissions/codes";
import { createClient } from "@/lib/supabase/server";
import { documentMetaSchema } from "@/lib/validation/app";
import type { Database } from "@/types/database";

type Visibility = Database["public"]["Enums"]["visibility"];

const MAX_BYTES = 20 * 1024 * 1024;
const SIGNED_TTL_SECONDS = 60 * 15;
const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

function safeFileName(name: string): string {
  return name
    .trim()
    .replace(/[^\w.\-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 120) || "file";
}

function readFile(formData: FormData): File | null {
  const value = formData.get("file");
  return value instanceof File && value.size > 0 ? value : null;
}

export async function getDocumentDownloadUrl(
  documentId: string,
): Promise<ActionResult> {
  const workspace = await resolveWorkspace();
  if (!workspace) return { ok: false, error: "You must be signed in." };
  if (!documentId) return { ok: false, error: "Document not found." };

  const supabase = await createClient();
  const { data: doc, error } = await supabase
    .from("documents")
    .select("id, title, storage_bucket, storage_path")
    .eq("id", documentId)
    .maybeSingle();

  if (error || !doc) {
    return { ok: false, error: "Document not found or access denied." };
  }

  // User JWT + storage SELECT RLS; never sign with service role for private files.
  const { data: signed, error: signError } = await supabase.storage
    .from(doc.storage_bucket)
    .createSignedUrl(doc.storage_path, SIGNED_TTL_SECONDS, {
      download: doc.title,
    });

  if (signError || !signed?.signedUrl) {
    return {
      ok: false,
      error: signError?.message ?? "Unable to create download link.",
    };
  }

  return { ok: true, url: signed.signedUrl, message: "Download ready." };
}

export async function uploadEmployeeDocument(
  formData: FormData,
): Promise<ActionResult> {
  const workspace = await resolveWorkspace();
  if (!workspace) return { ok: false, error: "You must be signed in." };

  const parsed = documentMetaSchema.safeParse({
    title: formData.get("title"),
    category: formData.get("category"),
    employee_id: formData.get("employee_id") || undefined,
  });
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

  const file = readFile(formData);
  if (!file) return { ok: false, error: "Choose a file to upload." };
  if (file.size > MAX_BYTES) {
    return { ok: false, error: "File must be 20MB or smaller." };
  }
  if (file.type && !ALLOWED_MIME.has(file.type)) {
    return {
      ok: false,
      error: "Allowed types: PDF, images, Word, or plain text.",
    };
  }

  const self = await resolveEmployeeForUser(workspace.user.id);
  const canManage = can(workspace.permissions, "employees.documents.manage");
  const employeeId = parsed.data.employee_id || self?.id || null;

  if (!employeeId) {
    return { ok: false, error: "No employee record to attach this document to." };
  }
  if (!canManage && employeeId !== self?.id) {
    return {
      ok: false,
      error: "You can only upload documents to your own employee file.",
    };
  }
  if (!canManage && !self) {
    return { ok: false, error: "You do not have permission to upload." };
  }

  const path = `${employeeId}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
  const bucket = "employee-documents";
  const supabase = await createClient();

  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(path, bytes, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (uploadError) {
    return {
      ok: false,
      error: uploadError.message ?? "Upload failed.",
    };
  }

  const visibility: Visibility = canManage ? "employee_visible" : "private";
  const { data: created, error: insertError } = await supabase
    .from("documents")
    .insert({
      organization_id: BEEPA_ORG_ID,
      employee_id: employeeId,
      category: parsed.data.category,
      title: parsed.data.title,
      storage_bucket: bucket,
      storage_path: path,
      mime_type: file.type || null,
      size_bytes: file.size,
      visibility,
      uploaded_by: workspace.user.id,
    })
    .select("id")
    .single();

  if (insertError || !created) {
    await supabase.storage.from(bucket).remove([path]);
    return {
      ok: false,
      error: insertError?.message ?? "File uploaded but metadata save failed.",
    };
  }

  try {
    const { logAudit } = await import("@/lib/audit/log");
    await logAudit(supabase, {
      actorUserId: workspace.user.id,
      organizationId: BEEPA_ORG_ID,
      action: "document.upload",
      entityType: "document",
      entityId: created.id,
      after: { employee_id: employeeId, bucket, path },
    });
  } catch {
    // Non-blocking
  }

  revalidatePath("/app/my/documents");
  revalidatePath(`/app/employees/${employeeId}`);
  return { ok: true, message: "Document uploaded." };
}

export async function uploadClientDocument(
  formData: FormData,
): Promise<ActionResult> {
  const workspace = await resolveWorkspace();
  if (!workspace) return { ok: false, error: "You must be signed in." };

  const clientOrgId =
    (typeof formData.get("client_organization_id") === "string"
      ? (formData.get("client_organization_id") as string)
      : null) || getClientOrganizationId(workspace);

  const parsed = documentMetaSchema.safeParse({
    title: formData.get("title"),
    category: formData.get("category"),
    client_organization_id: clientOrgId || undefined,
  });
  if (!parsed.success || !parsed.data.client_organization_id) {
    return {
      ok: false,
      fieldErrors: parsed.error?.flatten().fieldErrors as
        | Record<string, string[]>
        | undefined,
      error: "Client organization is required.",
    };
  }

  const file = readFile(formData);
  if (!file) return { ok: false, error: "Choose a file to upload." };
  if (file.size > MAX_BYTES) {
    return { ok: false, error: "File must be 20MB or smaller." };
  }
  if (file.type && !ALLOWED_MIME.has(file.type)) {
    return {
      ok: false,
      error: "Allowed types: PDF, images, Word, or plain text.",
    };
  }

  const orgId = parsed.data.client_organization_id;
  const canManageClients = can(workspace.permissions, "clients.manage");
  const membershipOrg = getClientOrganizationId(workspace);
  if (!canManageClients && membershipOrg !== orgId) {
    return {
      ok: false,
      error: "You do not have permission to upload for this client.",
    };
  }

  const path = `${orgId}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
  const bucket = "client-documents";
  const supabase = await createClient();

  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(path, bytes, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (uploadError) {
    return { ok: false, error: uploadError.message ?? "Upload failed." };
  }

  const { data: created, error: insertError } = await supabase
    .from("documents")
    .insert({
      organization_id: BEEPA_ORG_ID,
      client_organization_id: orgId,
      category: parsed.data.category,
      title: parsed.data.title,
      storage_bucket: bucket,
      storage_path: path,
      mime_type: file.type || null,
      size_bytes: file.size,
      visibility: "client_visible",
      uploaded_by: workspace.user.id,
    })
    .select("id")
    .single();

  if (insertError || !created) {
    await supabase.storage.from(bucket).remove([path]);
    return {
      ok: false,
      error: insertError?.message ?? "File uploaded but metadata save failed.",
    };
  }

  try {
    const { logAudit } = await import("@/lib/audit/log");
    await logAudit(supabase, {
      actorUserId: workspace.user.id,
      organizationId: orgId,
      action: "document.upload_client",
      entityType: "document",
      entityId: created.id,
      after: { client_organization_id: orgId, bucket, path },
    });
  } catch {
    // Non-blocking
  }

  revalidatePath("/app/client/documents");
  return { ok: true, message: "Document uploaded." };
}
