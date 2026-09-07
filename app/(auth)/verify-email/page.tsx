import type { Metadata } from "next";
import Link from "next/link";
import { IconUsers, IconChartBar, IconShieldCheck } from "@tabler/icons-react";
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
      eyebrow="PEOPLE PROCESS PROGRESS"
      title="Email verification"
      description="Confirm your email to finish setting up your Beepa account."
      features={[
        { label: "People-First Approach", icon: IconUsers },
        { label: "Proven Processes", icon: IconChartBar },
        { label: "Real Business Impact", icon: IconShieldCheck },
      ]}
      imageSrc="/images/auth/sign-in.png"
      imageAlt="Beepa team member with headset"
    >
      <div className="rounded-[24px] border border-line bg-white p-6 shadow-sm sm:p-10">
        <div className="text-center">
          <h2 className="font-display text-2xl font-bold text-navy sm:text-3xl">
            {result.ok ? "Email verified" : "Verification needed"}
          </h2>
          <p className="mt-3 text-sm text-slate">
            {result.ok ? result.message : result.error}
          </p>
        </div>
        <Button
          className="mt-8 w-full text-base"
          size="lg"
          nativeButton={false}
          render={<Link href="/login" />}
        >
          Sign In &rarr;
        </Button>
      </div>
    </AuthShell>
  );
}
