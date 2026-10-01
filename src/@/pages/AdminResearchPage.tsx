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
import { exportInteractionCsv, exportSessionSummaryCsv } from '@/lib/csv'
import { useNav } from '@/lib/navigation'
import { computeAssessment } from '@/lib/scoring'
import { isSupabaseConfigured } from '@/lib/supabaseClient'
import {
  listAllLogs,
  listSessionsWithDetails,
} from '@/services/supabaseService'
import type { DebateSession, InteractionLog } from '@/types'
import {
  ArrowLeft,
  Database,
  Download,
  Eye,
  FileSpreadsheet,
  FlaskConical,
  Users,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

export function AdminResearchPage() {
  const { navigate } = useNav()
  const [sessions, setSessions] = useState<DebateSession[]>([])
  const [logs, setLogs] = useState<InteractionLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewSession, setViewSession] = useState<DebateSession | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [s, l] = await Promise.all([
        listSessionsWithDetails(),
        listAllLogs(),
      ])
      setSessions(s)
      setLogs(l)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải được dữ liệu.')
    } finally {
      setLoading(false)
    }
  }, [])

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

  const stats = useMemo(() => {
    const scores = sessions
      .map((s) => computeAssessment(logsBySession.get(s.id) ?? []).s_critical)
      .filter((n) => n > 0)
    const avg =
      scores.length > 0
        ? scores.reduce((a, b) => a + b, 0) / scores.length
        : 0
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

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <Button
        variant="ghost"
        className="mb-4"
        onClick={() => navigate({ name: 'dashboard' })}
      >
        <ArrowLeft /> Về trang chủ
      </Button>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading flex items-center gap-2 text-2xl font-bold">
            <FlaskConical className="size-6" /> Phân hệ 5 · Quản trị & Xuất Dữ
            liệu Nghiên cứu ViSEF
          </h1>
          <p className="text-sm text-muted-foreground">
            Quản lý Interaction Logs và xuất CSV chuẩn hóa cho SPSS / Python
            (t-test, p-value).
          </p>
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
          Đang hiển thị dữ liệu demo lưu trong trình duyệt (chưa cấu hình
          Supabase).
        </div>
      )}

      {/* Thẻ thống kê */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Số phiên" value={stats.sessionCount} icon={FlaskConical} />
        <StatCard label="Học sinh" value={stats.studentCount} icon={Users} />
        <StatCard
          label="S_critical TB"
          value={stats.avgScore.toFixed(1)}
          icon={FileSpreadsheet}
        />
        <StatCard label="Số dòng log" value={stats.logCount} icon={Database} />
      </div>

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
              Chưa có phiên tranh luận nào được ghi nhận.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Học sinh</TableHead>
                  <TableHead>Lớp</TableHead>
                  <TableHead>Bài đọc</TableHead>
                  <TableHead>Ngày</TableHead>
                  <TableHead className="text-right">S_critical</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((s) => {
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
              {viewSession?.text?.title} · {viewLogs.length} tin nhắn
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
}: {
  label: string
  value: number | string
  icon: typeof Users
}) {
  return (
    <Card size="sm">
      <CardContent className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-5" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="font-heading text-xl font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}

export default AdminResearchPage
