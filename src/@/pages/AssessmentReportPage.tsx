import { RadarChartAssessment } from '@/components/RadarChartAssessment'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { SCORE_WEIGHTS } from '@/lib/agents'
import { fadeUpItem, staggerContainer } from '@/lib/motion'
import { useNav } from '@/lib/navigation'
import { collectFallacies, computeAssessment } from '@/lib/scoring'
import { getSession, getText, listLogsBySession } from '@/services/supabaseService'
import type { CriticalAssessment, InteractionLog, TextItem } from '@/types'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Gauge,
  Home,
  Lightbulb,
  TriangleAlert,
  Trophy,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

interface AssessmentReportPageProps {
  sessionId: string
}

function ratingLabel(score: number): { label: string; className: string } {
  if (score >= 80)
    return { label: 'Xuất sắc', className: 'bg-emerald-600 text-white' }
  if (score >= 65) return { label: 'Tốt', className: 'bg-sky-600 text-white' }
  if (score >= 50)
    return { label: 'Khá', className: 'bg-amber-500 text-white' }
  return { label: 'Cần cải thiện', className: 'bg-rose-600 text-white' }
}

const IMPROVEMENT_TIPS: Record<string, string> = {
  'Khái quát hóa vội vàng':
    'Thu thập thêm dẫn chứng từ nhiều chi tiết trước khi kết luận chung.',
  'Công kích cá nhân':
    'Tập trung phản biện vào luận điểm, tránh nhắm vào người/nhân vật.',
  'Lập luận vòng tròn':
    'Dùng bằng chứng độc lập để chứng minh, tránh lấy kết luận làm tiền đề.',
  'Ngụy biện bù nhìn':
    'Trình bày lại chính xác quan điểm đối phương trước khi phản bác.',
  'Dựa vào uy quyền':
    'Giải thích vì sao nhận định đúng thay vì chỉ viện dẫn tên tuổi.',
}

