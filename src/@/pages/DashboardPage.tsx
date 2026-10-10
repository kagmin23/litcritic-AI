import { PendingBanner } from '@/components/PendingBanner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { AGENTS } from '@/lib/agents'
import { useAuth } from '@/lib/authContext'
import { useNav } from '@/lib/navigation'
import { isSupabaseConfigured } from '@/lib/supabaseClient'
import { isGeminiConfigured } from '@/services/geminiService'
import { isGroqConfigured } from '@/services/groqService'
import {
  deleteText,
  getOrCreateSession,
  listTexts,
  upsertStudent,
} from '@/services/supabaseService'
import type { TextItem } from '@/types'
import { motion } from 'framer-motion'
import {
  AlertCircle,
  ArrowRight,
  BookOpenText,
  Check,
  ChevronRight,
  Eye,
  FileText,
  LayoutGrid,
  Library,
  List,
  ListFilter,
  Loader2,
  Plus,
  Search,
  Sparkles,
  Swords,
  Trash2,
  TrendingUp,
  UserRound,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

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
  const [libraryTab, setLibraryTab] = useState<'all' | 'mine'>('all')
  const [layout, setLayout] = useState<'cards' | 'list'>('cards')
  const [selectedTopicFilters, setSelectedTopicFilters] = useState<Set<string>>(
    () => new Set()
  )
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null)
  const [modalQuery, setModalQuery] = useState('')
  const [detailTarget, setDetailTarget] = useState<TextItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<TextItem | null>(null)
  const [deleting, setDeleting] = useState(false)

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

  const currentTexts = useMemo(
    () =>
      libraryTab === 'mine'
        ? texts.filter((text) => text.owner_id === user?.id)
        : texts,
    [texts, libraryTab, user?.id]
  )

  const topicGroups = useMemo(() => {
    const counts = new Map<string, number>()
    currentTexts.forEach((text) =>
      counts.set(text.genre, (counts.get(text.genre) ?? 0) + 1)
    )
    const groups = new Map<string, TextItem[]>()
    currentTexts.forEach((text) => {
      const topic = text.genre === 'Khác' || (counts.get(text.genre) ?? 0) < 2
        ? 'Khác'
        : text.genre
      groups.set(topic, [...(groups.get(topic) ?? []), text])
    })
    return Array.from(groups, ([title, items]) => ({ title, items })).sort(
      (a, b) => (a.title === 'Khác' ? 1 : 0) - (b.title === 'Khác' ? 1 : 0)
    )
  }, [currentTexts])

  const visibleGroups = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('vi')
    return topicGroups
      .map((group) => ({
        ...group,
        visibleItems: q
          ? group.items.filter((text) =>
              text.title.toLocaleLowerCase('vi').includes(q)
            )
          : group.items,
      }))
      .filter(
        (group) =>
          selectedTopicFilters.size === 0 || selectedTopicFilters.has(group.title)
      )
      .filter((group) => group.visibleItems.length > 0)
  }, [topicGroups, query, selectedTopicFilters])

  function toggleTopicFilter(topic: string) {
    setSelectedTopicFilters((selected) => {
      const next = new Set(selected)
      if (next.has(topic)) next.delete(topic)
      else next.add(topic)
      return next
    })
  }

  const filteredCount = visibleGroups.reduce(
    (total, group) => total + group.visibleItems.length,
    0
  )
  const selectedGroup = topicGroups.find((group) => group.title === selectedTopic)
  const modalItems = useMemo(() => {
    const q = modalQuery.trim().toLocaleLowerCase('vi')
    return (selectedGroup?.items ?? []).filter((text) =>
      !q || text.title.toLocaleLowerCase('vi').includes(q)
    )
  }, [selectedGroup, modalQuery])

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

  async function handleDelete() {
    if (!deleteTarget || !user || deleteTarget.owner_id !== user.id) return
    setDeleting(true)
    setError(null)
    try {
      await deleteText(deleteTarget.id, user.id)
      setTexts((items) => items.filter((item) => item.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không xóa được ngữ liệu.')
    } finally {
      setDeleting(false)
    }
  }

  const firstName =
    user?.profile.full_name?.split(' ').slice(-1)[0] || 'bạn'

  return (
    <div className="mx-auto w-full px-4 py-5 lg:px-7">
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
              className="flex min-w-28 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl bg-white/90 px-3 text-foreground shadow-md transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
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
      {(!isSupabaseConfigured || !isGroqConfigured || !isGeminiConfigured) && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertCircle className="mt-0.5 size-5 shrink-0" />
          <div className="space-y-0.5">
            <p className="font-medium">Lưu ý cấu hình môi trường (.env)</p>
            {!isGroqConfigured && (
              <p className="text-amber-700 dark:text-amber-300">
                Thiếu <code>VITE_GROQ_API_KEY</code> — tính năng AI (phân tích & tranh luận) chưa hoạt động.
              </p>
            )}
            {!isGeminiConfigured && (
              <p className="text-amber-700 dark:text-amber-300">
                Thiếu <code>VITE_GEMINI_API_KEY</code> — tính năng OCR ảnh chưa hoạt động.
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

      <div className="sticky top-0 z-20 -mx-4 mb-5 flex flex-col gap-4 border-b bg-background/95 px-4 py-3 shadow-sm backdrop-blur supports-backdrop-filter:bg-background/85 lg:-mx-7 lg:px-7">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-4">
            <h2 className="font-heading flex items-center gap-2 text-lg font-semibold">
              <BookOpenText className="size-5 text-primary" /> Thư viện ngữ liệu
              <Badge variant="secondary">{filteredCount}</Badge>
            </h2>
            <Tabs value={libraryTab} onValueChange={(value) => setLibraryTab(value as 'all' | 'mine')}>
              <TabsList>
                <TabsTrigger value="all">Tất cả</TabsTrigger>
                <TabsTrigger value="mine">Của bạn</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative min-w-0 flex-1 sm:w-[24rem] sm:flex-none lg:w-120">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm tên bài học..."
                className="h-9 pl-9 pr-9"
              />
              {query && (
                <Button variant="ghost" size="icon-sm" aria-label="Xóa tìm kiếm" className="absolute top-1/2 right-1 -translate-y-1/2" onClick={() => setQuery('')}>
                  <X />
                </Button>
              )}
            </div>
            <div className="flex shrink-0 rounded-lg border bg-background p-0.5">
              <Button variant={layout === 'cards' ? 'secondary' : 'ghost'} size="icon-sm" aria-label="Hiển thị dạng thẻ" title="Dạng thẻ" onClick={() => setLayout('cards')}>
                <LayoutGrid />
              </Button>
              <Button variant={layout === 'list' ? 'secondary' : 'ghost'} size="icon-sm" aria-label="Hiển thị dạng danh sách" title="Dạng danh sách" onClick={() => setLayout('list')}>
                <List />
              </Button>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="flex shrink-0 items-center gap-1.5 text-xs">
            <ListFilter className="size-3.5 text-primary" />
            <span className="font-semibold">Lọc theo chủ đề</span>
            <span className="text-muted-foreground">· chọn một hoặc nhiều</span>
          </div>
          <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto pb-0.5">
          <Button
            variant={selectedTopicFilters.size === 0 ? 'secondary' : 'outline'}
            size="sm"
            aria-pressed={selectedTopicFilters.size === 0}
            onClick={() => setSelectedTopicFilters(new Set())}
            className="h-7 shrink-0"
          >
            {selectedTopicFilters.size === 0 && <Check />}
            Tất cả
          </Button>
          {topicGroups.map((group) => {
            const active = selectedTopicFilters.has(group.title)
            return (
              <Button
                key={group.title}
                variant={active ? 'secondary' : 'outline'}
                size="sm"
                aria-pressed={active}
                onClick={() => toggleTopicFilter(group.title)}
                className="h-7 shrink-0"
              >
                {active && <Check />}
                {GENRE_EMOJI[group.title] ?? '📄'} {group.title}
              </Button>
            )
          })}
          </div>
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
      ) : filteredCount === 0 ? (
        <EmptyState
          hasTexts={currentTexts.length > 0}
          isMine={libraryTab === 'mine'}
          onCreate={() => navigate({ name: 'textInput' })}
        />
      ) : (
        <div className="space-y-7">
          {visibleGroups.map((group) => {
            const isOwnedTab = libraryTab === 'mine'
            const previewLimit = isOwnedTab ? 5 : 7
            const rowItems = group.visibleItems.slice(0, previewLimit)
            const showViewAll = !isOwnedTab || group.visibleItems.length > previewLimit
            return (
              <section key={group.title}>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="font-heading flex items-center gap-2 text-base font-semibold">
                    <span>{GENRE_EMOJI[group.title] ?? '📄'}</span>
                    {group.title}
                    <Badge variant="secondary">{group.visibleItems.length}</Badge>
                  </h3>
                </div>
                <TopicShelf
                  layout={layout}
                  showViewAll={showViewAll}
                  onViewAll={() => { setSelectedTopic(group.title); setModalQuery(query) }}
                >
                  {rowItems.map((text) => (
                    <TextCard
                      key={text.id}
                      text={text}
                      layout={layout}
                      starting={startingId === text.id}
                      locked={locked}
                      canDelete={text.owner_id === user?.id}
                      isOwned={text.owner_id === user?.id}
                      horizontal={layout === 'cards'}
                      onStart={() => void handleStart(text)}
                      onViewDetail={() => setDetailTarget(text)}
                      onDelete={() => setDeleteTarget(text)}
                    />
                  ))}
                </TopicShelf>
              </section>
            )
          })}
        </div>
      )}

      <footer className="mt-12 border-t border-border/70 py-5">
        <div className="flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <BookOpenText className="size-4 text-primary" />
            <span className="font-heading font-semibold text-foreground">Multi LitCritic AI</span>
            <span aria-hidden="true">·</span>
            <span>Rèn luyện tư duy phản biện qua văn học</span>
          </div>
          <span>© {new Date().getFullYear()} TƯ DUY PHẢN BIỆN & TIẾP NHẬN VĂN HỌC ĐA CHIỀU</span>
        </div>
      </footer>

      <Dialog open={!!selectedTopic} onOpenChange={(open) => !open && setSelectedTopic(null)}>
        <DialogContent
          className="grid grid-rows-[auto_1fr] gap-0 overflow-hidden p-0"
          style={{
            width: '100vw',
            maxWidth: '100vw',
            height: '100dvh',
            maxHeight: '100dvh',
            borderRadius: 0,
          }}
        >
          <DialogHeader className="border-b px-6 py-4 pr-14 md:px-8">
            <DialogTitle className="text-lg">{selectedTopic} <span className="font-normal text-muted-foreground">({modalItems.length})</span></DialogTitle>
            <DialogDescription className="sr-only">Toàn bộ ngữ liệu thuộc chủ đề {selectedTopic}.</DialogDescription>
            <div className="relative mt-2 max-w-4xl">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={modalQuery} onChange={(e) => setModalQuery(e.target.value)} placeholder="Tìm tên bài học..." className="h-10 pl-9 pr-9" />
              {modalQuery && <Button variant="ghost" size="icon-sm" aria-label="Xóa tìm kiếm" className="absolute top-1/2 right-1 -translate-y-1/2" onClick={() => setModalQuery('')}><X /></Button>}
            </div>
          </DialogHeader>
          <div className={layout === 'cards' ? 'grid auto-rows-max grid-cols-1 gap-4 overflow-y-auto p-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 md:p-8' : 'flex flex-col gap-2 overflow-y-auto p-6 md:p-8'}>
            {modalItems.map((text) => (
              <TextCard
                key={text.id}
                text={text}
                layout={layout}
                starting={startingId === text.id}
                locked={locked}
                canDelete={text.owner_id === user?.id}
                isOwned={text.owner_id === user?.id}
                onStart={() => void handleStart(text)}
                onViewDetail={() => setDetailTarget(text)}
                onDelete={() => setDeleteTarget(text)}
                horizontal={false}
              />
            ))}
            {modalItems.length === 0 && <p className="col-span-full py-10 text-center text-sm text-muted-foreground">Không tìm thấy ngữ liệu phù hợp.</p>}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailTarget} onOpenChange={(open) => !open && setDetailTarget(null)}>
        <DialogContent
          className="grid max-h-[90dvh] grid-rows-[auto_1fr] gap-0 overflow-hidden p-0"
          style={{ width: 'min(92vw, 900px)', maxWidth: '92vw', maxHeight: '90dvh' }}
        >
          <DialogHeader className="border-b px-6 py-5 pr-14">
            <DialogTitle className="text-xl leading-snug">{detailTarget?.title}</DialogTitle>
            <DialogDescription className="flex items-center gap-2">
              <Badge variant="secondary">{detailTarget?.genre}</Badge>
              {detailTarget?.owner_id === user?.id && (
                <Badge className="gap-1 border-transparent bg-linear-to-br from-sky-500 via-cyan-500 to-teal-500 text-white">
                  <UserRound className="size-3" /> Bài của bạn
                </Badge>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 overflow-y-auto px-6 py-5">
            <DetailSection title="Nội dung">
              <p className="whitespace-pre-wrap text-sm leading-7 text-foreground/90">{detailTarget?.content}</p>
            </DetailSection>
            {detailTarget?.background && (
              <DetailSection title="Bối cảnh">
                <p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{detailTarget.background}</p>
              </DetailSection>
            )}
            {!!detailTarget?.keywords.length && (
              <DetailSection title="Từ khóa">
                <ul className="space-y-2">
                  {detailTarget.keywords.map((keyword) => (
                    <li key={keyword.term} className="text-sm leading-6">
                      <span className="font-medium">{keyword.term}</span>
                      {keyword.meaning && <span className="text-muted-foreground">: {keyword.meaning}</span>}
                    </li>
                  ))}
                </ul>
              </DetailSection>
            )}
            {!!detailTarget?.initial_questions.length && (
              <DetailSection title="Câu hỏi khởi đầu">
                <ol className="list-decimal space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
                  {detailTarget.initial_questions.map((question, index) => (
                    <li key={`${index}-${question}`}>{question}</li>
                  ))}
                </ol>
              </DetailSection>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && !deleting && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xóa ngữ liệu?</DialogTitle>
            <DialogDescription>Bài “{deleteTarget?.title}” sẽ bị xóa cùng dữ liệu tranh luận liên quan. Thao tác này không thể hoàn tác.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" disabled={deleting} onClick={() => setDeleteTarget(null)}>Hủy</Button>
            <Button variant="destructive" disabled={deleting} onClick={() => void handleDelete()}>
              {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
              Xóa bài
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function TopicShelf({
  children,
  layout,
  showViewAll,
  onViewAll,
}: {
  children: ReactNode
  layout: 'cards' | 'list'
  showViewAll: boolean
  onViewAll: () => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollRight, setCanScrollRight] = useState(false)

  useEffect(() => {
    const element = scrollRef.current
    if (!element) return

    const updateScrollState = () => {
      const maxScroll = element.scrollWidth - element.clientWidth
      setCanScrollRight(maxScroll > 2 && element.scrollLeft < maxScroll - 2)
    }
    const observer = new ResizeObserver(updateScrollState)
    observer.observe(element)
    element.addEventListener('scroll', updateScrollState, { passive: true })
    updateScrollState()

    return () => {
      observer.disconnect()
      element.removeEventListener('scroll', updateScrollState)
    }
  }, [children])

  function scrollForward() {
    const element = scrollRef.current
    if (!element) return
    element.scrollBy({ left: element.clientWidth * 0.8, behavior: 'smooth' })
  }

  const viewAllButton = !showViewAll ? null : layout === 'cards' ? (
    <button
      type="button"
      onClick={onViewAll}
      className="group relative flex h-80 shrink-0 snap-start cursor-pointer flex-col justify-between overflow-hidden rounded-r-xl p-5 text-left text-foreground transition-colors hover:text-primary"
      style={{
        flex: '0 0 calc((100% - 48px) / 5)',
        minWidth: 'min(100%, 200px)',
      }}
    >
      <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(110deg,transparent_8%,rgba(6,182,212,0.08)_38%,rgba(79,70,229,0.16)_72%,rgba(192,38,211,0.24)_100%)] opacity-70 transition-opacity group-hover:opacity-100" />
      <span className="relative mt-auto flex items-center gap-2 border-b border-current/25 pb-2 font-heading text-lg font-normal">
        Xem tất cả
        <ArrowRight className="transition-transform group-hover:translate-x-1" />
      </span>
    </button>
  ) : (
    <button
      type="button"
      onClick={onViewAll}
      className="group relative flex h-14 w-full cursor-pointer items-center justify-between overflow-hidden px-4 text-left text-foreground hover:text-primary"
    >
      <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(6,182,212,0.08),rgba(79,70,229,0.14),rgba(192,38,211,0.2))] opacity-70 transition-opacity group-hover:opacity-100" />
      <span className="relative font-medium">Xem tất cả chủ đề</span>
      <ArrowRight className="relative transition-transform group-hover:translate-x-1" />
    </button>
  )

  if (layout === 'list') {
    return (
      <div className="flex flex-col gap-2">
        {children}
        {viewAllButton && <div className="flex justify-end">{viewAllButton}</div>}
      </div>
    )
  }

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        className="flex snap-x gap-3 overflow-x-auto px-1 pt-2 pb-3 scrollbar-thin"
      >
        {children}
        {viewAllButton}
      </div>
      {canScrollRight && (
        <div className="pointer-events-none absolute top-2 right-0 bottom-3 z-10 flex w-20 items-center justify-end overflow-hidden rounded-xl bg-[linear-gradient(90deg,transparent,rgba(30,41,59,0.16)_45%,rgba(30,41,59,0.6))] pr-2">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Cuộn sang phải"
            title="Cuộn sang phải"
            className="pointer-events-auto rounded-full border border-white/35 bg-slate-900/75 text-white shadow-lg backdrop-blur hover:bg-slate-800"
            onClick={scrollForward}
          >
            <ChevronRight />
          </Button>
        </div>
      )}
    </div>
  )
}

function DetailSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="space-y-2 border-b pb-5 last:border-b-0 last:pb-0">
      <h3 className="font-heading text-sm font-semibold">{title}</h3>
      {children}
    </section>
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
    <div className="flex min-w-18 flex-col items-center justify-center rounded-xl bg-white/10 px-3 py-2 ring-1 ring-white/20 backdrop-blur">
      <Icon className="mb-0.5 size-4 text-white/80" />
      <div className="font-heading text-lg font-bold leading-none">{value}</div>
      <div className="text-[10px] text-white/75">{label}</div>
    </div>
  )
}

function TextCard({
  text,
  layout,
  starting,
  locked,
  canDelete,
  isOwned,
  horizontal = true,
  onStart,
  onViewDetail,
  onDelete,
}: {
  text: TextItem
  layout: 'cards' | 'list'
  starting: boolean
  locked: boolean
  canDelete: boolean
  isOwned: boolean
  horizontal?: boolean
  onStart: () => void
  onViewDetail: () => void
  onDelete: () => void
}) {
  const actionButtons = (
    <div className="flex shrink-0 gap-2">
      <TooltipProvider delayDuration={500}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              aria-label={`Xem chi tiết ${text.title}`}
              onClick={onViewDetail}
            >
              <Eye />
            </Button>
          </TooltipTrigger>
          <TooltipContent className="border border-slate-300 bg-slate-100 text-slate-900 shadow-xl shadow-slate-900/15 [&>svg]:bg-slate-100! [&>svg]:fill-slate-100!">
            Xem chi tiết
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <Button
        className={layout === 'cards' ? 'flex-1' : ''}
        onClick={onStart}
        disabled={starting || locked}
        title={locked ? 'Chờ phê duyệt để mở khóa' : undefined}
      >
        {starting ? <Loader2 className="animate-spin" /> : <Swords />}
        {starting ? 'Đang mở…' : locked ? 'Đang chờ duyệt' : 'Vào tranh luận'}
      </Button>
      {canDelete && (
        <Button variant="destructive" size="icon" aria-label={`Xóa ${text.title}`} title="Xóa bài của bạn" onClick={onDelete}>
          <Trash2 />
        </Button>
      )}
    </div>
  )

  if (layout === 'list') {
    return (
      <div
        className={`flex ${horizontal ? 'shrink-0 snap-start' : 'w-full'} items-center gap-3 rounded-lg border bg-card p-3`}
        style={horizontal ? { flex: '0 0 calc((100% - 48px) / 5)', minWidth: 'min(100%, 300px)' } : undefined}
      >
        <div className="flex size-12 shrink-0 items-center justify-center rounded-md bg-brand-gradient text-2xl" aria-hidden="true">
          {GENRE_EMOJI[text.genre] ?? '📄'}
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <Badge variant="secondary" className="max-w-28 truncate">{text.genre}</Badge>
            {isOwned && (
              <Badge className="gap-1 border-transparent bg-linear-to-br from-sky-500 via-cyan-500 to-teal-500 text-white">
                <UserRound className="size-3" /> Của bạn
              </Badge>
            )}
          </div>
          <h3 className="truncate font-heading text-sm font-semibold">{text.title}</h3>
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{text.content}</p>
        </div>
        {actionButtons}
      </div>
    )
  }

  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
      className={`group flex h-80 ${horizontal ? 'snap-start' : 'w-full'} flex-col overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 transition-shadow hover:ring-brand hover:shadow-lg`}
      style={horizontal ? { flex: '0 0 calc((100% - 48px) / 5)', minWidth: 'min(100%, 200px)' } : undefined}
    >
      {/* Dải màu theo thể loại */}
      <div className="relative h-20 shrink-0 overflow-hidden bg-brand-gradient">
        <div className="bg-dot-grid absolute inset-0 text-white/15" />
        <span className="absolute right-3 bottom-2 text-4xl opacity-90 drop-shadow transition-transform duration-300 group-hover:scale-110">
          {GENRE_EMOJI[text.genre] ?? '📄'}
        </span>
        <Badge className="absolute top-3 left-3 bg-white/90 text-foreground backdrop-blur">
          {text.genre}
        </Badge>
        {isOwned && (
          <Badge className="absolute top-3 right-3 gap-1 border border-white/40 bg-linear-to-br from-sky-500 via-cyan-500 to-teal-500 text-white shadow-sm">
            <UserRound className="size-3" /> Của bạn
          </Badge>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <TooltipProvider delayDuration={500}>
        <Tooltip>
          <TooltipTrigger asChild>
            <h3
              className="line-clamp-2 h-14 shrink-0 cursor-help overflow-hidden text-base font-semibold leading-6"
              style={{ display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2 }}
            >
              {text.title}
            </h3>
          </TooltipTrigger>
          <TooltipContent
            side="top"
            className="block max-w-sm whitespace-normal wrap-break-word border border-slate-300 bg-slate-100 p-3 text-left text-sm leading-5 text-slate-900 shadow-xl shadow-slate-900/15 [&>svg]:bg-slate-100! [&>svg]:fill-slate-100!"
          >
            {text.title}
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <p
              className="line-clamp-3 h-17 shrink-0 cursor-help overflow-hidden text-sm leading-5 text-muted-foreground"
              style={{ display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 3 }}
            >
              {text.content}
            </p>
          </TooltipTrigger>
          <TooltipContent
            side="top"
            className="block max-h-60 max-w-md overflow-y-auto whitespace-normal wrap-break-word border border-slate-300 bg-slate-100 p-3 text-left text-sm leading-5 text-slate-900 shadow-xl shadow-slate-900/15 [&>svg]:bg-slate-100! [&>svg]:fill-slate-100!"
          >
            {text.content}
          </TooltipContent>
        </Tooltip>
        </TooltipProvider>
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
        {actionButtons}
      </div>
    </motion.div>
  )
}

function EmptyState({
  hasTexts,
  isMine,
  onCreate,
}: {
  hasTexts: boolean
  isMine: boolean
  onCreate: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative overflow-hidden rounded-2xl border border-dashed bg-card/60 p-12 text-center"
    >
      <div className="bg-dot-grid pointer-events-none absolute inset-0 text-foreground/3" />
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
            : isMine
              ? 'Bạn chưa tạo ngữ liệu nào. Hãy tạo bài đọc đầu tiên để bắt đầu.'
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
