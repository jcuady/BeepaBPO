-- Allow client portal members to insert shared documents for their org.
-- Storage already permits client-documents uploads via can_access_client(folder).
create policy documents_insert_client
  on public.documents for insert to authenticated
  with check (
    client_organization_id is not null
    and public.can_access_client(client_organization_id)
    and visibility in ('client_visible', 'public')
  );
