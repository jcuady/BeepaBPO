/**
 * Auth layout.
 *
 * This group had no layout, so the six auth pages had nothing in common to
 * inherit from beyond the root body. That is fine for colour — those are
 * semantic tokens on `:root` — but not for typography.
 *
 * Sign-in is the first screen a prospective client meets, and it is part of the
 * public voice, so it carries `font-marketing` (DM Sans) like the marketing
 * site does. Without this, the auth pages were the one place a visitor saw
 * Inter while everything around them was DM Sans.
 *
 * This is a layout with no chrome of its own: no header, no footer, no wrapper
 * styling. It exists solely to set the font once for the group, which is the
 * point — `AuthShell` and `EmployeeAuthShell` already own all the chrome, and
 * putting it here as well would double it.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="font-marketing">{children}</div>;
}