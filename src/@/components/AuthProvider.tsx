import { AuthContext } from '@/lib/authContext'
import {
  getCurrentUser,
  onAuthChange,
  signOut as svcSignOut,
} from '@/services/authService'
import type { AuthUser, UserRole } from '@/types'
import { useCallback, useEffect, useMemo, useState } from 'react'

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
      role: user?.profile.role ?? null,
      status,
      isPending: status === 'pending',
      isRejected: status === 'rejected',
      isActive: status === 'active',
      hasRole,
      refresh,
      logout,
    }
  }, [user, loading, hasRole, refresh, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export default AuthProvider
