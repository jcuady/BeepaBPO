-- Payroll periods must not overlap within an organization.
--
-- `createPayrollPeriod` already rejects an overlapping cutoff in application
-- code, but that check is read-then-write: two concurrent runs can both pass it
-- before either row lands. There was also no schema-level backstop at all, so
-- any other writer could create overlapping periods freely.
--
-- Overlap means the same calendar days feed two payroll runs. Worked minutes,
-- overtime, and leave deductions for those days are then counted in both runs,
-- so an employee is paid twice for the same hours. That is the most expensive
-- bug class in a BPO payroll system, so the invariant belongs in the schema and
-- not only in a request handler.
--
-- btree_gist supplies the uuid equality operator class that lets organization_id
-- (uuid) share a GiST index with a daterange. Ranges are inclusive-inclusive
-- ('[]') because the exposure is double payment: adjacent runs must be written
-- 1–15 then 16–31, and a run that ends on the 15th while another starts on the
-- 15th is exactly the overlap we want rejected.

create extension if not exists btree_gist;

alter table public.payroll_periods
  add constraint payroll_periods_no_overlap
  exclude using gist (
    organization_id with =,
    daterange(start_date, end_date, '[]') with &&
  );

comment on constraint payroll_periods_no_overlap on public.payroll_periods is
  'Payroll periods within an organization may not overlap. Overlapping periods pay the same days twice.';