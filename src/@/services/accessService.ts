import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient'
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
    await supabase.from('access_logs').insert({
      user_id: user.id,
      username: user.profile.username,
      role: user.profile.role,
      event: 'login',
    })
  } catch (e) {
    console.warn('[access] không ghi được access log:', e)
  }
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
