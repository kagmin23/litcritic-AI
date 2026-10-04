import { AuthLayout } from '@/components/AuthLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/lib/authContext'
import { useNav } from '@/lib/navigation'
import { isSupabaseConfigured } from '@/lib/supabaseClient'
import { Field } from '@/pages/LoginPage'
import { signUp } from '@/services/authService'
import type { UserRole } from '@/types'
import { motion } from 'framer-motion'
import {
  AlertCircle,
  AtSign,
  CheckCircle2,
  Eye,
  EyeOff,
  GraduationCap,
  Loader2,
  Lock,
  User,
  UserPlus,
} from 'lucide-react'
import { useState } from 'react'

const ROLES: { value: UserRole; label: string; desc: string; emoji: string }[] = [
  { value: 'student', label: 'Học sinh', desc: 'Tham gia tranh luận', emoji: '🙋' },
  { value: 'teacher', label: 'Giáo viên', desc: 'Theo dõi & quản trị', emoji: '🎓' },
]

const GRADES = [6, 7, 8, 9, 10, 11, 12] as const
const gradeLabel = (g: number) => `Khối ${g}`

/** Chỉ cho phép chữ thường, số và . _ - ; 3–20 ký tự. */
const USERNAME_RE = /^[a-z0-9._-]{3,20}$/

export function RegisterPage() {
  const { navigate } = useNav()
  const { refresh } = useAuth()
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [grade, setGrade] = useState<number>(10)
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<UserRole>('student')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const uname = username.trim().toLowerCase()
    if (!fullName.trim() || !uname || password.length < 6) {
      setError('Vui lòng điền đủ thông tin, mật khẩu tối thiểu 6 ký tự.')
      return
    }
    if (!USERNAME_RE.test(uname)) {
      setError(
        'Tên đăng nhập 3–20 ký tự, chỉ gồm chữ thường, số và . _ - (không dấu, không khoảng trắng).'
      )
      return
    }
    setLoading(true)
    setError(null)
    try {
      await signUp({
        username: uname,
        password,
        full_name: fullName.trim(),
        class_name: role === 'student' ? gradeLabel(grade) : '',
        role,
      })
      await refresh()
      // Teacher vào thẳng app nhưng ở trạng thái pending (khóa tính năng).
      navigate({ name: 'dashboard' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đăng ký thất bại.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Tạo tài khoản"
      subtitle="Tham gia nền tảng rèn luyện tư duy phản biện ViSEF."
    >
      {!isSupabaseConfigured && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          Chưa cấu hình Supabase — cần điền thông tin kết nối trong{' '}
          <code>.env</code> để đăng ký.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Chọn vai trò */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Bạn là</label>
          <div className="grid grid-cols-2 gap-2">
            {ROLES.map((r) => {
              const active = role === r.value
              return (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setRole(r.value)}
                  className={`relative rounded-xl border p-3 text-left transition-all ${
                    active
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/30'
                      : 'hover:border-primary/40 hover:bg-muted'
                  }`}
                >
                  <div className="text-lg">{r.emoji}</div>
                  <div className="text-sm font-medium">{r.label}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {r.desc}
                  </div>
                  {active && (
                    <motion.div
                      layoutId="role-check"
                      className="absolute top-2 right-2"
                    >
                      <CheckCircle2 className="size-4 text-primary" />
                    </motion.div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {role === 'teacher' && (
          <p className="rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            Tài khoản giáo viên cần được <strong>Quản trị viên phê duyệt</strong>{' '}
            trước khi mở khóa đầy đủ tính năng.
          </p>
        )}

        <Field icon={User} label="Họ và tên">
          <Input
            placeholder="Nguyễn Văn A"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="h-10 pl-9"
            required
          />
        </Field>

        <Field icon={AtSign} label="Tên đăng nhập">
          <Input
            autoComplete="username"
            placeholder="vd: nguyenvana"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="h-10 pl-9"
            required
          />
        </Field>

        {role === 'student' && (
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-sm font-medium">
              <GraduationCap className="size-4 text-muted-foreground" /> Khối lớp
            </label>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
              {GRADES.map((g) => {
                const active = grade === g
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGrade(g)}
                    aria-pressed={active}
                    className={`relative rounded-lg border py-2 text-sm font-semibold transition-all ${
                      active
                        ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                        : 'hover:border-primary/40 hover:bg-muted'
                    }`}
                  >
                    {g}
                  </button>
                )
              })}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Chọn khối phù hợp với em (THCS 6–9 · THPT 10–12).
            </p>
          </div>
        )}

        <Field icon={Lock} label="Mật khẩu">
          <Input
            type={showPw ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="Tối thiểu 6 ký tự"
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
          {loading ? <Loader2 className="animate-spin" /> : <UserPlus />}
          Đăng ký
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Đã có tài khoản?{' '}
        <button
          onClick={() => navigate({ name: 'login' })}
          className="font-medium text-primary hover:underline"
        >
          Đăng nhập
        </button>
      </p>
    </AuthLayout>
  )
}

export default RegisterPage
