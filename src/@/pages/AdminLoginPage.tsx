import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/lib/authContext'
import { useNav } from '@/lib/navigation'
import { isSupabaseConfigured } from '@/lib/supabaseClient'
import { logLogin } from '@/services/accessService'
import { signIn, signOut } from '@/services/authService'
import { motion } from 'framer-motion'
import {
    AlertCircle,
    ArrowLeft,
    Eye,
    EyeOff,
    Loader2,
    Lock,
    ShieldCheck,
    User,
} from 'lucide-react'
import { useState } from 'react'

/**
 * Trang đăng nhập RIÊNG cho Quản trị viên — giao diện tối, nhấn mạnh an ninh.
 * Chỉ chấp nhận tài khoản role 'admin'; role khác bị từ chối + đăng xuất ngay.
 */
export function AdminLoginPage() {
  const { navigate } = useNav()
  const { refresh } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!username.trim() || !password) return
    setLoading(true)
    setError(null)
    try {
      const user = await signIn(username.trim(), password)
      if (user.profile.role !== 'admin') {
        // Không phải admin → đăng xuất, báo lỗi, không cho vào.
        await signOut()
        setError('Tài khoản này không có quyền Quản trị viên.')
        return
      }
      await logLogin(user)
      await refresh()
      navigate({ name: 'userMgmt' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đăng nhập thất bại.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 p-6 text-slate-100">
      {/* Nền tối + khối sáng */}
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
        <div className="bg-dot-grid absolute inset-0 text-white/[0.05]" />
        <div className="animate-aurora absolute -top-24 left-1/4 size-[26rem] rounded-full bg-indigo-700/30 blur-3xl" />
        <div
          className="animate-aurora absolute bottom-[-8rem] right-1/5 size-[24rem] rounded-full bg-fuchsia-700/25 blur-3xl"
          style={{ animationDelay: '-7s' }}
        />
      </div>

      <button
        onClick={() => navigate({ name: 'login' })}
        className="absolute top-5 left-5 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300 backdrop-blur transition-colors hover:bg-white/10 hover:text-white"
      >
        <ArrowLeft className="size-3.5" /> Về đăng nhập thường
      </button>

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/[0.04] p-7 shadow-2xl backdrop-blur-xl"
      >
        <div className="mb-5 flex flex-col items-center text-center">
          <div className="mb-3 flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-fuchsia-600 shadow-lg">
            <ShieldCheck className="size-7 text-white" />
          </div>
          <h1 className="font-heading text-2xl font-bold">Khu vực Quản trị</h1>
          <p className="mt-1 text-sm text-slate-400">
            Chỉ dành cho Quản trị viên hệ thống ViSEF.
          </p>
        </div>

        {!isSupabaseConfigured && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            Chưa cấu hình Supabase — không thể đăng nhập.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-300">
              Tên đăng nhập
            </label>
            <div className="relative">
              <User className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-slate-500" />
              <Input
                autoComplete="username"
                placeholder="admin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="h-10 border-white/15 bg-white/5 pl-9 text-slate-100 placeholder:text-slate-500"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-300">
              Mật khẩu
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-slate-500" />
              <Input
                type={showPw ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-10 border-white/15 bg-white/5 pr-9 pl-9 text-slate-100 placeholder:text-slate-500"
                required
              />
              <button
                type="button"
                onClick={() => setShowPw((s) => !s)}
                className="absolute top-1/2 right-2.5 -translate-y-1/2 text-slate-500 hover:text-slate-200"
                aria-label={showPw ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-lg bg-rose-500/15 p-2.5 text-sm text-rose-300"
            >
              {error}
            </motion.p>
          )}

          <Button
            type="submit"
            className="h-10 w-full bg-gradient-to-r from-indigo-500 to-fuchsia-600 text-white hover:from-indigo-500/90 hover:to-fuchsia-600/90"
            disabled={loading || !isSupabaseConfigured}
          >
            {loading ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
            Đăng nhập Quản trị
          </Button>
        </form>
      </motion.div>
    </div>
  )
}

export default AdminLoginPage
