-- Store the cutoff used for a payroll run so fixed-salary proration is explicit.
alter table public.payroll_periods
  add column if not exists pay_frequency public.pay_frequency not null default 'semi_monthly';

-- Fixed salary only. No withholding tax, SSS, PhilHealth, or Pag-IBIG.
create or replace function public.calculate_payroll_record(p_payroll_record_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_record public.payroll_records%rowtype;
  v_profile public.payroll_profiles%rowtype;
  v_frequency public.pay_frequency;
  v_basic numeric(14, 2);
begin
  if not public.has_permission('payroll.manage') then
    raise exception 'Not authorized to calculate payroll';
  end if;

  select * into v_record from public.payroll_records where id = p_payroll_record_id;
  if not found then
    raise exception 'Payroll record not found';
  end if;

  select * into v_profile from public.payroll_profiles where employee_id = v_record.employee_id;
  select pay_frequency into v_frequency
  from public.payroll_periods
  where id = v_record.payroll_period_id;

  v_basic := round(
    coalesce(v_profile.base_salary, 0) * case coalesce(v_frequency, 'semi_monthly')
      when 'semi_monthly' then 0.5
      when 'weekly' then 12.0 / 52.0
      else 1
    end,
    2
  );

  update public.payroll_records
  set
    basic_pay = v_basic,
    gross_pay = v_basic
      + overtime_pay + paid_leave_amount + allowances + bonuses + incentives + commissions,
    total_deductions = undertime_deduction + absence_deduction + unpaid_leave_deduction
      + cash_advance_deduction + other_deductions,
    net_pay = greatest(
      v_basic
        + overtime_pay + paid_leave_amount + allowances + bonuses + incentives + commissions
        + manual_adjustments
        - undertime_deduction - absence_deduction - unpaid_leave_deduction
        - cash_advance_deduction - other_deductions,
      0
    ),
    status = 'calculated',
    calculation_snapshot = jsonb_build_object(
      'calculated_at', now(),
      'engine', 'fixed_salary_v1',
      'pay_frequency', coalesce(v_frequency, 'semi_monthly'),
      'monthly_salary', coalesce(v_profile.base_salary, 0),
      'basic_pay', v_basic,
      'tax', 0,
      'statutory', 0,
      'note', 'Fixed salary. No tax or statutory deductions.'
    )
  where id = p_payroll_record_id;
end;
$$;
