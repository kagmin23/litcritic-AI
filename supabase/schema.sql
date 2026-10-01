-- ============================================================================
-- ViSEF Multi-Agent — Database schema (PostgreSQL / Supabase)
-- Chạy toàn bộ file này trong Supabase > SQL Editor để khởi tạo CSDL.
-- ============================================================================

-- Bật tiện ích sinh UUID (Supabase thường đã bật sẵn).
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- 1) students
-- ---------------------------------------------------------------------------
create table if not exists public.students (
  id         uuid primary key default gen_random_uuid(),
  full_name  text not null,
  class_name text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2) texts (ngữ liệu đọc hiểu)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 3) debate_sessions
-- ---------------------------------------------------------------------------
create table if not exists public.debate_sessions (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid references public.students(id) on delete cascade,
  text_id    uuid references public.texts(id) on delete cascade,
  status     text not null default 'active',     -- 'active' | 'completed'
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 4) interaction_logs
-- ---------------------------------------------------------------------------
create table if not exists public.interaction_logs (
  id               uuid primary key default gen_random_uuid(),
  session_id       uuid references public.debate_sessions(id) on delete cascade,
  sender           text not null,  -- Student | Structuralist | Psychoanalytic
                                   -- | SocioHistorical | Feminist | Moderator
  message          text not null,
  attitude         text,           -- Agree | Disagree | Supplement
  s_critical_score double precision,
  fallacies        jsonb default '[]'::jsonb,   -- string[]
  graph_data       jsonb,                       -- { nodes, edges }
  timestamp        timestamptz not null default now()
);

create index if not exists idx_logs_session on public.interaction_logs(session_id);
create index if not exists idx_sessions_student on public.debate_sessions(student_id);
create index if not exists idx_sessions_text on public.debate_sessions(text_id);

-- ---------------------------------------------------------------------------
-- Row Level Security (RLS)
-- Demo nghiên cứu: cho phép thao tác công khai bằng anon key.
-- ⚠️ Môi trường thật nên siết lại theo auth của bạn.
-- ---------------------------------------------------------------------------
alter table public.students         enable row level security;
alter table public.texts            enable row level security;
alter table public.debate_sessions  enable row level security;
alter table public.interaction_logs enable row level security;

do $$
begin
  -- students
  if not exists (select 1 from pg_policies where tablename='students' and policyname='anon_all_students') then
    create policy anon_all_students on public.students for all using (true) with check (true);
  end if;
  -- texts
  if not exists (select 1 from pg_policies where tablename='texts' and policyname='anon_all_texts') then
    create policy anon_all_texts on public.texts for all using (true) with check (true);
  end if;
  -- debate_sessions
  if not exists (select 1 from pg_policies where tablename='debate_sessions' and policyname='anon_all_sessions') then
    create policy anon_all_sessions on public.debate_sessions for all using (true) with check (true);
  end if;
  -- interaction_logs
  if not exists (select 1 from pg_policies where tablename='interaction_logs' and policyname='anon_all_logs') then
    create policy anon_all_logs on public.interaction_logs for all using (true) with check (true);
  end if;
end $$;
