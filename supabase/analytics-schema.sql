-- ============================================================================
-- ViSEF Multi-Agent — Analytics schema: access_logs (lượt đăng nhập)
-- Chạy SAU schema.sql và auth-schema.sql.
-- ============================================================================

create table if not exists public.access_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete set null,
  username   text,
  role       text,
  event      text not null default 'login',   -- 'login'
  created_at timestamptz not null default now()
);

create index if not exists idx_access_logs_created on public.access_logs(created_at);
create index if not exists idx_access_logs_user on public.access_logs(user_id);

-- ---------------------------------------------------------------------------
-- RLS: user tự ghi log của mình; admin/teacher đọc tất cả (phục vụ analytics).
-- ---------------------------------------------------------------------------
alter table public.access_logs enable row level security;

do $$
begin
  -- Ai cũng ghi được bản ghi login của chính mình.
  if not exists (select 1 from pg_policies where tablename='access_logs' and policyname='access_logs_insert_own') then
    create policy access_logs_insert_own on public.access_logs
      for insert with check (auth.uid() = user_id);
  end if;

  -- Admin & teacher đọc toàn bộ (dùng hàm current_user_role từ auth-schema).
  if not exists (select 1 from pg_policies where tablename='access_logs' and policyname='access_logs_select_staff') then
    create policy access_logs_select_staff on public.access_logs
      for select using (public.current_user_role() in ('teacher', 'admin'));
  end if;
end $$;
