import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Check,
  Loader2,
  ShieldCheck,
  UserCheck,
  Users,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ROLE_LABEL, STATUS_LABEL } from '@/lib/authContext'
import { fadeUpItem, staggerContainer } from '@/lib/motion'
import { isSupabaseConfigured } from '@/lib/supabaseClient'
import {
  listAllUsers,
  listPendingTeachers,
  setTeacherStatus,
} from '@/services/authService'
import type { AccountStatus, Profile, UserRole } from '@/types'

const STATUS_BADGE: Record<AccountStatus, string> = {
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  rejected: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
}

const ROLE_BADGE: Record<UserRole, string> = {
  student: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
  teacher: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
  admin: 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
}

/** Trang Quản lý người dùng — chỉ dành cho admin. */
export function UserManagementPage() {
  const [pending, setPending] = useState<Profile[]>([])
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [processingId, setProcessingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [p, u] = await Promise.all([listPendingTeachers(), listAllUsers()])
      setPending(p)
      setUsers(u)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải được danh sách.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  async function decide(profile: Profile, status: 'active' | 'rejected') {
    setProcessingId(profile.id)
    setError(null)
    try {
      await setTeacherStatus(profile.id, status)
      setPending((prev) => prev.filter((p) => p.id !== profile.id))
      setUsers((prev) =>
        prev.map((u) => (u.id === profile.id ? { ...u, status } : u))
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Thao tác thất bại.')
    } finally {
      setProcessingId(null)
    }
  }

  const counts = useMemo(() => {
    return {
      total: users.length,
      students: users.filter((u) => u.role === 'student').length,
      teachers: users.filter((u) => u.role === 'teacher').length,
      pending: pending.length,
    }
  }, [users, pending])

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-8">
      <div className="mb-6 flex items-start gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-sm">
          <ShieldCheck className="size-5" />
        </div>
        <div>
          <h1 className="font-heading text-2xl font-bold">Quản lý người dùng</h1>
          <p className="text-sm text-muted-foreground">
            Phê duyệt giáo viên và quản lý tài khoản trong hệ thống.
          </p>
        </div>
      </div>

      {!isSupabaseConfigured && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          Chưa cấu hình Supabase — không có dữ liệu người dùng.
        </div>
      )}

      {/* Thống kê */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4"
      >
        <Stat label="Tổng người dùng" value={counts.total} tint="#6366f1" />
        <Stat label="Học sinh" value={counts.students} tint="#0ea5e9" />
        <Stat label="Giáo viên" value={counts.teachers} tint="#a855f7" />
        <Stat label="Chờ duyệt" value={counts.pending} tint="#f59e0b" />
      </motion.div>

      {error && (
        <p className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {/* Phê duyệt giáo viên */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="size-5 text-primary" /> Phê duyệt giáo viên
            {pending.length > 0 && (
              <Badge variant="destructive">{pending.length} chờ duyệt</Badge>
            )}
          </CardTitle>
          <CardDescription>
            Giáo viên cần được duyệt trước khi dùng đầy đủ tính năng.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : pending.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Không có yêu cầu nào đang chờ duyệt. 🎉
            </p>
          ) : (
            <div className="space-y-2">
              {pending.map((p) => (
                <div
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                      🎓
                    </div>
                    <div className="leading-tight">
                      <div className="text-sm font-medium">
                        {p.full_name || p.username}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        @{p.username}
                        {p.created_at
                          ? ` · ${new Date(p.created_at).toLocaleDateString('vi-VN')}`
                          : ''}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-rose-600"
                      onClick={() => decide(p, 'rejected')}
                      disabled={processingId === p.id}
                    >
                      {processingId === p.id ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <X />
                      )}
                      Từ chối
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => decide(p, 'active')}
                      disabled={processingId === p.id}
                    >
                      {processingId === p.id ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <Check />
                      )}
                      Phê duyệt
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Danh sách toàn bộ người dùng */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-5 text-primary" /> Danh sách người dùng
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : users.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Chưa có người dùng nào.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Họ tên</TableHead>
                  <TableHead>Tên đăng nhập</TableHead>
                  <TableHead>Khối/Lớp</TableHead>
                  <TableHead>Vai trò</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">
                      {u.full_name || '—'}
                    </TableCell>
                    <TableCell>@{u.username}</TableCell>
                    <TableCell>{u.class_name || '—'}</TableCell>
                    <TableCell>
                      <Badge className={ROLE_BADGE[u.role]}>
                        {ROLE_LABEL[u.role]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_BADGE[u.status]}>
                        {STATUS_LABEL[u.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {u.role === 'teacher' && u.status !== 'active' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => decide(u, 'active')}
                          disabled={processingId === u.id}
                        >
                          <Check /> Kích hoạt
                        </Button>
                      )}
                      {u.role === 'teacher' && u.status === 'active' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-rose-600"
                          onClick={() => decide(u, 'rejected')}
                          disabled={processingId === u.id}
                        >
                          <X /> Thu hồi
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function Stat({
  label,
  value,
  tint,
}: {
  label: string
  value: number
  tint: string
}) {
  return (
    <motion.div variants={fadeUpItem} whileHover={{ y: -3 }}>
      <Card size="sm" className="h-full">
        <CardContent>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p
            className="font-heading text-2xl font-bold"
            style={{ color: tint }}
          >
            {value}
          </p>
        </CardContent>
      </Card>
    </motion.div>
  )
}

export default UserManagementPage
