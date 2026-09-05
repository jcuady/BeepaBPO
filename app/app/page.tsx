import type { Metadata } from "next";
import Link from "next/link";
import { logoutAction } from "@/lib/auth/actions";
import { getSession } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/beepa/container";

export const metadata: Metadata = {
  title: "Beepa App",
  robots: { index: false, follow: false },
};

export default async function AppHomePage() {
  const session = await getSession();

  return (
    <div className="min-h-[100dvh] bg-mist">
      <header className="border-b border-line bg-white">
        <Container className="flex h-16 items-center justify-between">
          <p className="font-display font-semibold text-navy">Beepa App</p>
          <form action={logoutAction}>
            <Button type="submit" variant="secondary" size="sm">
              Sign out
            </Button>
          </form>
        </Container>
      </header>
      <Container className="py-16">
        <div className="mx-auto max-w-lg rounded-[16px] border border-line bg-white p-8">
          <h1 className="font-display text-2xl font-bold text-navy">
            Access pending
          </h1>
          <p className="mt-3 text-base leading-relaxed text-slate">
            Signed in as {session?.email}. Your account does not have privileged
            Beepa access yet. Staff and client roles are assigned through
            invitation and approval.
          </p>
          <Button
            className="mt-6"
            variant="secondary"
            nativeButton={false}
            render={<Link href="/" />}
          >
            Back to website
          </Button>
        </div>
      </Container>
    </div>
  );
}
