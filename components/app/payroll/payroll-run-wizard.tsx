"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createPayrollPeriod } from "@/lib/payroll/actions";
import {
  SALARY_FREQUENCIES,
  windowAlreadyRun,
  windowForFrequency,
  type SalaryFrequency,
} from "@/lib/payroll/schedule";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PeriodSpan = { start_date: string; end_date: string; name: string };

const STEPS = ["Frequency", "Cutoff", "Confirm"] as const;

export function PayrollRunWizard({ periods }: { periods: PeriodSpan[] }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [frequency, setFrequency] = useState<SalaryFrequency>("semi_monthly");
  const [pending, setPending] = useState(false);

  const window = useMemo(
    () => windowForFrequency(frequency),
    [frequency],
  );
  const alreadyRun = windowAlreadyRun(window, periods);

  async function createRun() {
    if (alreadyRun) return;
    setPending(true);
    const result = await createPayrollPeriod({
      name: window.name,
      start_date: window.start_date,
      end_date: window.end_date,
      pay_date: window.pay_date,
      pay_frequency: frequency,
      seed_records: true,
    });
    setPending(false);
    if (!result.ok) {
      toast.error(result.error ?? "Unable to open this payroll run.");
      return;
    }
    toast.success(result.message);
    router.refresh();
    setStep(0);
  }

  return (
    <div className="space-y-6">
      <ol className="flex gap-2" aria-label="Payroll run steps">
        {STEPS.map((label, index) => (
          <li
            key={label}
            className={cn(
              "flex min-h-11 flex-1 items-center justify-center rounded-full border px-3 text-sm font-medium",
              index === step
                ? "border-green bg-soft-green text-green-strong"
                : "border-line text-slate",
            )}
            aria-current={index === step ? "step" : undefined}
          >
            {index + 1}. {label}
          </li>
        ))}
      </ol>

      {step === 0 ? (
        <fieldset className="space-y-3">
          <legend className="font-display text-sm font-semibold text-navy">
            Pay frequency
          </legend>
          {SALARY_FREQUENCIES.map((option) => (
            <label
              key={option.id}
              className={cn(
                "flex min-h-11 cursor-pointer gap-3 rounded-none border p-4",
                frequency === option.id
                  ? "border-green bg-soft-green/60"
                  : "border-line bg-white",
              )}
            >
              <input
                type="radio"
                name="pay_frequency"
                className="mt-1 size-4"
                checked={frequency === option.id}
                onChange={() => setFrequency(option.id)}
              />
              <span>
                <span className="block font-medium text-navy">{option.label}</span>
                <span className="mt-1 block text-base leading-relaxed text-slate sm:text-sm">
                  {option.detail}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
      ) : null}

      {step === 1 ? (
        <div className="space-y-3 rounded-none border border-line p-4">
          <p className="font-display text-base font-semibold text-navy">
            {window.name}
          </p>
          <p className="text-sm leading-relaxed text-slate">
            {window.start_date} to {window.end_date}. Payday {window.pay_date}.
            Employees are paid a fixed slice of the monthly salary set in
            Payroll settings. Tax and statutory deductions are not applied.
          </p>
          {alreadyRun ? (
            <p className="text-sm font-medium text-destructive" role="alert">
              A run already covers this cutoff. Pick another frequency or wait
              for the next cutoff.
            </p>
          ) : (
            <p className="text-sm text-green-strong">No run yet for this cutoff.</p>
          )}
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-2 text-sm leading-relaxed text-slate">
          <p className="font-medium text-navy">Open {window.name} as a draft.</p>
          <p>
            Active employees get a draft record. Recalculate on the period to
            apply each salary. Net pay is the fixed amount only.
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        {step > 0 ? (
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => setStep((current) => current - 1)}
          >
            Back
          </Button>
        ) : null}
        {step < 2 ? (
          <Button
            type="button"
            className="min-h-11"
            disabled={step === 1 && alreadyRun}
            onClick={() => setStep((current) => current + 1)}
          >
            Continue
          </Button>
        ) : (
          <Button
            type="button"
            className="min-h-11 active:scale-[0.98]"
            disabled={pending || alreadyRun}
            onClick={createRun}
          >
            {pending ? "Opening…" : "Open payroll run"}
          </Button>
        )}
      </div>
    </div>
  );
}
