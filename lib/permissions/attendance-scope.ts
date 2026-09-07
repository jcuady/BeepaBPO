/** Mirrors can_read_assigned_attendance() — payroll is never in this matrix. */
export function canReadAssignedAttendance(input: {
  isSelf: boolean;
  isInternal: boolean;
  isAssignedToCurrentClient: boolean;
  hasAttendanceRead: boolean;
}) {
  if (input.isSelf) return true;
  if (!input.hasAttendanceRead) return false;
  return input.isInternal || input.isAssignedToCurrentClient;
}

export function canSeeEmployeeDirectory(input: {
  isSelf: boolean;
  isInternal: boolean;
  isAssignedToCurrentClient: boolean;
  hasEmployeesRead: boolean;
  hasEmployeeVisibility: boolean;
}) {
  if (input.isSelf) return true;
  if (input.isInternal && input.hasEmployeesRead) return true;
  return input.isAssignedToCurrentClient && input.hasEmployeeVisibility;
}
