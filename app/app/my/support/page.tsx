import type { Metadata } from "next";
import { IconHeadset } from "@tabler/icons-react";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { PageContainer } from "@/components/app/page-container";

export const metadata: Metadata = { title: "Support" };

export default function MySupportPage() {
  return (
    <PageContainer size="narrow">
      <PageHeader
        name="there"
        subtitle="Get help from the Beepa support team."
      />
      <Card className="">
        <CardContent className="space-y-4 p-6">
          <div className="flex size-12 items-center justify-center rounded-xl bg-soft-green text-green">
            <IconHeadset stroke={1.75} className="size-6" />
          </div>
          <p className="text-sm text-slate">
            For HR, payroll, or IT issues, submit a ticket or contact your
            supervisor. Emergency site issues can be reported through the
            contact form.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              className="min-h-11"
              nativeButton={false}
              render={<Link href="/app/my/requests" />}
            >
              Submit a request
            </Button>
            <Button
              variant="secondary"
              className="min-h-11"
              nativeButton={false}
              render={<Link href="/contact" />}
            >
              Contact Beepa
            </Button>
          </div>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
