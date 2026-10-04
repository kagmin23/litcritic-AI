import { RoundtableChat } from '@/components/RoundtableChat'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useAuth } from '@/lib/authContext'
import { exportInteractionCsv, exportSessionSummaryCsv } from '@/lib/csv'
import { fadeUpItem, staggerContainer } from '@/lib/motion'
import { useNav } from '@/lib/navigation'
import { computeAssessment } from '@/lib/scoring'
import { isSupabaseConfigured } from '@/lib/supabaseClient'
import { usePresence } from '@/lib/usePresence'
import {
  listAllLogs,
  listSessionsWithDetails,
} from '@/services/supabaseService'
import type { DebateSession, InteractionLog } from '@/types'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Database,
  Download,
  Eye,
  FileSpreadsheet,
  FlaskConical,
  Radio,
  Users,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

/** Trang Nghiên cứu ViSEF — dành cho giáo viên (và admin nếu cần). */
export function AdminResearchPage() {
  const { navigate } = useNav()
  const { user } = useAuth()
  const [sessions, setSessions] = useState<DebateSession[]>([])
  const [logs, setLogs] = useState<InteractionLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewSession, setViewSession] = useState<DebateSession | null>(null)
  const [page, setPage] = useState(1) // phân trang danh sách phiên

  // Presence toàn hệ thống → đếm học sinh đang online.
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
  const studentsOnline = members.filter((m) => m.role === 'student').length

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [s, l] = await Promise.all([
        listSessionsWithDetails(),
        listAllLogs(),
      ])
      // Chỉ lấy phiên của NGƯỜI KHÁC — loại trừ phiên của chính mình.
      const myName = (user?.profile.full_name || user?.profile.username || '')
        .trim()
        .toLowerCase()
      const filtered = myName
        ? s.filter(
            (x) =>
              (x.student?.full_name ?? '').trim().toLowerCase() !== myName
          )
        : s
      setSessions(filtered)
      setLogs(l)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải được dữ liệu.')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const logsBySession = useMemo(() => {
    const map = new Map<string, InteractionLog[]>()
    logs.forEach((l) => {
      const arr = map.get(l.session_id) ?? []
      arr.push(l)
      map.set(l.session_id, arr)
    })
    return map
  }, [logs])

  /** Số người (học sinh) từng tham gia một phiên — distinct chủ phiên + sender Student. */
  function participantsOf(session: DebateSession): number {
    const ids = new Set<string>()
    if (session.student_id) ids.add(session.student_id)
    // Mỗi phiên hiện gắn 1 học sinh; đếm tối thiểu 1 nếu có tương tác.
    const hasStudentTurn = (logsBySession.get(session.id) ?? []).some(
      (l) => l.sender === 'Student'
    )
    return ids.size || (hasStudentTurn ? 1 : 0)
  }

  const stats = useMemo(() => {
    const scores = sessions
      .map((s) => computeAssessment(logsBySession.get(s.id) ?? []).s_critical)
      .filter((n) => n > 0)
    const avg =
      scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
    const students = new Set(sessions.map((s) => s.student_id))
    return {
      sessionCount: sessions.length,
      studentCount: students.size,
      avgScore: avg,
      logCount: logs.length,
    }
  }, [sessions, logsBySession, logs])

  const viewLogs = viewSession
    ? (logsBySession.get(viewSession.id) ?? [])
    : []

  // Phân trang danh sách phiên — tối đa 10 phiên/trang.
  const PAGE_SIZE = 10
  const totalPages = Math.max(1, Math.ceil(sessions.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pagedSessions = sessions.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  )
  // Lưu ý: dùng `currentPage` (đã clamp) ở mọi nơi nên không cần đồng bộ lại state.

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-8">
      <Button
        variant="ghost"
        className="mb-3"
        onClick={() => navigate({ name: 'dashboard' })}
      >
        <ArrowLeft /> Về trang chủ
      </Button>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-sm">
            <FlaskConical className="size-5" />
          </div>
          <div>
            <h1 className="font-heading text-2xl font-bold">Nghiên cứu ViSEF</h1>
            <p className="text-sm text-muted-foreground">
              Theo dõi phiên học sinh, Interaction Logs và xuất CSV cho SPSS /
              Python (t-test, p-value).
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => exportSessionSummaryCsv(logs, sessions)}
            disabled={sessions.length === 0}
          >
            <FileSpreadsheet /> CSV tổng hợp theo phiên
          </Button>
          <Button
            onClick={() => exportInteractionCsv(logs, sessions)}
            disabled={logs.length === 0}
          >
            <Download /> Xuất Interaction Logs (CSV)
          </Button>
        </div>
      </div>

      {!isSupabaseConfigured && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <Database className="size-4" />
          Đang hiển thị dữ liệu demo lưu trong trình duyệt (chưa cấu hình Supabase).
        </div>
      )}

      {/* Thẻ thống kê */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4"
      >
        <StatCard
          label="Học sinh đang online"
          value={studentsOnline}
          icon={Radio}
          tint="#10b981"
          live
        />
        <StatCard label="Số phiên" value={stats.sessionCount} icon={FlaskConical} tint="#6366f1" />
        <StatCard
          label="Điểm phản biện trung bình"
          value={stats.avgScore.toFixed(1)}
          icon={FileSpreadsheet}
          tint="#a855f7"
        />
        <StatCard label="Số dòng log" value={stats.logCount} icon={Database} tint="#f59e0b" />
      </motion.div>

      {error && (
        <p className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Danh sách phiên tranh luận</CardTitle>
          <CardDescription>
            Nhấp "Xem logs" để xem toàn bộ hội thoại định tính của phiên.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Chưa có phiên tranh luận nào của người dùng khác.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Học sinh</TableHead>
                  <TableHead>Lớp</TableHead>
                  <TableHead>Bài đọc</TableHead>
                  <TableHead>Ngày</TableHead>
                  <TableHead className="text-center">Người tham gia</TableHead>
                  <TableHead className="text-right">S_critical</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedSessions.map((s) => {
                  const a = computeAssessment(logsBySession.get(s.id) ?? [])
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">
                        {s.student?.full_name ?? '—'}
                      </TableCell>
                      <TableCell>{s.student?.class_name ?? '—'}</TableCell>
                      <TableCell className="max-w-48 truncate">
                        {s.text?.title ?? '—'}
                      </TableCell>
                      <TableCell>
                        {new Date(s.created_at).toLocaleDateString('vi-VN')}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">
                          <Users className="mr-1 size-3" />
                          {participantsOf(s)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {a.s_critical.toFixed(1)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            s.status === 'completed' ? 'default' : 'secondary'
                          }
                        >
                          {s.status === 'completed'
                            ? 'Hoàn thành'
                            : 'Đang diễn ra'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setViewSession(s)}
                        >
                          <Eye /> Xem logs
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}

          {/* Phân trang — hiện khi có nhiều hơn 1 trang */}
          {!loading && sessions.length > 0 && totalPages > 1 && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
              <p className="text-xs text-muted-foreground">
                Hiển thị {(currentPage - 1) * PAGE_SIZE + 1}–
                {Math.min(currentPage * PAGE_SIZE, sessions.length)} /{' '}
                {sessions.length} phiên
              </p>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  aria-label="Trang trước"
                >
                  <ChevronLeft className="size-4" />
                </Button>
                {Array.from({ length: totalPages }).map((_, i) => {
                  const p = i + 1
                  return (
                    <Button
                      key={p}
                      variant={p === currentPage ? 'default' : 'outline'}
                      size="icon-sm"
                      onClick={() => setPage(p)}
                      aria-label={`Trang ${p}`}
                      aria-current={p === currentPage ? 'page' : undefined}
                    >
                      {p}
                    </Button>
                  )
                })}
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  aria-label="Trang sau"
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal logs chi tiết */}
      <Dialog
        open={!!viewSession}
        onOpenChange={(o) => !o && setViewSession(null)}
      >
        <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Hội thoại · {viewSession?.student?.full_name} (
              {viewSession?.student?.class_name})
            </DialogTitle>
            <DialogDescription>
              {viewSession?.text?.title} · {viewLogs.length} tin nhắn ·{' '}
              {viewSession ? participantsOf(viewSession) : 0} người tham gia
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[65vh] overflow-y-auto">
            <RoundtableChat logs={viewLogs} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function StatCard({
  label,
  value,
  icon: Icon,
  tint,
  live,
}: {
  label: string
  value: number | string
  icon: typeof Users
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

export default AdminResearchPage
