-- Add ownership for newly created texts. Existing rows remain unowned and cannot
-- be deleted by users until ownership is explicitly assigned by an administrator.
alter table public.texts
  add column if not exists owner_id uuid references auth.users(id) on delete set null;

drop policy if exists anon_all_texts on public.texts;
drop policy if exists texts_public_read on public.texts;
drop policy if exists texts_owner_insert on public.texts;
drop policy if exists texts_owner_delete on public.texts;

create policy texts_public_read
  on public.texts for select to anon, authenticated
  using (true);

create policy texts_owner_insert
  on public.texts for insert to authenticated
  with check (owner_id = auth.uid());

create policy texts_owner_delete
  on public.texts for delete to authenticated
  using (owner_id = auth.uid());