export function AssessmentReportPage({ sessionId }: AssessmentReportPageProps) {
  const { navigate } = useNav()
  const [logs, setLogs] = useState<InteractionLog[]>([])
  const [text, setText] = useState<TextItem | null>(null)
  const [assessment, setAssessment] = useState<CriticalAssessment | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const l = await listLogsBySession(sessionId)
      setLogs(l)
      setAssessment(computeAssessment(l))
      const session = await getSession(sessionId)
      if (session) setText(await getText(session.text_id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải được báo cáo.')
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const fallacies = collectFallacies(logs)
  const studentTurns = logs.filter((l) => l.sender === 'Student').length

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-8">
        <Skeleton className="mb-4 h-8 w-48" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-8">
      <div className="mb-4 flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => navigate({ name: 'debate', sessionId })}
        >
          <ArrowLeft /> Quay lại tranh luận
        </Button>
        <Button variant="outline" onClick={() => navigate({ name: 'dashboard' })}>
          <Home /> Trang chủ
        </Button>
      </div>

      <div className="mb-5 flex items-start gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-sm">
          <Gauge className="size-5" />
        </div>
        <div>
          <h1 className="font-heading text-2xl font-bold">
            Báo cáo Chẩn đoán Tư duy Phản biện
          </h1>
          <p className="text-sm text-muted-foreground">
            {text ? `Ngữ liệu: ${text.title} · ` : ''}
            {studentTurns} lượt phản biện của học sinh.
          </p>
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {assessment && (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="grid gap-5 lg:grid-cols-3"
        >
          {/* S_critical — gauge tròn + chỉ số thành phần */}
          <motion.div variants={fadeUpItem} className="lg:col-span-3">
            <Card>
              <CardContent className="grid gap-6 p-6 md:grid-cols-[auto_1fr] md:items-center">
                <ScoreGauge value={assessment.s_critical} />
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-heading text-lg font-semibold">
                      Chỉ số Tư duy Phản biện Mở (S_critical)
                    </h2>
                    <Badge
                      className={ratingLabel(assessment.s_critical).className}
                    >
                      <Trophy className="mr-1 size-3" />
                      {ratingLabel(assessment.s_critical).label}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    S = w₁·D + w₂·E + w₃·C − w₄·F (w₁=w₂=w₃={SCORE_WEIGHTS.w1},
                    w₄={SCORE_WEIGHTS.w4}) · chuẩn hóa thang 100.
                  </p>
                  <div className="grid grid-cols-2 gap-2.5 pt-1 sm:grid-cols-3">
                    <Metric label="Đa dạng góc nhìn (D)" value={assessment.perspective_diversity} />
                    <Metric label="Dẫn chứng (E)" value={assessment.evidence_validity} />
                    <Metric label="Cởi mở (C)" value={assessment.openness} />
                    <Metric label="Logic lập luận" value={assessment.reasoning_logic} />
                    <Metric label="Sáng tạo đọc hiểu" value={assessment.creativity} />
                    <Metric
                      label="Lỗi ngụy biện (F)"
                      value={assessment.fallacy_count}
                      danger
                      suffix=" lỗi"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Radar */}
          <motion.div variants={fadeUpItem} className="lg:col-span-2">
            <Card className="h-full">
              <CardHeader>
                <CardTitle>Biểu đồ Tơ nhện · 5 tiêu chí GDPT 2018</CardTitle>
              </CardHeader>
              <CardContent>
                <RadarChartAssessment assessment={assessment} />
              </CardContent>
            </Card>
          </motion.div>

          {/* Fallacies */}
          <motion.div variants={fadeUpItem}>
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TriangleAlert className="size-5 text-amber-500" /> Lỗi ngụy
                  biện & Lời khuyên
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {fallacies.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 p-6 text-center text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                    <span className="text-3xl">🎉</span>
                    Không phát hiện lỗi ngụy biện. Lập luận chặt chẽ!
                  </div>
                ) : (
                  fallacies.map((f) => (
                    <div key={f.name} className="rounded-xl border p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-rose-700 dark:text-rose-300">
                          {f.name}
                        </span>
                        <Badge variant="destructive">{f.count} lần</Badge>
                      </div>
                      <p className="mt-1 flex items-start gap-1.5 text-muted-foreground">
                        <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
                        {IMPROVEMENT_TIPS[f.name] ??
                          'Rà soát lại mạch lập luận và bổ sung dẫn chứng cụ thể từ văn bản.'}
                      </p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      )}
    </div>
  )
}

/** Vòng tròn tiến trình SVG hiển thị điểm S_critical, có animation. */
function ScoreGauge({ value }: { value: number }) {
  const r = 54
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(100, value))
  return (
    <div className="relative mx-auto size-36">
      <svg viewBox="0 0 128 128" className="size-36 -rotate-90">
        <circle
          cx="64"
          cy="64"
          r={r}
          fill="none"
          stroke="var(--muted)"
          strokeWidth="12"
        />
        <motion.circle
          cx="64"
          cy="64"
          r={r}
          fill="none"
          stroke="url(#scoreGrad)"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - (c * pct) / 100 }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
        />
        <defs>
          <linearGradient id="scoreGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-heading text-3xl font-bold">
          {value.toFixed(1)}
        </span>
        <span className="text-xs text-muted-foreground">/ 100</span>
      </div>
    </div>
  )
}

function Metric({
  label,
  value,
  danger,
  suffix = '/10',
}: {
  label: string
  value: number
  danger?: boolean
  suffix?: string
}) {
  return (
    <div className="rounded-lg border p-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`font-heading text-xl font-semibold ${danger && value > 0 ? 'text-rose-600' : ''}`}
      >
        {value}
        <span className="text-xs font-normal text-muted-foreground">
          {suffix}
        </span>
      </p>
    </div>
  )
}

export default AssessmentReportPage
