-- Seed Beepa SLA policies + apply on ticket insert (security definer; clients cannot SELECT policies).

create unique index if not exists ticket_sla_policies_org_priority_uidx
  on public.ticket_sla_policies (organization_id, priority);

insert into public.ticket_sla_policies (
  organization_id,
  name,
  priority,
  first_response_minutes,
  resolution_minutes,
  active
)
values
  ('11111111-1111-1111-1111-111111111111', 'Low — 48h resolve', 'low', 480, 2880, true),
  ('11111111-1111-1111-1111-111111111111', 'Normal — 24h resolve', 'normal', 240, 1440, true),
  ('11111111-1111-1111-1111-111111111111', 'High — 8h resolve', 'high', 60, 480, true),
  ('11111111-1111-1111-1111-111111111111', 'Urgent — 4h resolve', 'urgent', 30, 240, true)
on conflict (organization_id, priority) do update
set
  name = excluded.name,
  first_response_minutes = excluded.first_response_minutes,
  resolution_minutes = excluded.resolution_minutes,
  active = true,
  updated_at = now();

create or replace function public.tickets_apply_sla()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pol public.ticket_sla_policies%rowtype;
  base_at timestamptz;
begin
  if new.sla_policy_id is not null and new.sla_due_at is not null then
    return new;
  end if;

  select * into pol
  from public.ticket_sla_policies
  where organization_id = '11111111-1111-1111-1111-111111111111'
    and priority = new.priority
    and active = true
  limit 1;

  if not found then
    return new;
  end if;

  base_at := coalesce(new.created_at, now());
  new.sla_policy_id := coalesce(new.sla_policy_id, pol.id);
  new.sla_due_at := coalesce(
    new.sla_due_at,
    base_at + make_interval(mins => pol.resolution_minutes)
  );
  return new;
end;
$$;

drop trigger if exists tickets_apply_sla on public.tickets;
create trigger tickets_apply_sla
  before insert on public.tickets
  for each row execute function public.tickets_apply_sla();

-- Backfill open tickets missing SLA (same Beepa policies).
update public.tickets t
set
  sla_policy_id = pol.id,
  sla_due_at = t.created_at + make_interval(mins => pol.resolution_minutes)
from public.ticket_sla_policies pol
where pol.organization_id = '11111111-1111-1111-1111-111111111111'
  and pol.priority = t.priority
  and pol.active = true
  and t.sla_due_at is null
  and t.status not in ('resolved', 'closed');
