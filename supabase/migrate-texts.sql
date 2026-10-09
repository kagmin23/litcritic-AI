-- ============================================================================
-- ViSEF — Migration bảng `texts` cho khớp code ứng dụng.
-- Dùng khi bảng texts được tạo theo schema cũ (author/excerpt/full_text) và
-- THIẾU các cột: content, keywords, background, initial_questions.
--
-- An toàn & idempotent: chỉ thêm cột còn thiếu, đổ dữ liệu cũ sang `content`.
-- Chạy trong Supabase > SQL Editor.
-- ============================================================================

-- 1) Bổ sung các cột code cần (nếu chưa có).
alter table public.texts add column if not exists content           text;
alter table public.texts add column if not exists keywords          jsonb default '[]'::jsonb;
alter table public.texts add column if not exists background        text;
alter table public.texts add column if not exists initial_questions jsonb default '[]'::jsonb;

-- 2) Đổ dữ liệu từ cột cũ (full_text / excerpt) sang content nếu content trống.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'texts' and column_name = 'full_text'
  ) then
    update public.texts
      set content = coalesce(nullif(content, ''), full_text)
      where content is null or content = '';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'texts' and column_name = 'excerpt'
  ) then
    update public.texts
      set content = coalesce(nullif(content, ''), excerpt)
      where content is null or content = '';
  end if;
end $$;

-- 3) Chuẩn hóa giá trị NULL cho các cột jsonb (phòng trường hợp cũ).
update public.texts set keywords = '[]'::jsonb where keywords is null;
update public.texts set initial_questions = '[]'::jsonb where initial_questions is null;

-- 3b) GỠ ràng buộc NOT NULL của cột cũ `full_text` (nếu còn), vì code mới chỉ
--     ghi vào `content`. Nếu không gỡ, insert sẽ lỗi 23502
--     ("null value in column full_text violates not-null constraint").
--     Đồng thời đổ `content` sang `full_text` cho các bản ghi cũ để nhất quán.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'texts' and column_name = 'full_text'
  ) then
    alter table public.texts alter column full_text drop not null;
    update public.texts
      set full_text = coalesce(nullif(full_text, ''), content)
      where full_text is null or full_text = '';
  end if;
end $$;

-- 4) (Tùy chọn) Kiểm tra lại kết quả:
--    select id, title, left(content, 60) as content_preview,
--           keywords, background, initial_questions
--    from public.texts;
