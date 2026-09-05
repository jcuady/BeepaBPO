import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = {
  title: "Sign Up",
  description: "Create a Beepa account. Privileged roles require invitation.",
  robots: { index: false, follow: false },
};

export default function SignupPage() {
  return (
    <AuthShell
      title="Join a brighter tomorrow."
      description="Create a basic account to get started. Staff and client access is assigned through invitation and approval."
    >
      <SignupForm />
    </AuthShell>
  );
}
