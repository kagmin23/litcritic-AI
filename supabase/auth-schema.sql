-- ============================================================================
-- ViSEF Multi-Agent — Auth schema (profiles + role + duyệt teacher) cho Supabase Auth
-- Đăng nhập bằng USERNAME (ánh xạ nội bộ sang email <username>@litcritic.local).
-- Chạy file này SAU khi đã chạy schema.sql.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Kiểu role & trạng thái duyệt
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('student', 'teacher', 'admin');
  end if;
  if not exists (select 1 from pg_type where typname = 'account_status') then
    create type public.account_status as enum ('pending', 'active', 'rejected');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Bảng profiles: 1-1 với auth.users
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  username   text unique,
  email      text,
  full_name  text,
  class_name text,
  role       public.user_role not null default 'student',
  status     public.account_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Nếu bảng đã tồn tại từ phiên bản trước, bổ sung cột còn thiếu.
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists status public.account_status not null default 'active';
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_username_key'
  ) then
    begin
      alter table public.profiles add constraint profiles_username_key unique (username);
    exception when others then
      -- bỏ qua nếu đã có ràng buộc tương đương
      null;
    end;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Tự động tạo profile khi có user mới đăng ký.
-- Lấy username / full_name / class_name / role từ raw_user_meta_data.
-- Teacher → status 'pending' (chờ duyệt); student/admin → 'active'.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  meta_role text;
  meta_status public.account_status;
  meta_username text;
begin
  meta_role := coalesce(new.raw_user_meta_data->>'role', 'student');
  if meta_role not in ('student', 'teacher', 'admin') then
    meta_role := 'student';
  end if;

  meta_username := coalesce(
    nullif(new.raw_user_meta_data->>'username', ''),
    split_part(new.email, '@', 1)
  );

  if meta_role = 'teacher' then
    meta_status := 'pending';
  else
    meta_status := 'active';
  end if;

  insert into public.profiles (id, username, email, full_name, class_name, role, status)
  values (
    new.id,
    meta_username,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'class_name', ''),
    meta_role::public.user_role,
    meta_status
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- updated_at tự cập nhật
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_touch on public.profiles;
create trigger trg_profiles_touch
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

create or replace function public.current_user_role()
returns text language sql stable security definer set search_path = public as $$
  select role::text from public.profiles where id = auth.uid()
$$;

do $$
begin
  if not exists (select 1 from pg_policies where tablename='profiles' and policyname='profiles_select_own') then
    create policy profiles_select_own on public.profiles
      for select using (auth.uid() = id);
  end if;

  -- Teacher & admin đọc được mọi profile (trang quản trị / duyệt)
  if not exists (select 1 from pg_policies where tablename='profiles' and policyname='profiles_select_staff') then
    create policy profiles_select_staff on public.profiles
      for select using (public.current_user_role() in ('teacher', 'admin'));
  end if;

  -- Tự cập nhật profile của mình
  if not exists (select 1 from pg_policies where tablename='profiles' and policyname='profiles_update_own') then
    create policy profiles_update_own on public.profiles
      for update using (auth.uid() = id) with check (auth.uid() = id);
  end if;

  -- Admin cập nhật mọi profile (duyệt teacher = đổi status)
  if not exists (select 1 from pg_policies where tablename='profiles' and policyname='profiles_update_admin') then
    create policy profiles_update_admin on public.profiles
      for update using (public.current_user_role() = 'admin')
      with check (public.current_user_role() = 'admin');
  end if;
end $$;
