-- A payroll record must never claim to be payable before its period is approved.
--
-- `payroll_periods.status` and `payroll_records.status` are independent enums.
-- Before this migration nothing kept them consistent, and live data proved the
-- gap: a period still in `draft` held ten `finalized` records totalling 500,000
-- in net pay, and an employee downloaded the PDF.
--
-- The product code was already correct -- `lib/payroll/actions.ts` advances the
-- *period* to `finalized` first and only then cascades `finalized` to its
-- records. The corruption came from `scripts/audit/batch4b-finish.mjs`, a seed
-- script that wrote record status directly with service_role, bypassing the
-- approval workflow entirely. It no longer finalizes anything.
--
-- This trigger moves the invariant into the schema so it holds for *every*
-- writer, including service_role, RPC callers, SQL console edits, and future
-- code that has not been written yet. Auditing the problem after the fact is
-- not enough when the failure mode is money leaving the company.
--
-- The trigger permits:
--   - `approved` inside an unapproved period. That is a legitimate intermediate
--     state (the record is signed off while the period is still working through
--     its own approval chain), and the current app never writes it for payroll
--     records anyway -- period approval jumps straight to `finalized`.
--   - any status at all once the period is finalized/disbursed/closed.
--
-- It rejects:
--   - `finalized` or `paid` in a period that is not yet approved.
--
-- It fires on UPDATE as well as INSERT, and deliberately not only `of status`.
-- Once a record is in the incoherent state, editing any other column (net_pay,
-- overtime_pay) would keep a payable amount inside an unapproved period alive.
-- Blocking the whole row forces the reconciliation order: move the period first,
-- or demote the record to `draft` before touching its figures.
--
-- SECURITY DEFINER is required, not cosmetic. payroll_periods is under RLS, and
-- a trigger running as the invoker would read no visible row for an ordinary
-- employee session and report a false "missing period" instead of the real
-- "period not approved" rejection. search_path is pinned to defeat the
-- mutable-search_path hijack that `20260908120000_harden_definer_revoke_anon`
-- exists to close.

create or replace function public.payroll_record_status_requires_approved_period()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  parent_status public.payroll_period_status;
begin
  -- Only payout-grade statuses assert that money is owed.
  if new.status is null or new.status not in ('finalized', 'paid') then
    return new;
  end if;

  select p.status
    into parent_status
    from public.payroll_periods p
   where p.id = new.payroll_period_id;

  if parent_status is null then
    raise exception
      'payroll_record % references payroll_period %, which does not exist',
      new.id, new.payroll_period_id
      using errcode = 'foreign_key_violation';
  end if;

  if parent_status not in ('finalized', 'disbursed', 'closed') then
    raise exception
      'payroll_record % cannot be % while its period is %',
      new.id, new.status, parent_status
      using errcode = 'check_violation',
        hint = 'Approve the payroll period first. The period advances to finalized before its records do.';
  end if;

  return new;
end;
$$;

comment on function public.payroll_record_status_requires_approved_period() is
  'Rejects finalized/paid payroll records whose parent period is not yet approved.';

-- Trigger, not CHECK constraint: the rule spans two tables, and PostgreSQL
-- CHECK constraints cannot reference another table.
drop trigger if exists payroll_record_status_requires_approved_period on public.payroll_records;

create trigger payroll_record_status_requires_approved_period
  before insert or update
  on public.payroll_records
  for each row
  execute function public.payroll_record_status_requires_approved_period();

-- Same hardening as `20260908120000_harden_definer_revoke_anon`: nothing but the
-- table's own trigger may invoke this function.
revoke execute on function public.payroll_record_status_requires_approved_period()
  from public, anon, authenticated;

-- The trigger only governs future writes, so creating it succeeds even while
-- pre-existing incoherent rows are present -- applying this migration is safe
-- before the data is reconciled. Report what is still outstanding rather than
-- failing, because failing here would block the reconciliation itself.
--
-- Reconciliation runs `UPDATE ... SET status = 'draft'`, which this trigger
-- permits: `draft` is not a payout-grade status, so the row leaves the bad state
-- without needing the period to move first.
do $$
declare
  offender_count integer;
  exposure numeric;
begin
  select count(*), coalesce(sum(r.net_pay), 0)
    into offender_count, exposure
    from public.payroll_records r
    join public.payroll_periods p on p.id = r.payroll_period_id
   where r.status in ('finalized', 'paid')
     and p.status not in ('finalized', 'disbursed', 'closed');

  if offender_count > 0 then
    raise notice
      'payroll status coherence: % record(s) worth % are still payable inside an unapproved period. This migration stops NEW occurrences but does NOT fix existing rows -- reconcile them via the approval workflow, or set them back to draft.',
      offender_count, exposure;
  else
    raise notice 'payroll status coherence: no pre-existing incoherent records.';
  end if;
end $$;