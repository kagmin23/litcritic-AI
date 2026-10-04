import { PendingBanner } from '@/components/PendingBanner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/lib/authContext'
import { ACCEPT_UPLOAD, readUploadedFile } from '@/lib/fileUtils'
import { fadeUpItem, staggerContainer } from '@/lib/motion'
import { useNav } from '@/lib/navigation'
import { analyzeUnseenText, ocrImage } from '@/services/geminiService'
import {
  createSession,
  createText,
  upsertStudent,
} from '@/services/supabaseService'
import type { AnalyzedText } from '@/types'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeft,
  BookMarked,
  CheckCircle2,
  FileText,
  HelpCircle,
  ImageUp,
  Landmark,
  Loader2,
  Paperclip,
  Save,
  ScanText,
  Sparkles,
  Swords,
  Trash2,
  Wand2,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

const DRAFT_KEY = 'visef_text_draft'

interface Draft {
  rawText: string
  imageBase64: string | null
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
      if (raw) return JSON.parse(raw) as Draft
    } catch {
      /* ignore */
    }
    return { rawText: '', imageBase64: null, ocrText: '', result: null }
  })()

  const [rawText, setRawText] = useState(initialDraft.rawText)
  const [imageBase64, setImageBase64] = useState<string | null>(
    initialDraft.imageBase64
  )
  const [ocrText, setOcrText] = useState(initialDraft.ocrText ?? '')
  const [ocrLoading, setOcrLoading] = useState(false)
  const [result, setResult] = useState<AnalyzedText | null>(initialDraft.result)
  const [analyzing, setAnalyzing] = useState(false)
  const [saving, setSaving] = useState<'save' | 'start' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [draftSaved, setDraftSaved] = useState(false)

  // Tự động lưu bản nháp (debounce) mỗi khi nội dung đổi.
  useEffect(() => {
    const hasAny = rawText.trim() || imageBase64 || ocrText.trim() || result
    const t = setTimeout(() => {
      if (hasAny) {
        localStorage.setItem(
          DRAFT_KEY,
          JSON.stringify({
            rawText,
            imageBase64,
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
  }, [rawText, imageBase64, ocrText, result])

  const hasDraft = Boolean(
    rawText.trim() || imageBase64 || ocrText.trim() || result
  )

  function clearDraft() {
    localStorage.removeItem(DRAFT_KEY)
    setRawText('')
    setImageBase64(null)
    setOcrText('')
    setResult(null)
    setError(null)
  }

  /** Chạy OCR một ảnh (data URL) để lấy văn bản xem trước. */
  const runOcr = useCallback(async (dataUrl: string) => {
    setOcrLoading(true)
    setError(null)
    try {
      const text = await ocrImage(dataUrl)
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

  const handleFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return
      setError(null)
      try {
        const res = await readUploadedFile(file)
        if (res.kind === 'image') {
          const dataUrl = res.imageBase64 ?? null
          setImageBase64(dataUrl)
          setOcrText('')
          // Tự động OCR ngay để xem trước văn bản.
          if (dataUrl) void runOcr(dataUrl)
        } else if (res.kind === 'text') {
          setRawText((prev) =>
            prev ? `${prev}\n${res.text ?? ''}` : (res.text ?? '')
          )
        } else {
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

  async function handleAnalyze() {
    if (locked) return
    // Ưu tiên văn bản gõ tay; nếu không có thì dùng văn bản OCR (đã xem trước & sửa).
    const sourceText = rawText.trim() || ocrText.trim()
    if (!sourceText && !imageBase64) {
      setError('Vui lòng nhập văn bản hoặc tải ảnh trang sách.')
      return
    }
    setAnalyzing(true)
    setError(null)
    setResult(null)
    try {
      // Nếu đã OCR ra văn bản thì phân tích trực tiếp văn bản đó (không gửi lại ảnh,
      // tiết kiệm 1 lượt gọi và dùng đúng bản người dùng đã chỉnh).
      const analyzed = sourceText
        ? await analyzeUnseenText(sourceText)
        : await analyzeUnseenText('', imageBase64 ?? undefined)
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
    const text = await createText({
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
      const session = await createSession(student.id, textId)
      localStorage.removeItem(DRAFT_KEY)
      navigate({ name: 'debate', sessionId: session.id })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Khởi tạo phiên thất bại.')
      setSaving(null)
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-5 lg:px-8">
      {/* Header gọn: back + tiêu đề + trạng thái nháp trên một hàng */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => navigate({ name: 'dashboard' })}
            aria-label="Về trang chủ"
          >
            <ArrowLeft />
          </Button>
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

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Cột nhập liệu */}
        <Card>
          <CardContent className="p-4">
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
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="flex items-center gap-1 font-medium text-primary hover:underline"
                  >
                    <Paperclip className="size-3.5" /> Tải tệp .txt
                  </button>
                </div>
              </TabsContent>

              <TabsContent value="image" className="pt-3">
                <input
                  ref={fileRef}
                  type="file"
                  accept={ACCEPT_UPLOAD}
                  className="hidden"
                  onChange={(e) => void handleFile(e.target.files?.[0])}
                />
                {imageBase64 ? (
                  <div className="space-y-3">
                    <div className="relative">
                      <img
                        src={imageBase64}
                        alt="Xem trước"
                        className="max-h-56 w-full rounded-xl border object-contain"
                      />
                      <Button
                        variant="secondary"
                        size="icon-sm"
                        className="absolute top-2 right-2"
                        onClick={() => {
                          setImageBase64(null)
                          setOcrText('')
                        }}
                        aria-label="Gỡ ảnh"
                      >
                        <X className="size-4" />
                      </Button>
                    </div>

                    {/* Văn bản OCR xem trước — tự động nhận dạng, có thể sửa */}
                    <div className="rounded-xl border bg-muted/30 p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase">
                          <ScanText className="size-3.5" /> Văn bản nhận dạng (OCR)
                        </span>
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => imageBase64 && void runOcr(imageBase64)}
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
                            nhận dạng chữ trong ảnh…
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

                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => fileRef.current?.click()}
                    >
                      <ScanText /> Chọn tệp khác
                    </Button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="flex min-h-72 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed text-muted-foreground transition-colors hover:border-primary/50 hover:bg-muted/40"
                  >
                    <ImageUp className="size-8" />
                    <span className="text-sm font-medium">
                      Nhấn để tải ảnh trang sách hoặc tệp .txt
                    </span>
                    <span className="text-xs">
                      Ảnh sẽ được AI OCR trích xuất chữ tiếng Việt
                    </span>
                  </button>
                )}
              </TabsContent>
            </Tabs>

            <Button
              className="mt-3 h-10 w-full"
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
              {analyzing ? <Loader2 className="animate-spin" /> : <Sparkles />}
              {analyzing ? 'Đang phân tích…' : 'Phân tích Ngữ liệu với AI'}
            </Button>

            {error && (
              <p className="mt-3 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Cột kết quả */}
        <Card className="overflow-hidden">
          <CardContent className="p-4">
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
              {!analyzing && result && (
                <motion.div
                  key="result"
                  variants={staggerContainer}
                  initial="hidden"
                  animate="show"
                  className="space-y-3.5"
                >
                  <motion.div variants={fadeUpItem}>
                    <h3 className="font-heading text-lg font-semibold">
                      {result.title}
                    </h3>
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

                  <motion.div
                    variants={fadeUpItem}
                    className="flex flex-col gap-2 pt-1 sm:flex-row"
                  >
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={handleSave}
                      disabled={saving !== null}
                    >
                      {saving === 'save' ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <Save />
                      )}
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
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </div>
    </div>
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
