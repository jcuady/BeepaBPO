import Link from "next/link";
import { Container } from "@/components/beepa/container";
import { Button } from "@/components/ui/button";

export default function ForbiddenPage() {
  return (
    // `data-page-status` is a machine-readable marker, not decoration.
    //
    // Next renders this page at the *requested* URL rather than redirecting, so
    // an auditor that only watches for a URL change scores a 403 as a perfect
    // page: no overflow, no small targets, no console errors. That is exactly
    // how `/app/recruitment` was reported clean for an `hr` account that cannot
    // open it. The audit now asserts on this attribute instead of sniffing text.
    <div className="min-h-[100dvh] bg-mist" data-page-status="forbidden">
      <Container className="flex min-h-[100dvh] items-center justify-center py-16">
        <div className="mx-auto max-w-lg rounded-none border border-line bg-white p-8 text-center">
          <p className="font-display text-sm font-semibold uppercase tracking-wide text-slate">
            403 Forbidden
          </p>
          <h1 className="mt-2 font-display text-2xl font-bold text-navy">
            Access not allowed
          </h1>
          <p className="mt-3 text-base leading-relaxed text-slate">
            You do not have permission to view this page.
          </p>
          <Button
            className="mt-6"
            variant="secondary"
            nativeButton={false}
            render={<Link href="/app" />}
          >
            Back to app
          </Button>
        </div>
      </Container>
    </div>
  );
}
