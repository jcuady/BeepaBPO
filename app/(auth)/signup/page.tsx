import type { Metadata } from "next";
import { IconUsers, IconChartBar, IconShieldCheck } from "@tabler/icons-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = {
  title: "Sign Up",
  description: "Create a Beepa account.",
  robots: { index: false, follow: false },
};

export default function SignupPage() {
  return (
    <AuthShell
      eyebrow="PEOPLE PROCESS PROGRESS"
      title="Join a brighter tomorrow."
      description="Create your Beepa account and be part of a people-first outsourcing partner that helps businesses grow through talent, process and purpose."
      features={[
        { label: "People-First Partnership", icon: IconUsers },
        { label: "Scalable Growth", icon: IconChartBar },
        { label: "Secure and Trusted", icon: IconShieldCheck },
      ]}
      imageSrc="/images/auth/sign-in.png"
      imageAlt="Beepa team member with headset"
    >
      <SignupForm />
    </AuthShell>
  );
}
