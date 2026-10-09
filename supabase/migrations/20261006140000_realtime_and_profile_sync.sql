-- 2026-10-06 — Batch 5: Realtime coverage + profile sync (DDL).
-- This is a DDL migration. Requires CLI push or direct DB connection.

-- 1) Add missing tables to supabase_realtime publication so dashboards refresh live.
do $$
begin
  begin
    alter publication supabase_realtime add table public.leave_requests;
  exception when duplicate_object then null; end;
  begin
    alter publication supabase_realtime add table public.notifications;
  exception when duplicate_object then null; end;
  begin
    alter publication supabase_realtime add table public.approval_requests;
  exception when duplicate_object then null; end;
  begin
    alter publication supabase_realtime add table public.payroll_records;
  exception when duplicate_object then null; end;
  begin
    alter publication supabase_realtime add table public.cash_advance_requests;
  exception when duplicate_object then null; end;
  begin
    alter publication supabase_realtime add table public.nte_cases;
  exception when duplicate_object then null; end;
  begin
    alter publication supabase_realtime add table public.ticket_messages;
  exception when duplicate_object then null; end;
end $$;

-- 2) Trigger: sync profiles.last_login_at from auth.sessions
--    (fires on every successful sign-in).
--    NOTE: `returns trigger` must precede `language` here. The Supabase CLI's
--    migration splitter rejects the canonical reverse order with
--    "syntax error at or near trigger", even though PostgreSQL itself accepts
--    either. Verified against the live database: identical bodies fail with
--    LANGUAGE first and succeed with RETURNS first.
create or replace function public.handle_user_sign_in()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid;
begin
  -- The new auth.sessions row has user_id.
  v_user_id := new.user_id;
  if v_user_id is null then
    return new;
  end if;
  update public.profiles
  set last_login_at = new.created_at
  where id = v_user_id
    and (last_login_at is null or new.created_at > last_login_at);
  return new;
end;
$$;

drop trigger if exists on_auth_session_created on auth.sessions;
create trigger on_auth_session_created
  after insert on auth.sessions
  for each row execute function public.handle_user_sign_in();

-- 3) Notification triggers — DELIBERATELY NOT CREATED.
--
--    This migration originally created `notify_ticket_created()` and
--    `notify_leave_request()`. Both were removed before the file was ever
--    applied, because the application already notifies in application code and
--    the triggers were wrong on top of that:
--
--      a) `notify_ticket_created` would DUPLICATE `lib/tickets/actions.ts:91`.
--         Both insert a `ticket.created` notification for the same recipient —
--         the trigger keys on `new.requester_user_id`, the app notifies
--         `workspace.user.id` — which is the same person. Every new ticket would
--         produce two rows in the notification bell and two push sends.
--
--      b) `notify_leave_request` would notify the WRONG PERSON. It keys on
--         `new.employee_id`, i.e. the person who submitted their own leave, and
--         tells them "You have a new leave request pending review." The audience
--         is the approver, and `lib/leave/actions.ts:129` already notifies the
--         reviewing memberships.
--
--    Realtime delivery (section 1) and profile sync (section 2) are unaffected —
--    those are what this migration is actually needed for.
--
--    If a notification is ever wanted for a write that bypasses the application
--    (a seed script, a manual fix), add it as an explicit call in that path
--    rather than as a table trigger, so there is exactly one notification path.

-- 4) Least-privilege grants for the remaining security-definer function above.
--
--    Postgres grants EXECUTE on new functions to PUBLIC by default, and the
--    earlier hardening migration (20260908120000_harden_definer_revoke_anon)
--    predates this function so it cannot cover it. It is a trigger function —
--    it reads NEW and is only ever invoked by its trigger — so no role,
--    authenticated or otherwise, has any reason to call it directly.
--
--    This restores the project's invariant that every security-definer function
--    is revoked from anon/public. Direct-call exploitation is limited anyway
--    because NEW is unbound outside a trigger context, but PUBLIC-granted
--    EXECUTE on a definer function is a standing hazard for any future change
--    that introduces a parameter.
revoke execute on function public.handle_user_sign_in() from public, anon, authenticated;