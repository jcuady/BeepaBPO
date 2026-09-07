import type { Metadata } from "next";
import { IconUsers, IconChartBar, IconShieldCheck } from "@tabler/icons-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { createClient } from "@/lib/supabase/server";

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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <AuthShell
      eyebrow="PEOPLE PROCESS PROGRESS"
      title="Choose a new password."
      description="Use a strong password you do not reuse elsewhere."
      features={[
        { label: "People-First Approach", icon: IconUsers },
        { label: "Proven Processes", icon: IconChartBar },
        { label: "Real Business Impact", icon: IconShieldCheck },
      ]}
      imageSrc="/images/auth/sign-in.png"
      imageAlt="Beepa team member with headset"
    >
      <ResetPasswordForm
        token={params.token ?? ""}
        hasRecoverySession={Boolean(user)}
      />
    </AuthShell>
  );
}
