import type { Metadata } from "next";
import { EmployeeAuthShell } from "@/components/auth/employee-auth-shell";
import { EmployeeLoginForm } from "@/components/auth/employee-login-form";
import { safeNext } from "@/lib/auth/safe-next";
import { getDemoLoginConfig } from "@/lib/demo/login";
import { DEMO_USERS } from "@/lib/demo/users";

export const metadata: Metadata = {
  title: "Employee Sign In",
  description: "Sign in to the Beepa internal portal.",
  robots: { index: false, follow: false },
};

export default async function EmployeeLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; demo?: string }>;
}) {
  const params = await searchParams;
  const nextPath = safeNext(params.next);
  const demo = getDemoLoginConfig("employee");
  const requested = params.demo?.toLowerCase();
  const initialDemoEmail =
    demo && requested && DEMO_USERS.some((u) => u.email === requested)
      ? requested
      : undefined;

  return (
    <EmployeeAuthShell>
      <EmployeeLoginForm
        nextPath={nextPath}
        demoUsers={demo?.users}
        demoPassword={demo?.password}
        initialDemoEmail={initialDemoEmail}
      />
    </EmployeeAuthShell>
  );
}
