-- Storage RLS: a malformed object path must DENY, not raise.
--
-- 20260906000800_storage_buckets.sql casts the first folder segment of a storage
-- object name straight to uuid. Six policies do it, in two shapes:
--
--   public.is_self_employee(((storage.foldername(name))[1])::uuid)
--   public.can_access_client(((storage.foldername(name))[1])::uuid)
--
-- Object names are caller-supplied. Any name whose first segment is not a uuid
-- makes Postgres raise:
--
--   invalid input syntax for type uuid: "demo"
--
-- A policy that raises is not a policy that denies. The error aborts the whole
-- statement, so a listing over a bucket that contains one malformed path fails
-- outright instead of filtering that row out, and a user with no permission on
-- the bucket gets a database type error rather than an empty result. That is
-- the difference between "you cannot see this file" and "the database is
-- broken"; it is also a denial of service, since a single such object makes
-- every read against the bucket fail.
--
-- This migration is additive on purpose. 20260906000800 is applied to the live
-- database, and applied migrations are never rewritten. Every affected policy
-- is dropped and recreated with the same bucket, role, command and permission
-- alternatives, with only the cast routed through public.try_uuid().
--
-- ---------------------------------------------------------------------------
-- Why a regex-guarded CASE and not a PL/pgSQL EXCEPTION block
-- ---------------------------------------------------------------------------
--
-- try_uuid has to be IMMUTABLE, because it is called from an RLS policy
-- expression and must remain usable in index and policy expressions. A
-- plpgsql body with a BEGIN ... EXCEPTION "invalid_text_representation" block
-- is a subtransaction: it carries exception-handling state, and Postgres will
-- not treat such a function as a safe constant for index expressions and
-- policy predicates. The pure-SQL form below keeps the function a single
-- immutable expression, so the planner may inline and constant-fold it.
--
-- The cast sits in the CASE arm that is only reached when the shape already
-- matched, so it is never executed on a non-uuid. The anchors are deliberate:
-- Postgres POSIX regexes match ^ and $ at string start/end only, because
-- newline-sensitive matching is off unless the "n" flag is passed. This regex
-- passes no flags, so a name such as "<uuid>\n" cannot slip through and then
-- fail, or be truncated, at the cast. Uppercase hex is accepted because
-- Postgres accepts it on input.
--
-- ---------------------------------------------------------------------------
-- What the helpers do with NULL, which decides whether the NULL cast is enough
-- ---------------------------------------------------------------------------
--
-- public.is_self_employee(NULL) returns FALSE. It does not raise.
--
--   Its body is
--     exists (select 1 from public.employees e
--             where e.id = p_employee_id and e.profile_id = (select auth.uid()))
--
--   `e.id = NULL` is never true for any row, so EXISTS has no row to report and
--   returns false. A NULL cast therefore denies by itself, and the three
--   is_self_employee policies need no second guard. Adding one anyway would be
--   noise that hides the real reasoning.
--
-- public.can_access_client(NULL) can return TRUE. It does not raise.
--
--   Its body is
--     is_client_member(p_org_id)
--       or has_permission('clients.read')
--       or has_permission('clients.manage')
--       or has_permission('system.manage')
--
--   is_client_member(NULL) is false, but the permission terms do not depend on
--   the argument at all. Anyone holding clients.read, clients.manage or
--   system.manage gets TRUE whatever organization id they were handed,
--   including NULL.
--
-- That is why routing can_access_client through try_uuid alone would be a
-- privilege escalation rather than a fix: it converts "raise, therefore deny"
-- into "allow every row in the bucket" for precisely the accounts most likely
-- to hold those permissions, on any object whose path is malformed. The three
-- can_access_client policies below therefore require an explicit `is not null`
-- before the call. On a well-formed path the guard is true and the function is
-- called exactly as before, so the fix does not narrow access anywhere it was
-- previously working.

-- ---------------------------------------------------------------------------
-- Safe cast
-- ---------------------------------------------------------------------------

create or replace function public.try_uuid(p_value text)
returns uuid
language sql
immutable
parallel safe
as $$
  select case
    when p_value ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      then p_value::uuid
    else null::uuid
  end;
