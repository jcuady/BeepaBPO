import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { verifyEmailAction } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Verify Email",
  robots: { index: false, follow: false },
};

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const token = params.token ?? "";
  const result = token
    ? await verifyEmailAction(token)
    : { ok: false, error: "Missing verification token." };

  return (
    <AuthShell
      title="Email verification"
      description="Confirm your email to finish setting up your Beepa account."
    >
      <div className="rounded-[16px] border border-line bg-white p-6 sm:p-8">
        <h2 className="font-display text-2xl font-bold text-navy">
          {result.ok ? "Email verified" : "Verification needed"}
        </h2>
        <p className="mt-3 text-base text-slate">
          {result.ok ? result.message : result.error}
        </p>
        <Button
          className="mt-6"
          nativeButton={false}
          render={<Link href="/login" />}
        >
          Sign In
        </Button>
      </div>
    </AuthShell>
  );
}
