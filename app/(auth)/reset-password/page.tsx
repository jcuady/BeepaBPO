import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = {
  title: "Reset Password",
  robots: { index: false, follow: false },
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  return (
    <AuthShell
      title="Choose a new password."
      description="Use a strong password you do not reuse elsewhere."
    >
      <ResetPasswordForm token={params.token ?? ""} />
    </AuthShell>
  );
}
