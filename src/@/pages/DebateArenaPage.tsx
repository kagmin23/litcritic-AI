import { ArgumentGraph } from '@/components/ArgumentGraph'
import { RoundtableChat } from '@/components/RoundtableChat'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { AGENTS, SCAFFOLDING_TEMPLATES } from '@/lib/agents'
import { useNav } from '@/lib/navigation'
import { generateMultiAgentResponse } from '@/services/geminiService'
import {
  addLog,
  getSession,
  getText,
  listLogsBySession,
  updateSessionStatus,
} from '@/services/supabaseService'
import type {
  Attitude,
  GraphData,
  InteractionLog,
  Keyword,
  TextItem,
} from '@/types'
import { cn } from 'cn'
import {
  ArrowLeft,
  Flag,
  Lightbulb,
  Loader2,
  PlusCircle,
  Send,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

interface DebateArenaPageProps {
  sessionId: string
}

const ATTITUDES: {
  key: Attitude
  label: string
  icon: typeof ThumbsUp
  className: string
  activeClassName: string
}[] = [
  {
    key: 'Agree',
    label: 'Đồng ý',
    icon: ThumbsUp,
    className: 'border-emerald-300 text-emerald-700',
    activeClassName: 'bg-emerald-600 text-white border-emerald-600',
  },
  {
    key: 'Disagree',
    label: 'Phản bác',
    icon: ThumbsDown,
    className: 'border-rose-300 text-rose-700',
    activeClassName: 'bg-rose-600 text-white border-rose-600',
  },
  {
    key: 'Supplement',
    label: 'Bổ sung',
    icon: PlusCircle,
    className: 'border-sky-300 text-sky-700',
    activeClassName: 'bg-sky-600 text-white border-sky-600',
  },
]

/** Chèn <Tooltip> cho các từ khó xuất hiện trong văn bản. */
function AnnotatedText({
  content,
  keywords,
}: {
  content: string
  keywords: Keyword[]
}) {
  const parts = useMemo(() => {
    const valid = keywords.filter((k) => k.term?.trim())
    if (valid.length === 0) return [{ text: content, keyword: null }]

    // Tạo regex an toàn từ các term.
    const escaped = valid
      .map((k) => k.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .sort((a, b) => b.length - a.length)
    const re = new RegExp(`(${escaped.join('|')})`, 'g')

    const segments: { text: string; keyword: Keyword | null }[] = []
    let lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(content)) !== null) {
      if (m.index > lastIndex) {
        segments.push({ text: content.slice(lastIndex, m.index), keyword: null })
      }
      const kw = valid.find((k) => k.term === m![0]) ?? null
      segments.push({ text: m[0], keyword: kw })
      lastIndex = m.index + m[0].length
    }
    if (lastIndex < content.length) {
      segments.push({ text: content.slice(lastIndex), keyword: null })
    }
    return segments
  }, [content, keywords])

  return (
    <TooltipProvider>
      <p className="text-sm leading-relaxed whitespace-pre-wrap">
        {parts.map((p, i) =>
          p.keyword && p.keyword.meaning ? (
            <Tooltip key={i}>
              <TooltipTrigger asChild>
                <span className="cursor-help rounded bg-amber-100 px-0.5 font-medium text-amber-800 underline decoration-dotted dark:bg-amber-950/60 dark:text-amber-300">
                  {p.text}
                </span>
              </TooltipTrigger>
              <TooltipContent>{p.keyword.meaning}</TooltipContent>
            </Tooltip>
          ) : (
            <span key={i}>{p.text}</span>
          )
        )}
      </p>
    </TooltipProvider>
  )
}

