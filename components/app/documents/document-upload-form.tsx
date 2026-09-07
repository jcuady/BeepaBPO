"use client";

import { useRef, useTransition } from "react";
import { toast } from "sonner";
import {
  uploadClientDocument,
  uploadEmployeeDocument,
} from "@/lib/documents/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function DocumentUploadForm({
  mode,
  employeeId,
  clientOrganizationId,
}: {
  mode: "employee" | "client";
  employeeId?: string;
  clientOrganizationId?: string;
}) {
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      if (employeeId) formData.set("employee_id", employeeId);
      if (clientOrganizationId) {
        formData.set("client_organization_id", clientOrganizationId);
      }
      const result =
        mode === "client"
          ? await uploadClientDocument(formData)
          : await uploadEmployeeDocument(formData);
      if (result.ok) {
        toast.success(result.message);
        formRef.current?.reset();
      } else {
        toast.error(result.error ?? "Upload failed.");
      }
    });
  }

  return (
    <form
      ref={formRef}
      action={onSubmit}
      className="space-y-3 rounded-[16px] border border-line bg-white p-4"
    >
      <p className="font-display text-sm font-semibold text-navy">
        Upload document
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="doc-title">Title</Label>
          <Input
            id="doc-title"
            name="title"
            required
            maxLength={200}
            placeholder="Contract addendum"
            disabled={pending}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="doc-category">Category</Label>
          <Input
            id="doc-category"
            name="category"
            required
            maxLength={80}
            placeholder="HR / Contract / ID"
            disabled={pending}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="doc-file">File</Label>
        <Input
          id="doc-file"
          name="file"
          type="file"
          required
          disabled={pending}
          accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.txt,application/pdf,image/*"
        />
        <p className="text-xs text-slate">PDF, images, Word, or text · max 20MB</p>
      </div>
      <Button type="submit" size="sm" className="min-h-9" disabled={pending}>
        {pending ? "Uploading…" : "Upload"}
      </Button>
    </form>
  );
}
