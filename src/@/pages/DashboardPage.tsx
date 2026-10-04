import { PendingBanner } from '@/components/PendingBanner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { AGENTS } from '@/lib/agents'
import { useAuth } from '@/lib/authContext'
import { fadeUpItem, staggerContainer } from '@/lib/motion'
import { useNav } from '@/lib/navigation'
import { isSupabaseConfigured } from '@/lib/supabaseClient'
import { isGeminiConfigured } from '@/services/geminiService'
import {
    getOrCreateSession,
    listTexts,
    upsertStudent
} from '@/services/supabaseService'
import type { TextItem } from '@/types'
import { motion } from 'framer-motion'
import {
    AlertCircle,
    BookOpenText,
    FileText,
    Library,
    Loader2,
    Plus,
    Search,
    Sparkles,
    Swords,
    TrendingUp,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

const GENRE_EMOJI: Record<string, string> = {
  Thơ: '🪶',
  'Truyện ngắn': '📖',
  'Tản văn': '🍃',
  'Văn bản nghị luận': '⚖️',
  Kịch: '🎭',
  Khác: '📄',
}

export function DashboardPage() {
  const { navigate } = useNav()
  const { user, isActive, role } = useAuth()
  const locked = !isActive // teacher pending/rejected → khóa tính năng
  const isStudent = role === 'student'
  // Hero đổi tông theo role để 2 không gian khác biệt.
  const heroClass = isStudent
    ? 'bg-gradient-to-br from-sky-500 via-cyan-500 to-teal-500'
    : 'bg-brand-gradient'
  const [texts, setTexts] = useState<TextItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [startingId, setStartingId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setTexts(await listTexts())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải được danh sách bài học.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh()
  }, [refresh])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return texts
    return texts.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.genre.toLowerCase().includes(q)
    )
  }, [texts, query])

  const genreCount = useMemo(
    () => new Set(texts.map((t) => t.genre)).size,
    [texts]
  )

  async function handleStart(text: TextItem) {
    if (!user || locked) return
    setStartingId(text.id)
    setError(null)
    try {
      const student = await upsertStudent(
        user.profile.full_name || user.email,
        user.profile.class_name || '—'
      )
      // Tiếp tục phiên đang diễn ra (nếu có) để giữ lịch sử chat; nếu không thì tạo mới.
      const session = await getOrCreateSession(student.id, text.id)
      navigate({ name: 'debate', sessionId: session.id })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không khởi tạo được phiên tranh luận.')
      setStartingId(null)
    }
  }

  const firstName =
    user?.profile.full_name?.split(' ').slice(-1)[0] || 'bạn'

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-5 lg:px-8">
      <PendingBanner />

      {/* Banner chào mừng — gọn, thống kê nằm ngang cùng hàng để bớt chiều cao */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className={`relative mb-5 overflow-hidden rounded-2xl p-5 text-white shadow-lg ${heroClass}`}
      >
        <div className="bg-dot-grid pointer-events-none absolute inset-0 text-white/10" />
        <div className="animate-float-slow pointer-events-none absolute -top-10 -right-6 size-40 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2 text-xs font-medium text-white/80">
              <Sparkles className="size-4" />{' '}
              {isStudent ? 'Không gian học sinh' : 'Không gian giáo viên'}
            </div>
            <h1 className="font-heading text-2xl font-bold">
              Xin chào, {firstName} 👋
            </h1>
            <p className="mt-1 max-w-xl text-sm text-white/85">
              {isStudent
                ? 'Chọn một ngữ liệu để bước vào đấu trường tranh luận cùng 4 nhà phê bình AI.'
                : 'Tạo ngữ liệu, tổ chức tranh luận và theo dõi tư duy phản biện của học sinh.'}
            </p>
          </div>

          {/* Thống kê + CTA nằm ngang bên phải, lấp khoảng trống chiều ngang */}
          <div className="flex shrink-0 items-stretch gap-2.5">
            <HeroStat icon={Library} value={texts.length} label="Ngữ liệu" />
            <HeroStat icon={FileText} value={genreCount} label="Thể loại" />
            <HeroStat icon={TrendingUp} value={4} label="Agents" />
            <button
              onClick={() => navigate({ name: 'textInput' })}
              disabled={locked}
              title={locked ? 'Chờ phê duyệt để mở khóa' : undefined}
              className="flex min-w-[7rem] flex-col items-center justify-center gap-1 rounded-xl bg-white/90 px-3 text-foreground shadow-md transition-colors hover:bg-white disabled:opacity-50"
            >
              <Plus className="size-4" />
              <span className="text-xs font-semibold leading-tight">
                Tạo ngữ liệu
              </span>
            </button>
          </div>
        </div>
      </motion.div>

      {/* Cảnh báo cấu hình (chỉ khi thiếu) */}
      {(!isSupabaseConfigured || !isGeminiConfigured) && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertCircle className="mt-0.5 size-5 shrink-0" />
          <div className="space-y-0.5">
            <p className="font-medium">Lưu ý cấu hình môi trường (.env)</p>
            {!isGeminiConfigured && (
              <p className="text-amber-700 dark:text-amber-300">
                Thiếu <code>VITE_GEMINI_API_KEY</code> — tính năng AI chưa hoạt động.
              </p>
            )}
            {!isSupabaseConfigured && (
              <p className="text-amber-700 dark:text-amber-300">
                Thiếu khóa Supabase — đang chạy chế độ demo (lưu tạm trình duyệt).
              </p>
            )}
          </div>
        </div>
      )}

      {/* Thanh tiêu đề + tìm kiếm */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-heading flex items-center gap-2 text-lg font-semibold">
          <BookOpenText className="size-5 text-primary" /> Thư viện ngữ liệu
          <Badge variant="secondary" className="ml-1">
            {filtered.length}
          </Badge>
        </h2>
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm theo tên hoặc thể loại…"
            className="h-9 pl-9"
          />
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {loading ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="space-y-3 py-4">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-9 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          hasTexts={texts.length > 0}
          onCreate={() => navigate({ name: 'textInput' })}
        />
      ) : (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4"
        >
          {filtered.map((t) => (
            <motion.div key={t.id} variants={fadeUpItem}>
              <TextCard
                text={t}
                starting={startingId === t.id}
                locked={locked}
                onStart={() => handleStart(t)}
              />
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  )
}

function HeroStat({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof Library
  value: number
  label: string
}) {
  return (
    <div className="flex min-w-[4.5rem] flex-col items-center justify-center rounded-xl bg-white/10 px-3 py-2 ring-1 ring-white/20 backdrop-blur">
      <Icon className="mb-0.5 size-4 text-white/80" />
      <div className="font-heading text-lg font-bold leading-none">{value}</div>
      <div className="text-[10px] text-white/75">{label}</div>
    </div>
  )
}

function TextCard({
  text,
  starting,
  locked,
  onStart,
}: {
  text: TextItem
  starting: boolean
  locked: boolean
  onStart: () => void
}) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
      className="group flex h-full flex-col overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 transition-shadow hover:ring-brand hover:shadow-lg"
    >
      {/* Dải màu theo thể loại */}
      <div className="relative h-20 overflow-hidden bg-brand-gradient">
        <div className="bg-dot-grid absolute inset-0 text-white/15" />
        <span className="absolute right-3 bottom-2 text-4xl opacity-90 drop-shadow transition-transform duration-300 group-hover:scale-110">
          {GENRE_EMOJI[text.genre] ?? '📄'}
        </span>
        <Badge className="absolute top-3 left-3 bg-white/90 text-foreground backdrop-blur">
          {text.genre}
        </Badge>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="font-heading line-clamp-2 text-base font-semibold leading-snug">
          {text.title}
        </h3>
        <p className="line-clamp-3 flex-1 text-sm text-muted-foreground">
          {text.content}
        </p>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {(text.keywords?.length ?? 0) > 0 && (
            <Badge variant="outline" className="text-[11px]">
              {text.keywords.length} từ khó
            </Badge>
          )}
          {text.initial_questions?.length > 0 && (
            <Badge variant="outline" className="text-[11px]">
              {text.initial_questions.length} câu hỏi
            </Badge>
          )}
        </div>
        <Button
          className="mt-2 w-full"
          onClick={onStart}
          disabled={starting || locked}
          title={locked ? 'Chờ phê duyệt để mở khóa' : undefined}
        >
          {starting ? <Loader2 className="animate-spin" /> : <Swords />}
          {starting ? 'Đang mở…' : locked ? 'Đang chờ duyệt' : 'Vào tranh luận'}
        </Button>
      </div>
    </motion.div>
  )
}

function EmptyState({
  hasTexts,
  onCreate,
}: {
  hasTexts: boolean
  onCreate: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative overflow-hidden rounded-2xl border border-dashed bg-card/60 p-12 text-center"
    >
      <div className="bg-dot-grid pointer-events-none absolute inset-0 text-foreground/[0.03]" />
      <div className="relative mx-auto flex max-w-sm flex-col items-center gap-3">
        <div className="flex -space-x-2">
          {Object.values(AGENTS)
            .filter((a) => a.id !== 'Moderator')
            .map((a) => (
              <div
                key={a.id}
                className="flex size-10 items-center justify-center rounded-full text-lg ring-2 ring-background"
                style={{ background: `${a.accent}22` }}
              >
                {a.emoji}
              </div>
            ))}
        </div>
        <p className="text-sm text-muted-foreground">
          {hasTexts
            ? 'Không tìm thấy ngữ liệu phù hợp. Thử từ khóa khác.'
            : 'Chưa có ngữ liệu nào. Hãy tạo bài đọc đầu tiên để các nhà phê bình bắt đầu tranh luận.'}
        </p>
        {!hasTexts && (
          <Button onClick={onCreate}>
            <Plus /> Tạo ngữ liệu mới
          </Button>
        )}
      </div>
    </motion.div>
  )
}

export default DashboardPage
