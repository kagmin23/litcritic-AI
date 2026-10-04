import type { AccountStatus, AuthUser, UserRole } from '@/types'
import { createContext, useContext } from 'react'

export interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  role: UserRole | null
  status: AccountStatus | null
  /** true nếu tài khoản (teacher) đang chờ admin phê duyệt */
  isPending: boolean
  /** true nếu tài khoản bị từ chối */
  isRejected: boolean
  /** Tài khoản đã được kích hoạt, được dùng đầy đủ tính năng */
  isActive: boolean
  /** Kiểm tra quyền: truyền 1 hoặc nhiều role được phép */
  hasRole: (...roles: UserRole[]) => boolean
  refresh: () => Promise<void>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth phải dùng bên trong <AuthProvider>')
  return ctx
}

/** Nhãn tiếng Việt cho role */
export const ROLE_LABEL: Record<UserRole, string> = {
  student: 'Học sinh',
  teacher: 'Giáo viên',
  admin: 'Quản trị viên',
}

/** Nhãn tiếng Việt cho trạng thái tài khoản */
export const STATUS_LABEL: Record<AccountStatus, string> = {
  pending: 'Chờ phê duyệt',
  active: 'Đã kích hoạt',
  rejected: 'Bị từ chối',
}
