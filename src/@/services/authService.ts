import { isSupabaseConfigured, supabase } from '@/lib/supabaseClient'
import type { AuthUser, Profile, UserRole } from '@/types'

// ============================================================================
// Auth service — bọc Supabase Auth, ĐĂNG NHẬP BẰNG USERNAME.
// Username được ánh xạ nội bộ sang email <username>@litcritic.local để nạp vào
// Supabase Auth; người dùng chỉ thấy/nhập username.
// Teacher đăng ký ở trạng thái 'pending' và phải chờ admin duyệt.
// ============================================================================

/** Hậu tố email nội bộ (không gửi mail thật). */
const EMAIL_DOMAIN = 'litcritic.local'

/** Chuẩn hóa username: thường, bỏ khoảng trắng, chỉ chữ/số/._- */
export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, '')
}

export function usernameToEmail(username: string): string {
  return `${normalizeUsername(username)}@${EMAIL_DOMAIN}`
}

export interface SignUpInput {
  username: string
  password: string
  full_name: string
  class_name?: string
  role: UserRole
}

/** Dịch lỗi Supabase sang tiếng Việt (theo ngữ cảnh username). */
export function friendlyAuthError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('invalid login credentials'))
    return 'Tên đăng nhập hoặc mật khẩu không đúng.'
  if (m.includes('user already registered') || m.includes('already registered'))
    return 'Tên đăng nhập này đã tồn tại.'
  if (m.includes('duplicate key') || m.includes('profiles_username_key'))
    return 'Tên đăng nhập này đã tồn tại.'
  if (m.includes('password should be at least'))
    return 'Mật khẩu quá ngắn (tối thiểu 6 ký tự).'
  if (m.includes('rate limit') || m.includes('too many'))
    return 'Thao tác quá nhanh. Vui lòng thử lại sau giây lát.'
  return message
}

function assertConfigured(): void {
  if (!isSupabaseConfigured) {
    throw new Error(
      'Chưa cấu hình Supabase. Vui lòng điền VITE_SUPABASE_URL và ' +
        'VITE_SUPABASE_ANON_KEY trong file .env để dùng chức năng đăng nhập.'
    )
  }
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  if (error) return null
  return data as Profile
}

async function buildAuthUser(
  userId: string,
  email: string | undefined
): Promise<AuthUser | null> {
  let profile = await getProfile(userId)

  if (!profile) {
    const fallbackUsername = (email ?? '').split('@')[0] || 'user'
    const { data } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        username: fallbackUsername,
        email: email ?? '',
        role: 'student',
        status: 'active',
      })
      .select()
      .single()
    profile =
      (data as Profile) ??
      ({
        id: userId,
        username: fallbackUsername,
        email: email ?? '',
        full_name: '',
        class_name: '',
        role: 'student',
        status: 'active',
      } as Profile)
  }

  return { id: userId, email: email ?? profile.email, profile }
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  if (!isSupabaseConfigured) return null
  const { data } = await supabase.auth.getSession()
  const session = data.session
  if (!session?.user) return null
  return buildAuthUser(session.user.id, session.user.email ?? undefined)
}

/** Đăng ký bằng username. Teacher sẽ ở trạng thái pending (trigger DB xử lý). */
export async function signUp(input: SignUpInput): Promise<{
  needsEmailConfirm: boolean
  user: AuthUser | null
}> {
  assertConfigured()
  const username = normalizeUsername(input.username)
  const { data, error } = await supabase.auth.signUp({
    email: usernameToEmail(username),
    password: input.password,
    options: {
      data: {
        username,
        full_name: input.full_name,
        class_name: input.class_name ?? '',
        role: input.role,
      },
    },
  })
  if (error) throw new Error(friendlyAuthError(error.message))

  if (!data.session || !data.user) {
    return { needsEmailConfirm: true, user: null }
  }
  const user = await buildAuthUser(data.user.id, data.user.email ?? undefined)
  return { needsEmailConfirm: false, user }
}

/** Đăng nhập bằng username + mật khẩu. */
export async function signIn(
  username: string,
  password: string
): Promise<AuthUser> {
  assertConfigured()
  const { data, error } = await supabase.auth.signInWithPassword({
    email: usernameToEmail(username),
    password,
  })
  if (error) throw new Error(friendlyAuthError(error.message))
  const user = await buildAuthUser(data.user.id, data.user.email ?? undefined)
  if (!user) throw new Error('Không tải được hồ sơ người dùng.')
  return user
}

export async function signOut(): Promise<void> {
  if (!isSupabaseConfigured) return
  await supabase.auth.signOut()
}

/** Cập nhật mật khẩu mới (dùng khi đổi mật khẩu trong app). */
export async function updatePassword(newPassword: string): Promise<void> {
  assertConfigured()
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw new Error(friendlyAuthError(error.message))
}

// ---------------------------------------------------------------------------
// Duyệt teacher (admin)
// ---------------------------------------------------------------------------
export async function listPendingTeachers(): Promise<Profile[]> {
  if (!isSupabaseConfigured) return []
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'teacher')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as Profile[]
}

export async function listAllTeachers(): Promise<Profile[]> {
  if (!isSupabaseConfigured) return []
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'teacher')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Profile[]
}

/** Toàn bộ người dùng (admin dùng cho trang quản lý user). */
export async function listAllUsers(): Promise<Profile[]> {
  if (!isSupabaseConfigured) return []
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Profile[]
}

export async function setTeacherStatus(
  profileId: string,
  status: 'active' | 'rejected'
): Promise<void> {
  assertConfigured()
  const { error } = await supabase
    .from('profiles')
    .update({ status })
    .eq('id', profileId)
  if (error) throw new Error(friendlyAuthError(error.message))
}

export function onAuthChange(
  callback: (user: AuthUser | null) => void
): () => void {
  if (!isSupabaseConfigured) return () => {}
  const { data } = supabase.auth.onAuthStateChange(async (_event, session) => {
    if (session?.user) {
      callback(
        await buildAuthUser(session.user.id, session.user.email ?? undefined)
      )
    } else {
      callback(null)
    }
  })
  return () => data.subscription.unsubscribe()
}
