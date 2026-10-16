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
import { authCallbackErrorMessage } from "@/lib/auth/error-messages";
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
  searchParams: Promise<{ next?: string; demo?: string; error?: string }>;
}) {
  const params = await searchParams;
  const nextPath = safeNext(params.next);
  await redirectIfAuthenticated(nextPath);

  // `/auth/callback` sends people here with `?error=auth_callback` whenever a
  // signup or reset link could not be completed. Nothing read it, so a dead link
  // used to land on this form with no explanation at all.
  const linkError = authCallbackErrorMessage(params.error);

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
      imageSrc="/images/sections/why-beepa-agent.webp"
      imageAlt={`${BRAND.displayName} team member working at a desk`}
    >
      <LoginForm
        nextPath={nextPath}
        linkError={linkError}
        demoUsers={demo?.users}
        demoPassword={demo?.password}
        initialDemoEmail={initialDemoEmail}
      />
    </AuthShell>
  );
}
