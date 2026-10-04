-- ============================================================================
-- ViSEF Multi-Agent — Seed tài khoản ADMIN
-- Chạy SAU schema.sql và auth-schema.sql.
--
--   Username : admin
--   Mật khẩu : 123123
--   (email nội bộ ánh xạ: admin@litcritic.local)
--
-- Tạo trực tiếp trong auth.users + profiles. Idempotent: chạy nhiều lần không lỗi.
--
-- LƯU Ý: GoTrue (Supabase Auth) yêu cầu nhiều cột token trong auth.users phải
-- là CHUỖI RỖNG, KHÔNG được NULL. Nếu để NULL, khi đăng nhập sẽ gặp lỗi
-- "Database error querying schema". Vì vậy ta điền '' cho các cột đó.
-- ============================================================================

create extension if not exists "pgcrypto";

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
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      -- Các cột token GoTrue cần '' (không NULL):
      confirmation_token,
      recovery_token,
      email_change,
      email_change_token_new,
      email_change_token_current,
      phone_change,
      phone_change_token,
      reauthentication_token
    ) values (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      v_email,
      crypt(v_pass, gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object(
        'username', 'admin',
        'full_name', 'Quản trị viên',
        'role', 'admin'
      ),
      now(),
      now(),
      '', '', '', '', '', '', '', ''
    );
  else
    update auth.users
      set encrypted_password = crypt(v_pass, gen_salt('bf')),
          email_confirmed_at = coalesce(email_confirmed_at, now()),
          raw_user_meta_data = jsonb_build_object(
            'username', 'admin',
            'full_name', 'Quản trị viên',
            'role', 'admin'
          ),
          updated_at = now()
      where id = v_user_id;
  end if;

  -- Bản ghi identity cho provider email.
  if not exists (
    select 1 from auth.identities where user_id = v_user_id and provider = 'email'
  ) then
    insert into auth.identities (
      id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(),
      v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', v_email),
      'email',
      v_email,
      now(), now(), now()
    );
  end if;

  -- Upsert profile admin (active).
  insert into public.profiles (id, username, email, full_name, role, status)
  values (v_user_id, 'admin', v_email, 'Quản trị viên', 'admin', 'active')
  on conflict (id) do update
    set username = 'admin',
        role = 'admin',
        status = 'active',
        full_name = 'Quản trị viên';
end $$;

-- ---------------------------------------------------------------------------
-- CHỮA LỖI: ép mọi cột token đang NULL trong auth.users về chuỗi rỗng.
-- Khắc phục lỗi "Database error querying schema" cho MỌI user bị ảnh hưởng
-- (gồm cả các tài khoản đã lỡ tạo trước đó).
-- ---------------------------------------------------------------------------
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
  confirmation_token is null
  or recovery_token is null
  or email_change is null
  or email_change_token_new is null
  or email_change_token_current is null
  or phone_change is null
  or phone_change_token is null
  or reauthentication_token is null;
