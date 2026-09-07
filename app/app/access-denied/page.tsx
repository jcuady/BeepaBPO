import Link from "next/link";
import { Container } from "@/components/beepa/container";
import { Button } from "@/components/ui/button";

export default function AccessDeniedPage() {
  return (
    <div className="min-h-[100dvh] bg-mist">
      <Container className="flex min-h-[100dvh] items-center justify-center py-16">
        <div className="mx-auto max-w-lg rounded-[16px] border border-line bg-white p-8 text-center">
          <p className="font-display text-sm font-semibold uppercase tracking-wide text-slate">
            Access denied
          </p>
          <h1 className="mt-2 font-display text-2xl font-bold text-navy">
            No active workspace access
          </h1>
          <p className="mt-3 text-base leading-relaxed text-slate">
            Your account is signed in but does not have an active Beepa membership.
            Contact your administrator if you believe this is a mistake.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button
              variant="secondary"
              nativeButton={false}
              render={<Link href="/" />}
            >
              Back to website
            </Button>
            <Button nativeButton={false} render={<Link href="/login" />}>
              Switch account
            </Button>
          </div>
        </div>
      </Container>
    </div>
  );
}
