-- ============================================================================
-- ViSEF Multi-Agent — SETUP TỔNG HỢP (chạy MỘT lần duy nhất)
-- ----------------------------------------------------------------------------
-- Mở Supabase Dashboard > SQL Editor > New query, DÁN TOÀN BỘ file này và RUN.
--
-- File này gộp (đúng thứ tự phụ thuộc) các bước:
--   1) Core schema      : students, texts, debate_sessions, interaction_logs
--   2) Auth schema       : profiles, role, trigger tạo profile, RLS
--   3) Analytics schema  : access_logs + RLS  ← nguồn gốc lỗi 401 /rest/v1/access_logs
--   4) Migrate texts     : bổ sung cột còn thiếu cho bảng texts (nếu dùng schema cũ)
--   5) Seed admin        : tài khoản admin / 123123
--
-- TẤT CẢ đều idempotent: chạy lại nhiều lần KHÔNG gây lỗi, KHÔNG mất dữ liệu.
-- Vì vậy mỗi lần đổi Supabase project hoặc setup lại máy, chỉ cần chạy file này.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ############################################################################
-- 1) CORE SCHEMA
-- ############################################################################

create table if not exists public.students (
  id         uuid primary key default gen_random_uuid(),
  full_name  text not null,
  class_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.texts (
  id                uuid primary key default gen_random_uuid(),
  title             text not null,
  content           text not null,
  genre             text,
  keywords          jsonb default '[]'::jsonb,   -- [{ term, meaning }]
  background        text,
  initial_questions jsonb default '[]'::jsonb,   -- string[]
  created_at        timestamptz not null default now()
);

create table if not exists public.debate_sessions (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid references public.students(id) on delete cascade,
  text_id    uuid references public.texts(id) on delete cascade,
  status     text not null default 'active',     -- 'active' | 'completed'
  created_at timestamptz not null default now()
);

create table if not exists public.interaction_logs (
  id               uuid primary key default gen_random_uuid(),
  session_id       uuid references public.debate_sessions(id) on delete cascade,
  sender           text not null,
  message          text not null,
  attitude         text,
  s_critical_score double precision,
  fallacies        jsonb default '[]'::jsonb,
  graph_data       jsonb,
  timestamp        timestamptz not null default now()
);

create index if not exists idx_logs_session     on public.interaction_logs(session_id);
create index if not exists idx_sessions_student  on public.debate_sessions(student_id);
create index if not exists idx_sessions_text     on public.debate_sessions(text_id);

-- RLS core (demo nghiên cứu: cho phép thao tác bằng anon key).
alter table public.students         enable row level security;
alter table public.texts            enable row level security;
alter table public.debate_sessions  enable row level security;
alter table public.interaction_logs enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename='students' and policyname='anon_all_students') then
    create policy anon_all_students on public.students for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='texts' and policyname='anon_all_texts') then
    create policy anon_all_texts on public.texts for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='debate_sessions' and policyname='anon_all_sessions') then
    create policy anon_all_sessions on public.debate_sessions for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='interaction_logs' and policyname='anon_all_logs') then
    create policy anon_all_logs on public.interaction_logs for all using (true) with check (true);
  end if;
end $$;

-- ############################################################################
-- 2) AUTH SCHEMA (profiles + role + duyệt teacher)
-- ############################################################################

do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('student', 'teacher', 'admin');
  end if;
  if not exists (select 1 from pg_type where typname = 'account_status') then
    create type public.account_status as enum ('pending', 'active', 'rejected');
  end if;
end $$;

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

alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists status public.account_status not null default 'active';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_username_key') then
    begin
      alter table public.profiles add constraint profiles_username_key unique (username);
    exception when others then
      null;
    end;
  end if;
end $$;

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
  if not exists (select 1 from pg_policies where tablename='profiles' and policyname='profiles_select_staff') then
    create policy profiles_select_staff on public.profiles
      for select using (public.current_user_role() in ('teacher', 'admin'));
  end if;
  if not exists (select 1 from pg_policies where tablename='profiles' and policyname='profiles_update_own') then
    create policy profiles_update_own on public.profiles
      for update using (auth.uid() = id) with check (auth.uid() = id);
  end if;
  if not exists (select 1 from pg_policies where tablename='profiles' and policyname='profiles_update_admin') then
    create policy profiles_update_admin on public.profiles
      for update using (public.current_user_role() = 'admin')
      with check (public.current_user_role() = 'admin');
  end if;
  -- Cho phép user tự chèn profile của mình (fallback upsert trong authService).
  if not exists (select 1 from pg_policies where tablename='profiles' and policyname='profiles_insert_own') then
    create policy profiles_insert_own on public.profiles
      for insert with check (auth.uid() = id);
  end if;
end $$;

