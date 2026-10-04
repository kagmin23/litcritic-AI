import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ReTooltip,
  ResponsiveContainer,
} from 'recharts'
import {
  Activity,
  CalendarDays,
  Clock,
  LineChart as LineChartIcon,
  Radio,
  Users,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { fadeUpItem, staggerContainer } from '@/lib/motion'
import { useAuth, ROLE_LABEL } from '@/lib/authContext'
import { usePresence } from '@/lib/usePresence'
import { isSupabaseConfigured } from '@/lib/supabaseClient'
import { listAccessLogs, type AccessLog } from '@/services/accessService'
import type { UserRole } from '@/types'

/** Trang Analytics cho admin: lượt đăng nhập theo ngày/giờ + online realtime. */
export function AdminAnalyticsPage() {
  const { user } = useAuth()
  const [logs, setLogs] = useState<AccessLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const { members } = usePresence({
    channelName: 'presence:global',
    self: user
      ? {
          user_id: user.id,
          username: user.profile.username,
          full_name: user.profile.full_name,
          role: user.profile.role,
        }
      : null,
    track: true,
  })

  const onlineByRole = useMemo(() => {
    const r: Record<UserRole, number> = { student: 0, teacher: 0, admin: 0 }
    members.forEach((m) => {
      if (m.role in r) r[m.role as UserRole] += 1
    })
    return r
  }, [members])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setLogs(await listAccessLogs())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải được dữ liệu truy cập.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  // Lượt đăng nhập theo NGÀY (14 ngày gần nhất).
  const byDay = useMemo(() => {
    const days: { key: string; label: string; count: number }[] = []
    const map = new Map<string, number>()
    logs.forEach((l) => {
      const d = l.created_at.slice(0, 10)
      map.set(d, (map.get(d) ?? 0) + 1)
    })
    for (let i = 13; i >= 0; i--) {
      const dt = new Date()
      dt.setDate(dt.getDate() - i)
      const key = dt.toISOString().slice(0, 10)
      days.push({
        key,
        label: `${dt.getDate()}/${dt.getMonth() + 1}`,
        count: map.get(key) ?? 0,
      })
    }
    return days
  }, [logs])

  // Lượt đăng nhập theo GIỜ (0–23, gộp mọi ngày).
  const byHour = useMemo(() => {
    const arr = Array.from({ length: 24 }, (_, h) => ({
      label: `${h}h`,
      count: 0,
    }))
    logs.forEach((l) => {
      const h = new Date(l.created_at).getHours()
      arr[h].count += 1
    })
    return arr
  }, [logs])

  const totalLogins = logs.length
  const todayLogins = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return logs.filter((l) => l.created_at.slice(0, 10) === today).length
  }, [logs])

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-8">
      <div className="mb-6 flex items-start gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-sm">
          <Activity className="size-5" />
        </div>
        <div>
          <h1 className="font-heading text-2xl font-bold">Thống kê truy cập</h1>
          <p className="text-sm text-muted-foreground">
            Lượt đăng nhập theo thời gian và số người đang online.
          </p>
        </div>
      </div>

      {!isSupabaseConfigured && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          Chưa cấu hình Supabase — chưa có dữ liệu truy cập/online.
        </div>
      )}

      {/* Thẻ tổng quan */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4"
      >
        <Stat icon={Radio} label="Đang online" value={members.length} tint="#10b981" live />
        <Stat icon={Users} label="Lượt đăng nhập (tổng)" value={totalLogins} tint="#6366f1" />
        <Stat icon={CalendarDays} label="Đăng nhập hôm nay" value={todayLogins} tint="#a855f7" />
        <Stat
          icon={Clock}
          label="HS / GV online"
          value={`${onlineByRole.student} / ${onlineByRole.teacher}`}
          tint="#f59e0b"
        />
      </motion.div>

      {error && (
        <p className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {/* Người đang online */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-70" />
              <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
            </span>
            Đang online ({members.length})
          </CardTitle>
          <CardDescription>Cập nhật realtime qua Supabase Presence.</CardDescription>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Hiện không có ai online (hoặc Realtime chưa được bật).
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {members.map((m) => (
                <div
                  key={m.user_id}
                  className="flex items-center gap-2 rounded-full border bg-card py-1 pr-3 pl-1"
                >
                  <Avatar size="sm">
                    <AvatarFallback className="bg-brand-gradient text-[10px] text-white">
                      {(m.full_name || m.username || '?').slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium">
                    {m.full_name || m.username}
                  </span>
                  <Badge variant="secondary" className="text-[10px]">
                    {ROLE_LABEL[m.role as UserRole] ?? m.role}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Biểu đồ */}
      <div className="grid gap-6 lg:grid-cols-2">
        <motion.div variants={fadeUpItem} initial="hidden" animate="show">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LineChartIcon className="size-5 text-primary" /> Lượt đăng nhập
                theo ngày
              </CardTitle>
              <CardDescription>14 ngày gần nhất</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={byDay}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <ReTooltip
                        formatter={(v) => [`${v as number} lượt`, 'Đăng nhập']}
                        contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      />
                      <Bar dataKey="count" fill="#6366f1" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={fadeUpItem} initial="hidden" animate="show">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="size-5 text-primary" /> Lượt đăng nhập theo giờ
              </CardTitle>
              <CardDescription>Phân bố theo khung giờ trong ngày</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={byHour}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 10 }}
                        interval={1}
                      />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <ReTooltip
                        formatter={(v) => [`${v as number} lượt`, 'Đăng nhập']}
                        contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      />
                      <Bar dataKey="count" fill="#a855f7" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}

function Stat({
  icon: Icon,
  label,
  value,
  tint,
  live,
}: {
  icon: typeof Users
  label: string
  value: number | string
  tint: string
  live?: boolean
}) {
  return (
    <motion.div variants={fadeUpItem} whileHover={{ y: -3 }}>
      <Card size="sm" className="h-full">
        <CardContent className="flex items-center gap-3">
          <div
            className="relative flex size-10 items-center justify-center rounded-xl"
            style={{ background: `${tint}1f`, color: tint }}
          >
            <Icon className="size-5" />
            {live && (
              <span className="absolute -top-0.5 -right-0.5 flex size-2.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-70" />
                <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
              </span>
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="font-heading text-xl font-semibold">{value}</p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

export default AdminAnalyticsPage
