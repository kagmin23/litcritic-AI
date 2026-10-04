import { IdleWarningDialog } from '@/components/IdleWarningDialog'
import { AuthContext } from '@/lib/authContext'
import { useIdleLogout } from '@/lib/useIdleLogout'
import {
    getCurrentUser,
    onAuthChange,
    signOut as svcSignOut,
} from '@/services/authService'
import type { AuthUser, UserRole } from '@/types'
import { useCallback, useEffect, useMemo, useState } from 'react'

// --- Cấu hình tự động đăng xuất (đọc từ .env, có fallback hợp lý) ---
function toPositiveNumber(value: unknown, fallback: number): number {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

const IDLE_MIN = toPositiveNumber(import.meta.env.VITE_IDLE_TIMEOUT_MIN, 30)
const IDLE_ADMIN_MIN = toPositiveNumber(
  import.meta.env.VITE_IDLE_TIMEOUT_ADMIN_MIN,
  15
)
const WARNING_SEC = toPositiveNumber(import.meta.env.VITE_IDLE_WARNING_SEC, 60)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      setUser(await getCurrentUser())
    } catch {
      setUser(null)
    }
  }, [])

  useEffect(() => {
    let active = true
    // Khởi tạo phiên hiện tại.
    void (async () => {
      try {
        const u = await getCurrentUser()
        if (active) setUser(u)
      } finally {
        if (active) setLoading(false)
      }
    })()

    // Lắng nghe login/logout/refresh token.
    const unsub = onAuthChange((u) => {
      if (active) setUser(u)
    })

    return () => {
      active = false
      unsub()
    }
  }, [])

  const logout = useCallback(async () => {
    await svcSignOut()
    setUser(null)
  }, [])

  // --- Tự động đăng xuất khi không hoạt động ---
  const role = user?.profile.role ?? null
  const idleMinutes = role === 'admin' ? IDLE_ADMIN_MIN : IDLE_MIN
  // Cảnh báo không vượt quá tổng thời gian idle.
  const warningMs = Math.min(WARNING_SEC, idleMinutes * 60 - 5) * 1000

  const { warning, secondsLeft, stayActive } = useIdleLogout({
    enabled: !!user,
    idleMs: idleMinutes * 60 * 1000,
    warningMs,
    onTimeout: () => {
      void logout()
    },
  })

  const hasRole = useCallback(
    (...roles: UserRole[]) => {
      if (!user) return false
      return roles.includes(user.profile.role)
    },
    [user]
  )

  const value = useMemo(() => {
    const status = user?.profile.status ?? null
    return {
      user,
      loading,
      role,
      status,
      isPending: status === 'pending',
      isRejected: status === 'rejected',
      isActive: status === 'active',
      hasRole,
      refresh,
      logout,
    }
  }, [user, loading, role, hasRole, refresh, logout])

  return (
    <AuthContext.Provider value={value}>
      {children}
      <IdleWarningDialog
        open={!!user && warning}
        secondsLeft={secondsLeft}
        onStay={stayActive}
        onLogout={() => void logout()}
      />
    </AuthContext.Provider>
  )
}

export default AuthProvider
