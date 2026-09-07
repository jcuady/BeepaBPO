-- Beepa Phase 2: Supabase Storage buckets and policies

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('employee-documents', 'employee-documents', false, 52428800, null),
  ('applicant-documents', 'applicant-documents', false, 52428800, null),
  ('ticket-attachments', 'ticket-attachments', false, 26214400, null),
  ('client-documents', 'client-documents', false, 52428800, null),
  ('contracts', 'contracts', false, 52428800, null),
  ('payslips', 'payslips', false, 10485760, array['application/pdf']),
  ('marketing-media', 'marketing-media', false, 52428800, null)
on conflict (id) do nothing;

-- Avatars: authenticated users upload/read own folder {uid}/...
create policy storage_avatars_select
  on storage.objects for select to authenticated
  using (bucket_id = 'avatars');

create policy storage_avatars_insert
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy storage_avatars_update
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy storage_avatars_delete
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Employee documents: path {employee_id}/...
create policy storage_employee_docs_select
  on storage.objects for select to authenticated
  using (
    bucket_id = 'employee-documents'
    and (
      public.has_permission('employees.documents.read')
      or public.has_permission('employees.documents.manage')
      or public.is_self_employee(((storage.foldername(name))[1])::uuid)
    )
  );

create policy storage_employee_docs_insert
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'employee-documents'
    and (
      public.has_permission('employees.documents.manage')
      or public.is_self_employee(((storage.foldername(name))[1])::uuid)
    )
  );

create policy storage_employee_docs_update
  on storage.objects for update to authenticated
  using (
    bucket_id = 'employee-documents'
    and public.has_permission('employees.documents.manage')
  )
  with check (
    bucket_id = 'employee-documents'
    and public.has_permission('employees.documents.manage')
  );

create policy storage_employee_docs_delete
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'employee-documents'
    and public.has_permission('employees.documents.manage')
  );

-- Applicant documents: recruiters + own applicant profile path
create policy storage_applicant_docs_select
  on storage.objects for select to authenticated
  using (
    bucket_id = 'applicant-documents'
    and (
      public.has_permission('recruitment.read')
      or public.has_permission('recruitment.manage')
      or (storage.foldername(name))[1] = (select auth.uid())::text
    )
  );

create policy storage_applicant_docs_insert
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'applicant-documents'
    and (
      public.has_permission('recruitment.manage')
      or (storage.foldername(name))[1] = (select auth.uid())::text
    )
  );

create policy storage_applicant_docs_manage
  on storage.objects for update to authenticated
  using (
    bucket_id = 'applicant-documents'
    and public.has_permission('recruitment.manage')
  )
  with check (
    bucket_id = 'applicant-documents'
    and public.has_permission('recruitment.manage')
  );

create policy storage_applicant_docs_delete
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'applicant-documents'
    and public.has_permission('recruitment.manage')
  );

-- Ticket attachments: internal + client ticket access
create policy storage_ticket_attachments_select
  on storage.objects for select to authenticated
  using (
    bucket_id = 'ticket-attachments'
    and (
      public.is_internal_user()
      or public.has_permission('tickets.read')
      or public.has_permission('tickets.manage')
      or public.has_permission('tickets.self')
    )
  );

create policy storage_ticket_attachments_insert
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'ticket-attachments'
    and (
      public.is_internal_user()
      or public.has_permission('tickets.manage')
      or public.has_permission('tickets.self')
    )
  );

-- Client documents: client tenant isolation
create policy storage_client_docs_select
  on storage.objects for select to authenticated
  using (
    bucket_id = 'client-documents'
    and (
      public.has_permission('clients.manage')
      or public.can_access_client(((storage.foldername(name))[1])::uuid)
    )
  );

create policy storage_client_docs_insert
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'client-documents'
    and (
      public.has_permission('clients.manage')
      or public.can_access_client(((storage.foldername(name))[1])::uuid)
    )
  );

create policy storage_client_docs_manage
  on storage.objects for update to authenticated
  using (
    bucket_id = 'client-documents'
    and public.has_permission('clients.manage')
  )
  with check (
    bucket_id = 'client-documents'
    and public.has_permission('clients.manage')
  );

-- Contracts: internal sales/finance + client read own
create policy storage_contracts_select
  on storage.objects for select to authenticated
  using (
    bucket_id = 'contracts'
    and (
      public.is_internal_user()
      or public.has_permission('crm.read')
      or public.has_permission('billing.read')
      or public.can_access_client(((storage.foldername(name))[1])::uuid)
    )
  );

create policy storage_contracts_insert
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'contracts'
    and (
      public.has_permission('crm.manage')
      or public.has_permission('clients.manage')
      or public.has_permission('billing.manage')
    )
  );

-- Payslips: own employee or payroll.read
create policy storage_payslips_select
  on storage.objects for select to authenticated
  using (
    bucket_id = 'payslips'
    and (
      public.has_permission('payroll.read')
      or public.has_permission('payroll.manage')
      or (
        public.has_permission('payroll.self')
        and public.is_self_employee(((storage.foldername(name))[1])::uuid)
      )
    )
  );

create policy storage_payslips_insert
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'payslips'
    and public.has_permission('payroll.manage')
  );

-- Marketing media: CMS managers + public read via signed URLs only (bucket private)
create policy storage_marketing_media_select
  on storage.objects for select to authenticated
  using (
    bucket_id = 'marketing-media'
    and (
      public.has_permission('cms.manage')
      or public.is_internal_user()
    )
  );

create policy storage_marketing_media_insert
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'marketing-media'
    and public.has_permission('cms.manage')
  );

create policy storage_marketing_media_manage
  on storage.objects for update to authenticated
  using (
    bucket_id = 'marketing-media'
    and public.has_permission('cms.manage')
  )
  with check (
    bucket_id = 'marketing-media'
    and public.has_permission('cms.manage')
  );

create policy storage_marketing_media_delete
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'marketing-media'
    and public.has_permission('cms.manage')
  );