$$;

-- Mirrors the hardening in 20260908120000_harden_definer_revoke_anon.sql: the
-- function is a pure parser with no table access, but anon has no business
-- calling it, and policies are evaluated as authenticated.
revoke execute on function public.try_uuid(text) from anon;
grant execute on function public.try_uuid(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Drop the six policies that cast. Nothing else is touched: the avatars,
-- applicant, ticket, payroll-write and marketing policies carry no uuid cast
-- and are left exactly as they are.
-- ---------------------------------------------------------------------------

drop policy if exists storage_employee_docs_select on storage.objects;
drop policy if exists storage_employee_docs_insert on storage.objects;
drop policy if exists storage_client_docs_select on storage.objects;
drop policy if exists storage_client_docs_insert on storage.objects;
drop policy if exists storage_contracts_select on storage.objects;
drop policy if exists storage_payslips_select on storage.objects;

-- ---------------------------------------------------------------------------
-- Employee documents: path {employee_id}/...
-- is_self_employee(NULL) is false, so the safe cast alone denies a malformed
-- path. Permission alternatives are unchanged, including the asymmetry in the
-- original: insert checks employees.documents.manage only, while select also
-- honours employees.documents.read.
-- ---------------------------------------------------------------------------

create policy storage_employee_docs_select
  on storage.objects for select to authenticated
  using (
    bucket_id = 'employee-documents'
    and (
      public.has_permission('employees.documents.read')
      or public.has_permission('employees.documents.manage')
      or public.is_self_employee(public.try_uuid((storage.foldername(name))[1]))
    )
  );

create policy storage_employee_docs_insert
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'employee-documents'
    and (
      public.has_permission('employees.documents.manage')
      or public.is_self_employee(public.try_uuid((storage.foldername(name))[1]))
    )
  );

-- ---------------------------------------------------------------------------
-- Client documents: path {client_org_id}/...
-- can_access_client(NULL) can be true, so the parsed uuid is required to be
-- non-null before the call. Without this a clients.read holder reading any
-- malformed path would be granted the whole bucket.
-- ---------------------------------------------------------------------------

create policy storage_client_docs_select
  on storage.objects for select to authenticated
  using (
    bucket_id = 'client-documents'
    and (
      public.has_permission('clients.manage')
      or (
        public.try_uuid((storage.foldername(name))[1]) is not null
        and public.can_access_client(public.try_uuid((storage.foldername(name))[1]))
      )
    )
  );

create policy storage_client_docs_insert
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'client-documents'
    and (
      public.has_permission('clients.manage')
      or (
        public.try_uuid((storage.foldername(name))[1]) is not null
        and public.can_access_client(public.try_uuid((storage.foldername(name))[1]))
      )
    )
  );

-- ---------------------------------------------------------------------------
-- Contracts: internal sales/finance, plus client read of their own.
-- Same guarded call: the bucket holds client documents, so a malformed path
-- must not fall through to a permission term inside can_access_client.
-- ---------------------------------------------------------------------------

create policy storage_contracts_select
  on storage.objects for select to authenticated
  using (
    bucket_id = 'contracts'
    and (
      public.is_internal_user()
      or public.has_permission('crm.read')
      or public.has_permission('billing.read')
      or (
        public.try_uuid((storage.foldername(name))[1]) is not null
        and public.can_access_client(public.try_uuid((storage.foldername(name))[1]))
      )
    )
  );

-- ---------------------------------------------------------------------------
-- Payslips: own employee or payroll.read.
-- The payroll.self alternative is an AND pair in the original and stays one.
-- is_self_employee(NULL) is false, so a malformed path denies here too.
-- ---------------------------------------------------------------------------

create policy storage_payslips_select
  on storage.objects for select to authenticated
  using (
    bucket_id = 'payslips'
    and (
      public.has_permission('payroll.read')
      or public.has_permission('payroll.manage')
      or (
        public.has_permission('payroll.self')
        and public.is_self_employee(public.try_uuid((storage.foldername(name))[1]))
      )
    )
  );