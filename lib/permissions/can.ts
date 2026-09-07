import type { PermissionCode } from "@/lib/permissions/codes";

export function can(
  permissions: readonly string[] | Set<string>,
  code: PermissionCode | string,
): boolean {
  if (permissions instanceof Set) return permissions.has(code);
  return permissions.includes(code);
}

export function canAny(
  permissions: readonly string[] | Set<string>,
  codes: readonly string[],
): boolean {
  return codes.some((c) => can(permissions, c));
}

export function canAll(
  permissions: readonly string[] | Set<string>,
  codes: readonly string[],
): boolean {
  return codes.every((c) => can(permissions, c));
}
