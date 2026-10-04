import { ArgumentGraph } from '@/components/ArgumentGraph'
import { RoundtableChat } from '@/components/RoundtableChat'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { useAuth } from '@/lib/authContext'
import { ACCEPT_UPLOAD, readUploadedFile } from '@/lib/fileUtils'
import { useNav } from '@/lib/navigation'
import { usePresence } from '@/lib/usePresence'
import { useResizablePanels } from '@/lib/useResizablePanels'
import {
  generateMultiAgentResponse,
  ocrImage
} from '@/services/geminiService'
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
  ChevronLeft,
  ChevronRight,
  Flag,
  Lightbulb,
  Loader2,
  Maximize2,
  PanelLeft,
  PanelRight,
  Paperclip,
  PlusCircle,
  Send,
  Swords,
  ThumbsDown,
  ThumbsUp,
  X
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

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
  const { user } = useAuth()

  // Bố cục 3 ô: gập/mở + kéo co giãn.
  const {
    containerRef,
    leftOpen,
    rightOpen,
    widths,
    toggleLeft,
    toggleRight,
    startDragLeft,
    startDragRight,
  } = useResizablePanels('visef_debate_panels')

  // Presence trong phiên: ai đang cùng mở phòng tranh luận này.
  const { count: onlineInSession } = usePresence({
    channelName: `presence:session:${sessionId}`,
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

  const [text, setText] = useState<TextItem | null>(null)
  const [logs, setLogs] = useState<InteractionLog[]>([])
  const [graph, setGraph] = useState<GraphData>({ nodes: [], edges: [] })
  const [loadingInit, setLoadingInit] = useState(true)
  const [thinking, setThinking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [input, setInput] = useState('')
  const [attitude, setAttitude] = useState<Attitude>('Supplement')
  const [graphFull, setGraphFull] = useState(false) // phóng to sơ đồ
  const [attachImage, setAttachImage] = useState<string | null>(null) // ảnh đính kèm
  const composeFileRef = useRef<HTMLInputElement>(null)

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

  async function handleComposeFile(file: File | undefined) {
    if (!file) return
    setError(null)
    try {
      const res = await readUploadedFile(file)
      if (res.kind === 'image') {
        setAttachImage(res.imageBase64 ?? null)
      } else if (res.kind === 'text') {
        setInput((prev) =>
          prev ? `${prev}\n${res.text ?? ''}` : (res.text ?? '')
        )
      } else {
        setError('Chỉ hỗ trợ ảnh (OCR) hoặc tệp .txt.')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không đọc được tệp.')
    }
  }

  async function handleSend() {
    let message = input.trim()
    if ((!message && !attachImage) || !text || thinking) return
    setThinking(true)
    setError(null)

    // Nếu có ảnh đính kèm: OCR thành văn bản rồi ghép vào tin nhắn.
    if (attachImage) {
      try {
        const ocrText = await ocrImage(attachImage)
        message = message ? `${message}\n\n${ocrText}` : ocrText
      } catch {
        // OCR lỗi vẫn cho gửi phần text đã gõ (nếu có).
        if (!message) {
          setThinking(false)
          setError('Không trích xuất được chữ từ ảnh. Vui lòng thử lại.')
          return
        }
      }
      setAttachImage(null)
    }
    if (!message) {
      setThinking(false)
      return
    }

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
      <div className="w-full px-4 py-6 lg:px-6">
        <Skeleton className="mb-4 h-9 w-56" />
        <div className="grid gap-4 lg:grid-cols-12">
          <Skeleton className="h-[70vh] lg:col-span-4" />
          <Skeleton className="h-[70vh] lg:col-span-5" />
          <Skeleton className="h-[70vh] lg:col-span-3" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col px-4 py-4 lg:px-6">
      {/* Thanh trên */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => navigate({ name: 'dashboard' })}
            aria-label="Quay lại"
          >
            <ArrowLeft />
          </Button>
          <div className="flex size-9 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-sm">
            <Swords className="size-4" />
          </div>
          <div className="leading-tight">
            <div className="font-heading text-sm font-semibold">
              Đấu trường tranh luận
            </div>
            <div className="text-[11px] text-muted-foreground line-clamp-1">
              {text?.title}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {Object.values(AGENTS).map((a) => (
            <Badge
              key={a.id}
              className={cn('hidden xl:inline-flex', a.badgeClass)}
            >
              {a.emoji} {a.shortName}
            </Badge>
          ))}
          <Badge
            variant="secondary"
            className="gap-1.5"
            title="Số người đang mở phòng tranh luận này"
          >
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-70" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            {onlineInSession} đang xem
          </Badge>
          <Button onClick={handleFinish}>
            <Flag /> Kết thúc & Xem báo cáo
          </Button>
        </div>
      </div>

      {error && (
        <p className="mb-2 rounded-lg bg-destructive/10 p-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {/* 3 ô — desktop: flex co giãn/gập; mobile: xếp dọc */}
      <div
        ref={containerRef}
        className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row lg:gap-0"
      >
        {/* ===== Ô TRÁI — Văn bản ===== */}
        {leftOpen ? (
          <Card
            className="min-h-0 w-full shrink-0 lg:w-[var(--panel-w)]"
            style={{ ['--panel-w' as string]: `${widths.left}%` }}
          >
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <CardTitle className="line-clamp-1">{text?.title}</CardTitle>
                  <Badge variant="secondary" className="mt-1 w-fit">
                    {text?.genre}
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="hidden shrink-0 lg:inline-flex"
                  onClick={toggleLeft}
                  title="Thu gọn ô văn bản"
                  aria-label="Thu gọn ô văn bản"
                >
                  <PanelLeft className="size-4" />
                </Button>
              </div>
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
        ) : (
          <CollapsedBar side="left" label="Văn bản" onExpand={toggleLeft} />
        )}

        {/* Thanh kéo trái↔giữa */}
        {leftOpen && <ResizeHandle onPointerDown={startDragLeft} />}

        {/* ===== Ô GIỮA — Roundtable chat ===== */}
        <Card className="min-h-0 flex-1">
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

            {/* Ảnh đính kèm (nếu có) */}
            {attachImage && (
              <div className="mt-2 flex items-center gap-2 rounded-lg border bg-muted/40 p-2">
                <img
                  src={attachImage}
                  alt="Ảnh đính kèm"
                  className="size-12 rounded object-cover"
                />
                <span className="flex-1 text-xs text-muted-foreground">
                  Ảnh sẽ được OCR và ghép vào tin nhắn khi gửi.
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setAttachImage(null)}
                  aria-label="Gỡ ảnh"
                >
                  <X className="size-4" />
                </Button>
              </div>
            )}

            {/* Nhập liệu */}
            <input
              ref={composeFileRef}
              type="file"
              accept={ACCEPT_UPLOAD}
              className="hidden"
              onChange={(e) => void handleComposeFile(e.target.files?.[0])}
            />
            <div className="mt-2 flex items-end gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-16 shrink-0"
                onClick={() => composeFileRef.current?.click()}
                disabled={thinking}
                title="Đính kèm ảnh (OCR) hoặc tệp .txt"
                aria-label="Đính kèm tệp"
              >
                <Paperclip />
              </Button>
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
                className="h-16 shrink-0"
                onClick={handleSend}
                disabled={thinking || (!input.trim() && !attachImage)}
              >
                {thinking ? <Loader2 className="animate-spin" /> : <Send />}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Thanh kéo giữa↔phải */}
        {rightOpen && <ResizeHandle onPointerDown={startDragRight} />}

        {/* ===== Ô PHẢI — Sơ đồ lập luận ===== */}
        {rightOpen ? (
          <Card
            className="min-h-0 w-full shrink-0 lg:w-[var(--panel-w)]"
            style={{ ['--panel-w' as string]: `${widths.right}%` }}
          >
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <CardTitle>Sơ đồ Cây Lập luận</CardTitle>
                  <div className="mt-1 flex flex-wrap gap-1 text-[10px]">
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
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setGraphFull(true)}
                    title="Phóng to sơ đồ"
                    aria-label="Phóng to sơ đồ"
                  >
                    <Maximize2 className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="hidden lg:inline-flex"
                    onClick={toggleRight}
                    title="Thu gọn sơ đồ"
                    aria-label="Thu gọn sơ đồ"
                  >
                    <PanelRight className="size-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="min-h-0 flex-1">
              <ArgumentGraph data={graph} />
            </CardContent>
          </Card>
        ) : (
          <CollapsedBar side="right" label="Sơ đồ" onExpand={toggleRight} />
        )}
      </div>

      {/* Phóng to Sơ đồ cây lập luận ra toàn màn hình */}
      <Dialog open={graphFull} onOpenChange={setGraphFull}>
        <DialogContent className="h-[90vh] w-[95vw] max-w-[95vw] p-0 sm:max-w-[95vw]">
          <DialogHeader className="border-b p-4">
            <DialogTitle className="flex flex-wrap items-center gap-2">
              Sơ đồ Cây Lập luận
              <span className="rounded px-1.5 py-0.5 text-[10px]" style={{ background: '#dcfce7', color: '#14532d' }}>
                Đồng thuận
              </span>
              <span className="rounded px-1.5 py-0.5 text-[10px]" style={{ background: '#fee2e2', color: '#7f1d1d' }}>
                Bất đồng
              </span>
              <span className="rounded px-1.5 py-0.5 text-[10px]" style={{ background: '#e0f2fe', color: '#075985' }}>
                Học sinh
              </span>
            </DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 p-3">
            <ArgumentGraph data={graph} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** Thanh kéo co giãn giữa 2 ô (chỉ hiện trên desktop). */
function ResizeHandle({
  onPointerDown,
}: {
  onPointerDown: (e: React.PointerEvent) => void
}) {
  return (
    <div
      onPointerDown={onPointerDown}
      className="group hidden w-2 shrink-0 cursor-col-resize items-center justify-center lg:flex"
      role="separator"
      aria-orientation="vertical"
    >
      <div className="h-16 w-1 rounded-full bg-border transition-colors group-hover:bg-primary/60" />
    </div>
  )
}

/** Thanh dọc mảnh khi một ô bị gập — bấm để mở lại. */
function CollapsedBar({
  side,
  label,
  onExpand,
}: {
  side: 'left' | 'right'
  label: string
  onExpand: () => void
}) {
  const Icon = side === 'left' ? ChevronRight : ChevronLeft
  return (
    <button
      onClick={onExpand}
      title={`Mở lại ô ${label}`}
      className="hidden w-9 shrink-0 flex-col items-center gap-2 rounded-xl bg-card py-3 ring-1 ring-foreground/10 transition-colors hover:bg-muted lg:flex"
    >
      <Icon className="size-4 text-muted-foreground" />
      <span
        className="text-xs font-medium text-muted-foreground"
        style={{ writingMode: 'vertical-rl' }}
      >
        {label}
      </span>
    </button>
  )
}

export default DebateArenaPage
