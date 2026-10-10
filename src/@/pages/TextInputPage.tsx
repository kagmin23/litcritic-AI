import { PendingBanner } from '@/components/PendingBanner'
import { RateLimitBadge } from '@/components/RateLimitBadge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/lib/authContext'
import { ACCEPT_UPLOAD, readUploadedFiles } from '@/lib/fileUtils'
import { fadeUpItem, staggerContainer } from '@/lib/motion'
import { useNav } from '@/lib/navigation'
import { useTwoPanels } from '@/lib/useTwoPanels'
import { ocrImages } from '@/services/geminiService'
import { analyzeUnseenText } from '@/services/groqService'
import {
    createText,
    getOrCreateSession,
    upsertStudent
} from '@/services/supabaseService'
import type { AnalyzedText } from '@/types'
import { AnimatePresence, motion } from 'framer-motion'
import {
    BookMarked,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    FileText,
    HelpCircle,
    ImageUp,
    Landmark,
    Loader2,
    PanelLeft,
    PanelRight,
    Plus,
    RefreshCw,
    Save,
    ScanText,
    Sparkles,
    Swords,
    Trash2,
    Wand2,
    X
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

const DRAFT_KEY = 'visef_text_draft'

interface Draft {
  rawText: string
  /** Danh sách ảnh (data URL) theo đúng thứ tự người dùng tải lên. */
  images: string[]
  /** @deprecated giữ để tương thích bản nháp cũ (một ảnh). */
  imageBase64?: string | null
  ocrText: string
  result: AnalyzedText | null
}

export function TextInputPage() {
  const { navigate } = useNav()
  const { user, isActive } = useAuth()
  const locked = !isActive
  const fileRef = useRef<HTMLInputElement>(null)

  // Khôi phục bản nháp (nếu có) ngay khi khởi tạo state.
  const initialDraft: Draft = (() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      if (raw) {
        const d = JSON.parse(raw) as Draft
        // Tương thích ngược: bản nháp cũ chỉ có imageBase64 (một ảnh).
        if (!Array.isArray(d.images)) {
          d.images = d.imageBase64 ? [d.imageBase64] : []
        }
        return d
      }
    } catch {
      /* ignore */
    }
    return { rawText: '', images: [], ocrText: '', result: null }
  })()

  const [rawText, setRawText] = useState(initialDraft.rawText)
  const [images, setImages] = useState<string[]>(initialDraft.images)
  const [ocrText, setOcrText] = useState(initialDraft.ocrText ?? '')
  const [ocrLoading, setOcrLoading] = useState(false)
  const [result, setResult] = useState<AnalyzedText | null>(initialDraft.result)
  const [analyzing, setAnalyzing] = useState(false)
  const [saving, setSaving] = useState<'save' | 'start' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [draftSaved, setDraftSaved] = useState(false)

  // Bố cục 2 ô: kéo co giãn (có giới hạn) + gập/mở từng ô.
  const {
    containerRef,
    leftOpen,
    rightOpen,
    bothOpen,
    widths,
    toggleLeft,
    toggleRight,
    startDrag,
  } = useTwoPanels('visef_textinput_panels')

  // Tự động lưu bản nháp (debounce) mỗi khi nội dung đổi.
  useEffect(() => {
    const hasAny =
      rawText.trim() || images.length > 0 || ocrText.trim() || result
    const t = setTimeout(() => {
      if (hasAny) {
        localStorage.setItem(
          DRAFT_KEY,
          JSON.stringify({
            rawText,
            images,
            ocrText,
            result,
          } satisfies Draft)
        )
        setDraftSaved(true)
        setTimeout(() => setDraftSaved(false), 1500)
      } else {
        localStorage.removeItem(DRAFT_KEY)
      }
    }, 600)
    return () => clearTimeout(t)
  }, [rawText, images, ocrText, result])

  const hasDraft = Boolean(
    rawText.trim() || images.length > 0 || ocrText.trim() || result
  )

  function clearDraft() {
    localStorage.removeItem(DRAFT_KEY)
    setRawText('')
    setImages([])
    setOcrText('')
    setResult(null)
    setError(null)
  }

  /** Chạy OCR toàn bộ ảnh (theo thứ tự) để lấy văn bản gộp xem trước. */
  const runOcr = useCallback(async (dataUrls: string[]) => {
    if (dataUrls.length === 0) {
      setOcrText('')
      return
    }
    setOcrLoading(true)
    setError(null)
    try {
      const text = await ocrImages(dataUrls)
      setOcrText(text)
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Không nhận dạng được chữ trong ảnh. Bạn có thể nhập/sửa thủ công.'
      )
    } finally {
      setOcrLoading(false)
    }
  }, [])

  /** Nhận một hoặc nhiều tệp cùng lúc (ảnh + .txt). */
  const handleFiles = useCallback(
    async (fileList: FileList | null) => {
      const files = fileList ? Array.from(fileList) : []
      if (files.length === 0) return
      setError(null)
      try {
        const results = await readUploadedFiles(files)
        const newImages = results
          .filter((r) => r.kind === 'image' && r.imageBase64)
          .map((r) => r.imageBase64 as string)
        const texts = results
          .filter((r) => r.kind === 'text')
          .map((r) => r.text ?? '')
          .filter(Boolean)
        const unsupported = results.some((r) => r.kind === 'unsupported')

        if (texts.length > 0) {
          setRawText((prev) =>
            [prev, ...texts].filter(Boolean).join('\n')
          )
        }

        if (newImages.length > 0) {
          // Gộp ảnh mới vào danh sách rồi OCR lại toàn bộ theo thứ tự.
          setImages((prev) => {
            const merged = [...prev, ...newImages]
            void runOcr(merged)
            return merged
          })
        }

        if (unsupported && newImages.length === 0 && texts.length === 0) {
          setError(
            'Định dạng chưa hỗ trợ. Hãy dùng ảnh (jpg/png) hoặc tệp .txt — với PDF/sách giấy, chụp ảnh để AI OCR.'
          )
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Không đọc được tệp.')
      }
    },
    [runOcr]
  )

  /** Gỡ một ảnh khỏi danh sách rồi OCR lại phần còn lại. */
  const removeImage = useCallback(
    (index: number) => {
      setImages((prev) => {
        const next = prev.filter((_, i) => i !== index)
        void runOcr(next)
        return next
      })
    },
    [runOcr]
  )

  async function handleAnalyze() {
    if (locked) return
    // Ưu tiên văn bản gõ tay; nếu không có thì dùng văn bản OCR (đã xem trước & sửa).
    const sourceText = rawText.trim() || ocrText.trim()
    if (!sourceText && images.length === 0) {
      setError('Vui lòng nhập văn bản hoặc tải ảnh trang sách.')
      return
    }
    setAnalyzing(true)
    setError(null)
    setResult(null)
    try {
      // OCR dùng Gemini (model có thị giác), phần phân tích dùng Groq (văn bản).
      // Nếu đã có văn bản (gõ tay hoặc OCR xem trước) thì phân tích trực tiếp;
      // nếu chỉ có ảnh thì OCR gộp toàn bộ ảnh bằng Gemini trước rồi mới sang Groq.
      let textToAnalyze = sourceText
      if (!textToAnalyze && images.length > 0) {
        textToAnalyze = await ocrImages(images)
        if (textToAnalyze) setOcrText(textToAnalyze)
      }
      const analyzed = await analyzeUnseenText(textToAnalyze)
      setResult(analyzed)
      if (!rawText.trim()) setRawText(analyzed.content)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Phân tích thất bại.')
    } finally {
      setAnalyzing(false)
    }
  }

  async function persist(): Promise<string | null> {
    if (!result) return null
    if (!user) throw new Error('Bạn cần đăng nhập để lưu ngữ liệu.')
    const text = await createText({
      owner_id: user.id,
      title: result.title,
      content: result.content,
      genre: result.genre,
      keywords: result.keywords,
      background: result.background,
      initial_questions: result.initial_questions,
    })
    return text.id
  }

  async function handleSave() {
    setSaving('save')
    setError(null)
    try {
      await persist()
      localStorage.removeItem(DRAFT_KEY) // lưu xong → bỏ nháp
      navigate({ name: 'dashboard' })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lưu ngữ liệu thất bại.')
      setSaving(null)
    }
  }

  async function handleSaveAndStart() {
    if (!user) return
    setSaving('start')
    setError(null)
    try {
      const textId = await persist()
      if (!textId) throw new Error('Không lưu được ngữ liệu.')
      const student = await upsertStudent(
        user.profile.full_name || user.email,
        user.profile.class_name || '—'
      )
      // Tạo (hoặc dùng lại) phiên rồi tự động chuyển sang Đấu trường tranh luận
      // của bài vừa tạo.
      const session = await getOrCreateSession(student.id, textId)
      localStorage.removeItem(DRAFT_KEY)
      navigate({ name: 'debate', sessionId: session.id })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Khởi tạo phiên thất bại.')
      setSaving(null)
    }
  }
  /** Phần NỘI DUNG kết quả (cuộn được) — không gồm nút hành động. */
  function renderResultBody() {
    if (!result) return null
    return (
      <motion.div
        key="result"
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="flex flex-col gap-3.5"
      >
        <motion.div variants={fadeUpItem}>
          <h3 className="font-heading text-lg font-semibold">{result.title}</h3>
          <Badge variant="secondary" className="mt-1">
            {result.genre}
          </Badge>
        </motion.div>

        <motion.div variants={fadeUpItem}>
          <SectionLabel icon={BookMarked} text="Từ khó / Hán-Việt" />
          {result.keywords.length === 0 ? (
            <p className="text-sm text-muted-foreground">—</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {result.keywords.map((k, i) => (
                <span
                  key={i}
                  className="rounded-lg bg-amber-100 px-2 py-1 text-xs text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
                  title={k.meaning}
                >
                  <strong>{k.term}</strong>
                  {k.meaning ? ` — ${k.meaning}` : ''}
                </span>
              ))}
            </div>
          )}
        </motion.div>

        <motion.div variants={fadeUpItem}>
          <SectionLabel icon={Landmark} text="Bối cảnh lịch sử - văn hóa" />
          <p className="rounded-lg bg-muted/50 p-3 text-sm leading-relaxed">
            {result.background || '—'}
          </p>
        </motion.div>

        <motion.div variants={fadeUpItem}>
          <SectionLabel icon={HelpCircle} text="Câu hỏi định hướng" />
          <ol className="space-y-1.5">
            {result.initial_questions.map((q, i) => (
              <li key={i} className="flex gap-2 text-sm">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                  {i + 1}
                </span>
                {q}
              </li>
            ))}
          </ol>
        </motion.div>
      </motion.div>
    )
  }

  /** Hai nút hành động — đặt ở footer cố định (và trong Dialog phóng to). */
  function renderActions() {
    if (!result) return null
    return (
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          variant="outline"
          className="flex-1"
          onClick={handleSave}
          disabled={saving !== null}
        >
          {saving === 'save' ? <Loader2 className="animate-spin" /> : <Save />}
          Lưu vào thư viện
        </Button>
        <Button
          className="flex-1"
          onClick={handleSaveAndStart}
          disabled={saving !== null}
        >
          {saving === 'start' ? (
            <Loader2 className="animate-spin" />
          ) : (
            <Swords />
          )}
          Lưu & Tranh luận
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-5 lg:px-8">
      {/* Header gọn: back + tiêu đề + trạng thái nháp trên một hàng */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-sm">
            <Wand2 className="size-5" />
          </div>
          <div>
            <h1 className="font-heading text-xl font-bold leading-tight">
              Tiếp nhận & Phân tích Ngữ liệu
            </h1>
            <p className="text-xs text-muted-foreground">
              AI bóc tách thể loại, từ khó, bối cảnh & câu hỏi định hướng (GDPT 2018).
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <RateLimitBadge />
          <AnimatePresence>
            {draftSaved && (
              <motion.span
                initial={{ opacity: 0, x: 6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400"
              >
                <CheckCircle2 className="size-3.5" /> Đã lưu nháp
              </motion.span>
            )}
          </AnimatePresence>
          {hasDraft && (
            <Button variant="ghost" size="sm" onClick={clearDraft}>
              <Trash2 /> Xóa nháp
            </Button>
          )}
        </div>
      </div>

      <PendingBanner />

      <div
        ref={containerRef}
        className="flex min-h-0 flex-col gap-4 lg:h-[calc(100vh-12rem)] lg:flex-row lg:items-stretch lg:gap-0"
      >
        {/* ===== Ô TRÁI — Nhập liệu ===== */}
        {leftOpen ? (
          <Card
            className="flex w-full shrink-0 flex-col lg:h-full lg:w-[var(--panel-w)]"
            style={{
              ['--panel-w' as string]: `${widths.left}%`,
            }}
          >
          <CardContent className="flex min-h-0 flex-1 flex-col gap-2 p-0">
            {/* Thanh tiêu đề ô (cố định) */}
            <div className="flex shrink-0 items-center justify-between gap-2 px-4 pt-4">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase">
                <FileText className="size-3.5" /> Nhập ngữ liệu
              </span>
              {bothOpen && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="hidden shrink-0 lg:inline-flex"
                  onClick={toggleLeft}
                  title="Thu gọn ô nhập liệu"
                  aria-label="Thu gọn ô nhập liệu"
                >
                  <PanelLeft className="size-4" />
                </Button>
              )}
            </div>

            {/* Vùng nội dung CUỘN */}
            <div className="min-h-0 flex-1 overflow-y-auto px-4">
            <Tabs defaultValue="text">
              <TabsList className="w-full">
                <TabsTrigger value="text">
                  <FileText /> Văn bản
                </TabsTrigger>
                <TabsTrigger value="image">
                  <ImageUp /> Ảnh / Tệp
                </TabsTrigger>
              </TabsList>

              <TabsContent value="text" className="pt-3">
                <Textarea
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder="Dán hoặc gõ ngữ liệu văn học tại đây…"
                  className="min-h-72"
                />
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{rawText.trim().length} ký tự</span>
                  {/* <button
                    onClick={() => fileRef.current?.click()}
                    className="font-medium text-primary hover:underline"
                  >
                    Tải ảnh / tệp .txt
                  </button> */}
                </div>
              </TabsContent>

              <TabsContent value="image" className="pt-3">
                <input
                  ref={fileRef}
                  type="file"
                  multiple
                  accept={ACCEPT_UPLOAD}
                  className="hidden"
                  onChange={(e) => {
                    void handleFiles(e.target.files)
                    // reset để có thể chọn lại cùng tệp lần nữa
                    e.target.value = ''
                  }}
                />
                {images.length > 0 ? (
                  <div className="space-y-3">
                    {/* Lưới ảnh có thể gỡ từng ảnh + ô thêm ảnh */}
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {images.map((img, i) => (
                        <div
                          key={i}
                          className="group relative aspect-[4/5] overflow-hidden rounded-xl border bg-muted/30"
                        >
                          <img
                            src={img}
                            alt={`Ảnh ${i + 1}`}
                            className="h-full w-full object-contain"
                          />
                          <span className="absolute top-1 left-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                            {i + 1}
                          </span>
                          <Button
                            variant="secondary"
                            size="icon-sm"
                            className="absolute top-1 right-1 opacity-80 group-hover:opacity-100"
                            onClick={() => removeImage(i)}
                            aria-label={`Gỡ ảnh ${i + 1}`}
                          >
                            <X className="size-4" />
                          </Button>
                        </div>
                      ))}
                      {/* Ô thêm ảnh */}
                      <button
                        onClick={() => fileRef.current?.click()}
                        className="flex aspect-[4/5] flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed text-muted-foreground transition-colors hover:border-primary/50 hover:bg-muted/40"
                      >
                        <Plus className="size-6" />
                        <span className="text-xs font-medium">Thêm ảnh</span>
                      </button>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {images.length} ảnh — AI sẽ OCR gộp theo đúng thứ tự. Kéo
                      thả hoặc chọn nhiều ảnh một lúc đều được.
                    </p>

                    {/* Văn bản OCR xem trước — tự động nhận dạng, có thể sửa */}
                    <div className="rounded-xl border bg-muted/30 p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase">
                          <ScanText className="size-3.5" /> Văn bản nhận dạng (OCR)
                        </span>
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => void runOcr(images)}
                          disabled={ocrLoading}
                          title="Nhận dạng lại"
                        >
                          {ocrLoading ? (
                            <Loader2 className="animate-spin" />
                          ) : (
                            <ScanText />
                          )}
                          Nhận dạng lại
                        </Button>
                      </div>

                      {ocrLoading ? (
                        <div className="space-y-2 py-1">
                          <div className="flex items-center gap-2 text-xs text-primary">
                            <Loader2 className="size-3.5 animate-spin" /> Đang
                            nhận dạng chữ trong {images.length} ảnh…
                          </div>
                          <Skeleton className="h-4 w-full" />
                          <Skeleton className="h-4 w-11/12" />
                          <Skeleton className="h-4 w-4/5" />
                        </div>
                      ) : (
                        <>
                          <Textarea
                            value={ocrText}
                            onChange={(e) => setOcrText(e.target.value)}
                            placeholder="Văn bản OCR sẽ hiện ở đây. Bạn có thể chỉnh sửa trước khi phân tích…"
                            className="min-h-32 bg-background text-sm"
                          />
                          <p className="mt-1.5 text-[11px] text-muted-foreground">
                            Kiểm tra & sửa lại nếu AI nhận dạng sai, rồi bấm
                            “Phân tích Ngữ liệu với AI”.
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="flex min-h-72 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed text-muted-foreground transition-colors hover:border-primary/50 hover:bg-muted/40"
                  >
                    <ImageUp className="size-8" />
                    <span className="text-sm font-medium">
                      Nhấn để tải một hoặc nhiều ảnh trang sách / tệp .txt
                    </span>
                    <span className="text-xs">
                      Chọn nhiều ảnh cùng lúc — AI OCR gộp theo thứ tự, trích
                      xuất chữ tiếng Việt
                    </span>
                  </button>
                )}
              </TabsContent>
            </Tabs>
            </div>

            {/* Footer CỐ ĐỊNH — nút phân tích */}
            <div className="shrink-0 border-t px-4 py-3">
              <Button
                className="h-10 w-full"
                onClick={handleAnalyze}
                disabled={analyzing || locked || ocrLoading}
                title={
                  locked
                    ? 'Chờ phê duyệt để mở khóa'
                    : ocrLoading
                      ? 'Đang nhận dạng ảnh…'
                      : undefined
                }
              >
                {analyzing ? (
                  <Loader2 className="animate-spin" />
                ) : result ? (
                  <RefreshCw />
                ) : (
                  <Sparkles />
                )}
                {analyzing
                  ? 'Đang phân tích…'
                  : result
                    ? 'Phân tích lại'
                    : 'Phân tích Ngữ liệu với AI'}
              </Button>

              {error && (
                <p className="mt-3 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </p>
              )}
            </div>
          </CardContent>
          </Card>
        ) : (
          <CollapsedBar side="left" label="Nhập liệu" onExpand={toggleLeft} />
        )}

        {/* Thanh kéo co giãn (chỉ khi cả 2 ô đang mở) */}
        {bothOpen && <ResizeHandle onPointerDown={startDrag} />}

        {/* ===== Ô PHẢI — Kết quả ===== */}
        {rightOpen ? (
          <Card
            className="flex w-full shrink-0 flex-col lg:w-[var(--panel-w)]"
            style={{
              ['--panel-w' as string]: `${widths.right}%`,
            }}
          >
          <CardContent className="flex min-h-0 flex-1 flex-col p-0">
            {/* Thanh tiêu đề ô (cố định) + nút phóng to + gập */}
            <div className="flex shrink-0 items-center justify-between gap-2 px-4 pt-4 pb-2">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase">
                <Sparkles className="size-3.5" /> Kết quả phân tích
              </span>
              <div className="flex shrink-0 items-center gap-1">
                {bothOpen && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="hidden lg:inline-flex"
                    onClick={toggleRight}
                    title="Thu gọn ô kết quả"
                    aria-label="Thu gọn ô kết quả"
                  >
                    <PanelRight className="size-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Vùng nội dung CUỘN */}
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-2">
            {analyzing && (
              <div className="space-y-3">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            )}

            {!analyzing && !result && (
              <div className="flex min-h-72 flex-col items-center justify-center gap-3 text-center">
                <div className="animate-float-slow flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Sparkles className="size-6" />
                </div>
                <p className="max-w-xs text-sm text-muted-foreground">
                  Kết quả phân tích AI sẽ hiển thị tại đây — thể loại, từ khó,
                  bối cảnh và câu hỏi định hướng.
                </p>
              </div>
            )}

            <AnimatePresence mode="wait">
              {!analyzing && result && renderResultBody()}
            </AnimatePresence>
            </div>

            {/* Footer CỐ ĐỊNH — nút hành động (chỉ khi đã có kết quả) */}
            {!analyzing && result && (
              <div className="shrink-0 border-t px-4 py-3">{renderActions()}</div>
            )}
          </CardContent>
          </Card>
        ) : (
          <CollapsedBar side="right" label="Kết quả" onExpand={toggleRight} />
        )}
      </div>
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
      className="group hidden w-3 shrink-0 cursor-col-resize items-center justify-center lg:flex"
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
      className="hidden w-10 shrink-0 flex-col items-center gap-2 self-stretch rounded-xl bg-card py-3 ring-1 ring-foreground/10 transition-colors hover:bg-muted lg:flex"
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

function SectionLabel({
  icon: Icon,
  text,
}: {
  icon: typeof BookMarked
  text: string
}) {
  return (
    <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase">
      <Icon className="size-3.5" /> {text}
    </p>
  )
}

export default TextInputPage
