import { isSupabaseConfigured, supabase } from '@/lib/supabaseClient'
import type { AuthUser } from '@/types'

// ============================================================================
// Access service — ghi & đọc lượt đăng nhập (bảng public.access_logs).
// ============================================================================

export interface AccessLog {
  id: string
  user_id: string | null
  username: string | null
  role: string | null
  event: string
  created_at: string
}

/** Ghi một lượt đăng nhập thành công. Lỗi được nuốt (không chặn đăng nhập). */
export async function logLogin(user: AuthUser): Promise<void> {
  if (!isSupabaseConfigured) return
  try {
    // RLS của access_logs yêu cầu `auth.uid() = user_id`. Ngay sau khi đăng nhập,
    // supabase-js gắn access token mới vào các request REST một cách BẤT ĐỒNG BỘ.
    // Nếu insert chạy trước khi token kịp đính kèm, request đi bằng anon key →
    // auth.uid() = null → vi phạm RLS → 401 (hay gặp ở production do độ trễ mạng).
    //
    // Vì vậy: chờ session sẵn sàng và CHỈ ghi khi token khớp đúng user, đồng thời
    // dùng id từ session để bảo đảm user_id luôn trùng auth.uid().
    const uid = await waitForAuthUid(user.id)
    if (!uid) {
      console.warn('[access] bỏ qua ghi access log: session chưa sẵn sàng.')
      return
    }

    const { error } = await supabase.from('access_logs').insert({
      user_id: uid,
      username: user.profile.username,
      role: user.profile.role,
      event: 'login',
    })
    if (error) throw error
  } catch (e) {
    console.warn('[access] không ghi được access log:', e)
  }
}

/**
 * Chờ cho tới khi supabase-js có session với đúng `expectedUserId`.
 * Thử lại vài lần (có khoảng nghỉ ngắn) để né race-condition ngay sau đăng nhập.
 * Trả về uid nếu sẵn sàng, hoặc null nếu hết lượt chờ.
 */
async function waitForAuthUid(
  expectedUserId: string,
  { attempts = 5, delayMs = 150 } = {}
): Promise<string | null> {
  for (let i = 0; i < attempts; i++) {
    const { data } = await supabase.auth.getSession()
    const uid = data.session?.user?.id
    if (uid && uid === expectedUserId) return uid
    await new Promise((r) => setTimeout(r, delayMs))
  }
  return null
}

/** Lấy toàn bộ access logs (admin/teacher). */
export async function listAccessLogs(): Promise<AccessLog[]> {
  if (!isSupabaseConfigured) return []
  const { data, error } = await supabase
    .from('access_logs')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as AccessLog[]
}
