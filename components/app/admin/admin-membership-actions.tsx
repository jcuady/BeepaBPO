"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  revokeMembership,
  updateInternalMembershipRole,
} from "@/lib/admin/actions";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { Button } from "@/components/ui/button";
import type { z } from "zod";
import { adminMembershipRoleSchema } from "@/lib/validation/app";

type RoleCode = z.infer<typeof adminMembershipRoleSchema>["role_code"];

const ROLE_OPTIONS: { value: RoleCode; label: string }[] = [
  { value: "employee", label: "Employee" },
  { value: "hr", label: "HR" },
  { value: "recruiter", label: "Recruiter" },
  { value: "sales", label: "Sales" },
  { value: "marketing", label: "Marketing" },
  { value: "operations", label: "Operations" },
  { value: "account_manager", label: "Account manager" },
  { value: "team_lead", label: "Team lead" },
  { value: "finance", label: "Finance" },
];

export function AdminMembershipActions({
  membershipId,
  membershipType,
  currentRoleCode,
  protectedRoles,
}: {
  membershipId: string;
  membershipType: string;
  currentRoleCode: string | null;
  protectedRoles: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const [roleCode, setRoleCode] = useState<RoleCode>(
    (ROLE_OPTIONS.some((o) => o.value === currentRoleCode)
      ? currentRoleCode
      : "employee") as RoleCode,
  );

  if (protectedRoles) {
    return (
      <p className="text-xs text-slate">Protected — manage outside this UI.</p>
    );
  }

  function onRoleChange() {
    startTransition(async () => {
      const result = await updateInternalMembershipRole({
        membership_id: membershipId,
        role_code: roleCode,
      });
      if (result.ok) {
        toast.success(result.message);
        setRoleOpen(false);
      } else toast.error(result.error ?? "Unable to update role.");
    });
  }

  function onRevoke() {
    startTransition(async () => {
      const result = await revokeMembership({ membership_id: membershipId });
      if (result.ok) {
        toast.success(result.message);
        setRevokeOpen(false);
      } else {
        toast.error(result.error ?? "Unable to revoke.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {membershipType === "internal" ? (
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="flex min-h-9 rounded-[12px] border border-line bg-white px-2 text-xs text-navy"
            value={roleCode}
            disabled={pending}
            onChange={(e) => setRoleCode(e.target.value as RoleCode)}
            aria-label="Membership role"
          >
            {ROLE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="min-h-9"
            disabled={pending || roleCode === currentRoleCode}
            onClick={() => setRoleOpen(true)}
          >
            Update role
          </Button>
        </div>
      ) : null}
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="min-h-9 text-destructive"
        disabled={pending}
        onClick={() => setRevokeOpen(true)}
      >
        Revoke
      </Button>
      <ConfirmDialog
        open={roleOpen}
        onOpenChange={setRoleOpen}
        title="Change this member’s role?"
        description={`They will switch to ${ROLE_OPTIONS.find((o) => o.value === roleCode)?.label ?? roleCode}. Access updates immediately.`}
        confirmLabel="Update role"
        cancelLabel="Cancel"
        pending={pending}
        onConfirm={onRoleChange}
      />
      <ConfirmDialog
        open={revokeOpen}
        onOpenChange={setRevokeOpen}
        title="Revoke this membership?"
        description="The user loses access for this organization. You can invite them again later."
        confirmLabel="Revoke"
        cancelLabel="Keep access"
        destructive
        pending={pending}
        onConfirm={onRevoke}
      />
    </div>
  );
}
