-- query-missing-indexes: hot self-attendance + CRM stale-lead sorts
-- data-access: enable realtime for clock/CRM so the shell can refresh live

create index if not exists attendance_records_employee_date_idx
  on public.attendance_records (employee_id, work_date desc);

create index if not exists crm_leads_status_updated_idx
  on public.crm_leads (status, updated_at);

create index if not exists crm_deals_open_close_idx
  on public.crm_deals (expected_close_date)
  where expected_close_date is not null
    and stage not in ('won', 'lost');

do $$
begin
  begin
    alter publication supabase_realtime add table public.attendance_records;
  exception
    when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.crm_leads;
  exception
    when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.crm_deals;
  exception
    when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.tickets;
  exception
    when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.job_applications;
  exception
    when duplicate_object then null;
  end;
end $$;
