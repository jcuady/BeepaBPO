import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PayslipDownloadButton({
  payrollRecordId,
}: {
  payrollRecordId: string;
}) {
  return (
    <a
      href={`/app/my/payroll/${payrollRecordId}/payslip`}
      className={cn(
        buttonVariants({ variant: "outline", size: "sm" }),
        "min-h-9",
      )}
    >
      Download PDF
    </a>
  );
}