-- ############################################################################
-- 3) ANALYTICS SCHEMA (access_logs)  ← phần vá lỗi 401 /rest/v1/access_logs
-- ############################################################################

create table if not exists public.access_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete set null,
  username   text,
  role       text,
  event      text not null default 'login',
  created_at timestamptz not null default now()
);

create index if not exists idx_access_logs_created on public.access_logs(created_at);
create index if not exists idx_access_logs_user    on public.access_logs(user_id);

alter table public.access_logs enable row level security;

do $$
begin
  -- User tự ghi bản ghi login của chính mình (khắc phục lỗi 401 khi đăng nhập).
  if not exists (select 1 from pg_policies where tablename='access_logs' and policyname='access_logs_insert_own') then
    create policy access_logs_insert_own on public.access_logs
      for insert with check (auth.uid() = user_id);
  end if;
  -- Admin & teacher đọc toàn bộ (phục vụ trang analytics).
  if not exists (select 1 from pg_policies where tablename='access_logs' and policyname='access_logs_select_staff') then
    create policy access_logs_select_staff on public.access_logs
      for select using (public.current_user_role() in ('teacher', 'admin'));
  end if;
end $$;

-- ############################################################################
-- 4) MIGRATE TEXTS (an toàn nếu bảng texts đã đúng chuẩn)
-- ############################################################################

alter table public.texts add column if not exists content           text;
alter table public.texts add column if not exists keywords          jsonb default '[]'::jsonb;
alter table public.texts add column if not exists background        text;
alter table public.texts add column if not exists initial_questions jsonb default '[]'::jsonb;

do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='texts' and column_name='full_text') then
    update public.texts set content = coalesce(nullif(content, ''), full_text)
      where content is null or content = '';
  end if;
  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='texts' and column_name='excerpt') then
    update public.texts set content = coalesce(nullif(content, ''), excerpt)
      where content is null or content = '';
  end if;
  -- Gỡ NOT NULL của cột cũ `full_text` để insert chỉ-dùng-`content` không lỗi 23502.
  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='texts' and column_name='full_text') then
    alter table public.texts alter column full_text drop not null;
    update public.texts set full_text = coalesce(nullif(full_text, ''), content)
      where full_text is null or full_text = '';
  end if;
end $$;

update public.texts set keywords = '[]'::jsonb where keywords is null;
update public.texts set initial_questions = '[]'::jsonb where initial_questions is null;

-- ############################################################################
-- 5) SEED ADMIN (username: admin / mật khẩu: 123123)
-- ############################################################################

do $$
declare
  v_user_id uuid;
  v_email   text := 'admin@litcritic.local';
  v_pass    text := '123123';
begin
  select id into v_user_id from auth.users where email = v_email;

  if v_user_id is null then
    v_user_id := gen_random_uuid();
    insert into auth.users (
      id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new,
      email_change_token_current, phone_change, phone_change_token, reauthentication_token
    ) values (
      v_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      v_email, crypt(v_pass, gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('username','admin','full_name','Quản trị viên','role','admin'),
      now(), now(), '', '', '', '', '', '', '', ''
    );
  else
    update auth.users
      set encrypted_password = crypt(v_pass, gen_salt('bf')),
          email_confirmed_at = coalesce(email_confirmed_at, now()),
          raw_user_meta_data = jsonb_build_object('username','admin','full_name','Quản trị viên','role','admin'),
          updated_at = now()
      where id = v_user_id;
  end if;

  if not exists (select 1 from auth.identities where user_id = v_user_id and provider = 'email') then
    insert into auth.identities (
      id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', v_email),
      'email', v_email, now(), now(), now()
    );
  end if;

  insert into public.profiles (id, username, email, full_name, role, status)
  values (v_user_id, 'admin', v_email, 'Quản trị viên', 'admin', 'active')
  on conflict (id) do update
    set username = 'admin', role = 'admin', status = 'active', full_name = 'Quản trị viên';
end $$;

-- Ép mọi cột token NULL trong auth.users về '' (tránh lỗi "Database error querying schema").
update auth.users set
  confirmation_token         = coalesce(confirmation_token, ''),
  recovery_token             = coalesce(recovery_token, ''),
  email_change               = coalesce(email_change, ''),
  email_change_token_new     = coalesce(email_change_token_new, ''),
  email_change_token_current = coalesce(email_change_token_current, ''),
  phone_change               = coalesce(phone_change, ''),
  phone_change_token         = coalesce(phone_change_token, ''),
  reauthentication_token     = coalesce(reauthentication_token, '')
where
  confirmation_token is null or recovery_token is null or email_change is null
  or email_change_token_new is null or email_change_token_current is null
  or phone_change is null or phone_change_token is null or reauthentication_token is null;

-- ============================================================================
-- XONG. Tải lại trang app và đăng nhập — lỗi 401 /rest/v1/access_logs sẽ hết.
-- ============================================================================
