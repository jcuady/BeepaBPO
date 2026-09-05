import type { Metadata } from "next";
import { EmployeeAuthShell } from "@/components/auth/employee-auth-shell";
import { EmployeeLoginForm } from "@/components/auth/employee-login-form";

export const metadata: Metadata = {
  title: "Employee Sign In",
  description: "Sign in to the Beepa internal portal.",
  robots: { index: false, follow: false },
};

export default async function EmployeeLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const nextPath =
    params.next && params.next.startsWith("/") ? params.next : "/app";

  return (
    <EmployeeAuthShell>
      <EmployeeLoginForm nextPath={nextPath} />
    </EmployeeAuthShell>
  );
}
