import { AuthLayout } from '@/components/AuthLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/lib/authContext'
import { useNav } from '@/lib/navigation'
import { isSupabaseConfigured } from '@/lib/supabaseClient'
import { logLogin } from '@/services/accessService'
import { signIn } from '@/services/authService'
import { motion } from 'framer-motion'
import {
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  LogIn,
  ShieldCheck,
  User,
} from 'lucide-react'
import { useState } from 'react'

export function LoginPage() {
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
      const u = await signIn(username.trim(), password)
      await logLogin(u)
      await refresh()
      navigate({ name: 'dashboard' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đăng nhập thất bại.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Chào mừng trở lại"
      subtitle="Đăng nhập để tiếp tục rèn luyện tư duy phản biện."
      topRight={
        <button
          onClick={() => navigate({ name: 'adminLogin' })}
          className="inline-flex items-center gap-1.5 rounded-full border bg-background/70 px-3 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur transition-colors hover:border-primary/40 hover:text-foreground"
        >
          <ShieldCheck className="size-3.5" /> Đăng nhập Quản trị
        </button>
      }
    >
      {!isSupabaseConfigured && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          Chưa cấu hình Supabase — cần điền <code>VITE_SUPABASE_URL</code> và{' '}
          <code>VITE_SUPABASE_ANON_KEY</code> trong <code>.env</code> để đăng nhập.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field icon={User} label="Tên đăng nhập">
          <Input
            autoComplete="username"
            placeholder="vd: nguyenvana"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="h-10 pl-9"
            required
          />
        </Field>

        <Field icon={Lock} label="Mật khẩu">
          <Input
            type={showPw ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-10 pr-9 pl-9"
            required
          />
          <button
            type="button"
            onClick={() => setShowPw((s) => !s)}
            className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label={showPw ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
          >
            {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </Field>

        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-lg bg-destructive/10 p-2.5 text-sm text-destructive"
          >
            {error}
          </motion.p>
        )}

        <Button
          type="submit"
          className="h-10 w-full"
          disabled={loading || !isSupabaseConfigured}
        >
          {loading ? <Loader2 className="animate-spin" /> : <LogIn />}
          Đăng nhập
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Chưa có tài khoản?{' '}
        <button
          onClick={() => navigate({ name: 'register' })}
          className="font-medium text-primary hover:underline"
        >
          Đăng ký ngay
        </button>
      </p>
    </AuthLayout>
  )
}

/** Ô nhập có icon + nhãn, bọc để định vị icon tuyệt đối. */
export function Field({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof User
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">{label}</label>
      <div className="relative">
        <Icon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        {children}
      </div>
    </div>
  )
}

export default LoginPage
