import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to your Beepa account.",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const nextPath =
    params.next && params.next.startsWith("/") ? params.next : "/app";

  return (
    <AuthShell
      title="Great people build brighter tomorrow."
      description="Access your Beepa workspace with the same people-first partnership you trust."
    >
      <LoginForm nextPath={nextPath} />
    </AuthShell>
  );
}
