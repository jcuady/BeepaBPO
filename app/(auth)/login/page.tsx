import type { Metadata } from "next";
import {
  IconChartBar,
  IconShieldCheck,
  IconUsers,
} from "@tabler/icons-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { redirectIfAuthenticated } from "@/lib/auth/redirect-if-authenticated";
import { safeNext } from "@/lib/auth/safe-next";
import { getDemoLoginConfig } from "@/lib/demo/login";
import { DEMO_USERS } from "@/lib/demo/users";
import { BRAND } from "@/lib/site";

export const metadata: Metadata = {
  title: "Sign In",
  description: `Sign in to your ${BRAND.displayName} account.`,
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; demo?: string }>;
}) {
  const params = await searchParams;
  const nextPath = safeNext(params.next);
  await redirectIfAuthenticated(nextPath);

  const demo = getDemoLoginConfig("client");
  const requested = params.demo?.toLowerCase();
  const initialDemoEmail =
    demo && requested && DEMO_USERS.some((u) => u.email === requested)
      ? requested
      : undefined;

  return (
    <AuthShell
      eyebrow="People · Process · Progress"
      title="Sign in to continue."
      description={`Partner with ${BRAND.displayName} and empower your business with world-class talent and operational excellence.`}
      features={[
        {
          label: "People-First Approach",
          description: "Real people. Real impact.",
          icon: IconUsers,
        },
        {
          label: "Proven Processes",
          description: "Smarter operations, clearer delivery.",
          icon: IconChartBar,
        },
        {
          label: "Real Business Impact",
          description: "Outcomes you can measure and trust.",
          icon: IconShieldCheck,
        },
      ]}
      imageSrc="/images/auth/sign-in.png"
      imageAlt={`${BRAND.displayName} team member with headset`}
    >
      <LoginForm
        nextPath={nextPath}
        demoUsers={demo?.users}
        demoPassword={demo?.password}
        initialDemoEmail={initialDemoEmail}
      />
    </AuthShell>
  );
}
