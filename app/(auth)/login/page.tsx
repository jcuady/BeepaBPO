import type { Metadata } from "next";
import { IconUsers, IconChartBar, IconShieldCheck } from "@tabler/icons-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { safeNext } from "@/lib/auth/safe-next";
import { getDemoLoginConfig } from "@/lib/demo/login";
import { DEMO_USERS } from "@/lib/demo/users";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to your Beepa account.",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; demo?: string }>;
}) {
  const params = await searchParams;
  const nextPath = safeNext(params.next);
  const demo = getDemoLoginConfig("client");
  const requested = params.demo?.toLowerCase();
  const initialDemoEmail =
    demo && requested && DEMO_USERS.some((u) => u.email === requested)
      ? requested
      : undefined;

  return (
    <AuthShell
      eyebrow="PEOPLE PROCESS PROGRESS"
      title="Great people build brighter tomorrow."
      description="Partner with Beepa and empower your business with world-class talent and operational excellence."
      features={[
        { label: "People-First Approach", icon: IconUsers },
        { label: "Proven Processes", icon: IconChartBar },
        { label: "Real Business Impact", icon: IconShieldCheck },
      ]}
      imageSrc="/images/auth/sign-in.png"
      imageAlt="Beepa team member with headset"
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
