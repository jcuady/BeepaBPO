import type { Metadata } from "next";
import {
  IconChartBar,
  IconHeartHandshake,
  IconPlant,
  IconShieldCheck,
  IconUsers,
} from "@tabler/icons-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/signup-form";
import { redirectIfAuthenticated } from "@/lib/auth/redirect-if-authenticated";
import { BRAND } from "@/lib/site";

export const metadata: Metadata = {
  title: "Sign Up",
  description: `Create a ${BRAND.displayName} account.`,
  robots: { index: false, follow: false },
};

export default async function SignupPage() {
  await redirectIfAuthenticated("/app");

  return (
    <AuthShell
      eyebrow="People · Process · Progress"
      title="Create your account."
      description={`Join ${BRAND.displayName} — a people-first outsourcing partner that helps businesses grow through talent, process, and purpose.`}
      features={[
        {
          label: "People-First Partnership",
          description: "Real people. Real impact.",
          icon: IconUsers,
        },
        {
          label: "Scalable Growth",
          description: "Flexible solutions that grow with you.",
          icon: IconChartBar,
        },
        {
          label: "Secure and Trusted",
          description: "Your data and business are in good hands.",
          icon: IconShieldCheck,
        },
      ]}
      values={[
        {
          title: "Exceptional People",
          description: "Exceptional talent delivers real results.",
          icon: IconUsers,
        },
        {
          title: "Proven Processes",
          description: "Smarter operations for greater efficiency.",
          icon: IconChartBar,
        },
        {
          title: "Scalable Growth",
          description: "Flexible solutions that grow with you.",
          icon: IconPlant,
        },
        {
          title: "Trusted Partnership",
          description: "A team that's invested in your success.",
          icon: IconHeartHandshake,
        },
      ]}
      imageSrc="/images/auth/sign-in.png"
      imageAlt={`${BRAND.displayName} team member with headset`}
    >
      <SignupForm />
    </AuthShell>
  );
}
