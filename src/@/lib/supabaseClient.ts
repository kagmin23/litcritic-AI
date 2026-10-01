import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Khởi tạo Supabase client.
 * Cấu hình biến môi trường trong file `.env` (xem `.env.example`):
 *   VITE_SUPABASE_URL=...
 *   VITE_SUPABASE_ANON_KEY=...
 */
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as
  | string
  | undefined

/** Có đủ cấu hình để kết nối Supabase hay không. */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

if (!isSupabaseConfigured) {
  // Không throw để app vẫn chạy được ở chế độ demo (local mock).
  // Các service sẽ kiểm tra `isSupabaseConfigured` trước khi gọi.
  console.warn(
    '[Supabase] Thiếu VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. ' +
      'Ứng dụng chạy ở chế độ demo (dữ liệu lưu tạm trong trình duyệt).'
  )
}

export const supabase: SupabaseClient = createClient(
  supabaseUrl ?? 'https://placeholder.supabase.co',
  supabaseAnonKey ?? 'public-anon-placeholder-key'
)
