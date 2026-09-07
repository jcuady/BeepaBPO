import type { Metadata } from "next";
import { IconUsers, IconChartBar, IconShieldCheck } from "@tabler/icons-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = {
  title: "Forgot Password",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      eyebrow="PEOPLE PROCESS PROGRESS"
      title="Reset your password."
      description="We will email reset instructions if an account exists for that address."
      features={[
        { label: "People-First Approach", icon: IconUsers },
        { label: "Proven Processes", icon: IconChartBar },
        { label: "Real Business Impact", icon: IconShieldCheck },
      ]}
      imageSrc="/images/auth/sign-in.png"
      imageAlt="Beepa team member with headset"
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