export function DebateArenaPage({ sessionId }: DebateArenaPageProps) {
  const { navigate } = useNav()

  const [text, setText] = useState<TextItem | null>(null)
  const [logs, setLogs] = useState<InteractionLog[]>([])
  const [graph, setGraph] = useState<GraphData>({ nodes: [], edges: [] })
  const [loadingInit, setLoadingInit] = useState(true)
  const [thinking, setThinking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [input, setInput] = useState('')
  const [attitude, setAttitude] = useState<Attitude>('Supplement')

  const init = useCallback(async () => {
    setLoadingInit(true)
    setError(null)
    try {
      const session = await getSession(sessionId)
      if (!session) {
        setError('Không tìm thấy phiên tranh luận.')
        return
      }
      const t = await getText(session.text_id)
      setText(t)
      const existing = await listLogsBySession(sessionId)
      setLogs(existing)
      // Khôi phục đồ thị từ log mới nhất có graph_data.
      const lastGraph = [...existing]
        .reverse()
        .find((l) => l.graph_data && l.graph_data.nodes.length > 0)
      if (lastGraph?.graph_data) setGraph(lastGraph.graph_data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lỗi khởi tạo phiên.')
    } finally {
      setLoadingInit(false)
    }
  }, [sessionId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void init()
  }, [init])

  /** Hợp nhất đồ thị cũ với đồ thị mới (dedupe theo id). */
  function mergeGraph(prev: GraphData, next: GraphData): GraphData {
    const nodeMap = new Map(prev.nodes.map((n) => [n.id, n]))
    next.nodes.forEach((n) => nodeMap.set(n.id, n))
    const edgeMap = new Map(prev.edges.map((e) => [e.id, e]))
    next.edges.forEach((e) => edgeMap.set(e.id, e))
    return { nodes: [...nodeMap.values()], edges: [...edgeMap.values()] }
  }

  async function handleSend() {
    const message = input.trim()
    if (!message || !text || thinking) return
    setThinking(true)
    setError(null)

    // 1) Hiển thị lượt học sinh ngay (optimistic, chưa persist để chờ điểm AI).
    const optimistic: InteractionLog = {
      id: `tmp-${Date.now()}`,
      session_id: sessionId,
      sender: 'Student',
      message,
      attitude,
      timestamp: new Date().toISOString(),
    }
    const historyForAI = [...logs, optimistic]
    setLogs((prev) => [...prev, optimistic])
    setInput('')

    try {
      // 2) Gọi Multi-Agent.
      const turn = await generateMultiAgentResponse(
        `${text.title}\n\n${text.content}`,
        historyForAI,
        message,
        attitude
      )

      // 3) Persist lượt học sinh kèm điểm + ngụy biện (ghi 1 lần duy nhất).
      const savedStudent = await addLog({
        session_id: sessionId,
        sender: 'Student',
        message,
        attitude,
        s_critical_score: turn.student_assessment.s_critical_turn,
        fallacies: turn.student_assessment.fallacies,
        graph_data: turn.graph_data,
      })

      // 4) Ghi log từng agent.
      const agentLogs: InteractionLog[] = []
      for (const reply of turn.agent_replies) {
        const saved = await addLog({
          session_id: sessionId,
          sender: reply.sender,
          message: reply.message,
          attitude: reply.attitude,
          graph_data: turn.graph_data,
        })
        agentLogs.push(saved)
      }

      // 5) Thay bản optimistic bằng bản đã lưu + nối phản hồi agent.
      setLogs((prev) =>
        prev
          .map((l) => (l.id === optimistic.id ? savedStudent : l))
          .concat(agentLogs)
      )
      setGraph((prev) => mergeGraph(prev, turn.graph_data))
    } catch (e) {
      // Gỡ bản optimistic nếu thất bại để học sinh thử lại.
      setLogs((prev) => prev.filter((l) => l.id !== optimistic.id))
      setInput(message)
      setError(
        e instanceof Error ? e.message : 'Các nhà phê bình chưa phản hồi được.'
      )
    } finally {
      setThinking(false)
    }
  }

  async function handleFinish() {
    await updateSessionStatus(sessionId, 'completed').catch(() => undefined)
    navigate({ name: 'report', sessionId })
  }

  function applyTemplate(tpl: string) {
    setInput((prev) => (prev ? `${prev} ${tpl}` : tpl))
  }

  if (loadingInit) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-8">
        <Skeleton className="mb-4 h-8 w-40" />
        <div className="grid gap-4 lg:grid-cols-12">
          <Skeleton className="h-96 lg:col-span-4" />
          <Skeleton className="h-96 lg:col-span-5" />
          <Skeleton className="h-96 lg:col-span-3" />
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex h-screen w-full max-w-7xl flex-col px-4 py-4">
      {/* Thanh trên */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <Button variant="ghost" onClick={() => navigate({ name: 'dashboard' })}>
          <ArrowLeft /> Trang chủ
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          {Object.values(AGENTS).map((a) => (
            <Badge key={a.id} className={cn('hidden sm:inline-flex', a.badgeClass)}>
              {a.emoji} {a.shortName}
            </Badge>
          ))}
          <Button onClick={handleFinish}>
            <Flag /> Kết thúc phiên & Xem báo cáo
          </Button>
        </div>
      </div>

      {error && (
        <p className="mb-2 rounded-lg bg-destructive/10 p-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {/* 3 cột */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Cột trái 30% - Văn bản */}
        <Card className="min-h-0 lg:col-span-4">
          <CardHeader>
            <CardTitle className="line-clamp-1">{text?.title}</CardTitle>
            <Badge variant="secondary" className="w-fit">
              {text?.genre}
            </Badge>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 overflow-y-auto">
            {text && (
              <AnnotatedText content={text.content} keywords={text.keywords} />
            )}
            {text?.background && (
              <div className="mt-4 rounded-lg border bg-muted/40 p-3">
                <p className="mb-1 text-xs font-semibold text-muted-foreground uppercase">
                  Bối cảnh
                </p>
                <p className="text-xs leading-relaxed">{text.background}</p>
              </div>
            )}
            {text && text.initial_questions.length > 0 && (
              <div className="mt-3">
                <p className="mb-1 text-xs font-semibold text-muted-foreground uppercase">
                  Câu hỏi định hướng
                </p>
                <ol className="list-inside list-decimal space-y-1 text-xs">
                  {text.initial_questions.map((q, i) => (
                    <li key={i}>{q}</li>
                  ))}
                </ol>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cột giữa 45% - Roundtable chat */}
        <Card className="min-h-0 lg:col-span-5">
          <CardHeader>
            <CardTitle>Đấu trường Tranh luận Bàn tròn</CardTitle>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto">
              <RoundtableChat logs={logs} loading={thinking} />
            </div>

            {/* Scaffolding */}
            <div className="mt-3 flex items-center gap-2">
              <Lightbulb className="size-4 shrink-0 text-amber-500" />
              <Select onValueChange={applyTemplate}>
                <SelectTrigger className="w-full" size="sm">
                  <SelectValue placeholder="Gợi ý mẫu câu phản biện (Scaffolding)…" />
                </SelectTrigger>
                <SelectContent>
                  {SCAFFOLDING_TEMPLATES.map((t, i) => (
                    <SelectItem key={i} value={t.text}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Chọn thái độ */}
            <div className="mt-2 flex gap-2">
              {ATTITUDES.map((a) => {
                const Icon = a.icon
                const active = attitude === a.key
                return (
                  <button
                    key={a.key}
                    type="button"
                    onClick={() => setAttitude(a.key)}
                    className={cn(
                      'flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors',
                      active ? a.activeClassName : a.className,
                      !active && 'bg-background hover:bg-muted'
                    )}
                  >
                    <Icon className="size-3.5" /> {a.label}
                  </button>
                )
              })}
            </div>

            {/* Nhập liệu */}
            <div className="mt-2 flex gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault()
                    void handleSend()
                  }
                }}
                placeholder="Nêu quan điểm phản biện của em… (Ctrl/⌘ + Enter để gửi)"
                className="min-h-16 flex-1"
                disabled={thinking}
              />
              <Button
                className="h-auto"
                onClick={handleSend}
                disabled={thinking || !input.trim()}
              >
                {thinking ? <Loader2 className="animate-spin" /> : <Send />}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Cột phải 25% - Argument graph */}
        <Card className="min-h-0 lg:col-span-3">
          <CardHeader>
            <CardTitle>Sơ đồ Cây Lập luận</CardTitle>
            <div className="flex flex-wrap gap-1 text-[10px]">
              <span className="rounded px-1.5 py-0.5" style={{ background: '#dcfce7', color: '#14532d' }}>
                Đồng thuận
              </span>
              <span className="rounded px-1.5 py-0.5" style={{ background: '#fee2e2', color: '#7f1d1d' }}>
                Bất đồng
              </span>
              <span className="rounded px-1.5 py-0.5" style={{ background: '#e0f2fe', color: '#075985' }}>
                Học sinh
              </span>
            </div>
          </CardHeader>
          <CardContent className="min-h-0 flex-1">
            <ArgumentGraph data={graph} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default DebateArenaPage
