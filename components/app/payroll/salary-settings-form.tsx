"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { saveEmployeePayrollSettings } from "@/lib/payroll/actions";
import type { SalaryFrequency } from "@/lib/payroll/schedule";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

export type SalaryRow = {
  employeeId: string;
  name: string;
  employeeNumber: string;
  jobTitle: string;
  baseSalary: number;
  payFrequency: SalaryFrequency;
};

export function SalarySettingsForm({ rows }: { rows: SalaryRow[] }) {
  if (!rows.length) {
    return (
      <p className="text-sm text-slate">
        No active employees yet. Hire someone before setting salaries.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-line border-t border-line">
      {rows.map((row) => (
        <li key={row.employeeId}>
          <SalaryEditor row={row} />
        </li>
      ))}
    </ul>
  );
}

function SalaryEditor({ row }: { row: SalaryRow }) {
  const [salary, setSalary] = useState(String(row.baseSalary));
  const [frequency, setFrequency] = useState<SalaryFrequency>(row.payFrequency);
  const [pending, setPending] = useState(false);

  async function onSave(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    const result = await saveEmployeePayrollSettings({
      employee_id: row.employeeId,
      base_salary: salary,
      pay_frequency: frequency,
    });
    setPending(false);
    if (!result.ok) {
      toast.error(result.error ?? "Unable to save salary.");
      return;
    }
    toast.success(`${row.name}: ${result.message}`);
  }

  return (
    <form
      onSubmit={onSave}
      className="grid items-end gap-3 py-4 md:grid-cols-[1.4fr_0.8fr_0.9fr_auto]"
    >
      <div>
        <p className="font-medium text-navy">{row.name}</p>
        <p className="text-sm text-slate">
          {row.employeeNumber}
          {row.jobTitle ? ` · ${row.jobTitle}` : ""}
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`salary-${row.employeeId}`}>Monthly salary (PHP)</Label>
        <Input
          id={`salary-${row.employeeId}`}
          inputMode="decimal"
          value={salary}
          onChange={(event) => setSalary(event.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`freq-${row.employeeId}`}>Frequency</Label>
        <NativeSelect
          id={`freq-${row.employeeId}`}
          value={frequency}
          onChange={(event) =>
            setFrequency(event.target.value as SalaryFrequency)
          }
          className="flex h-11 w-full rounded-none border border-input bg-white px-3 text-sm text-navy"
        >
          <option value="semi_monthly">Semi-monthly</option>
          <option value="monthly">Monthly</option>
          <option value="weekly">Weekly</option>
        </NativeSelect>
      </div>
      <Button type="submit" className="min-h-11" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
