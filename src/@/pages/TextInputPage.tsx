import { useRef, useState } from 'react'
import {
  ArrowLeft,
  FileText,
  ImageUp,
  Sparkles,
  Save,
  ScanText,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useNav } from '@/lib/navigation'
import { analyzeUnseenText } from '@/services/geminiService'
import { createText, createSession, upsertStudent } from '@/services/supabaseService'
import type { AnalyzedText } from '@/types'

export function TextInputPage() {
  const { navigate } = useNav()
  const fileRef = useRef<HTMLInputElement>(null)

  const [rawText, setRawText] = useState('')
  const [imageBase64, setImageBase64] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AnalyzedText | null>(null)

  // Thông tin học sinh để khởi tạo phiên ngay sau khi lưu
  const [fullName, setFullName] = useState('')
  const [className, setClassName] = useState('')

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setImageBase64(reader.result as string)
    reader.onerror = () => setError('Không đọc được ảnh. Vui lòng thử lại.')
    reader.readAsDataURL(file)
  }

  async function handleAnalyze() {
    if (!rawText.trim() && !imageBase64) {
      setError('Vui lòng nhập văn bản hoặc tải ảnh trang sách.')
      return
    }
    setAnalyzing(true)
    setError(null)
    setResult(null)
    try {
      const analyzed = await analyzeUnseenText(rawText, imageBase64 ?? undefined)
      setResult(analyzed)
      if (!rawText.trim()) setRawText(analyzed.content)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Phân tích thất bại.')
    } finally {
      setAnalyzing(false)
    }
  }

  async function handleSaveAndStart() {
    if (!result) return
    setSaving(true)
    setError(null)
    try {
      const text = await createText({
        title: result.title,
        content: result.content,
        genre: result.genre,
        keywords: result.keywords,
        background: result.background,
        initial_questions: result.initial_questions,
      })

      // Nếu đã nhập tên học sinh thì khởi tạo phiên và vào đấu trường ngay.
      if (fullName.trim() && className.trim()) {
        const student = await upsertStudent(fullName.trim(), className.trim())
        const session = await createSession(student.id, text.id)
        navigate({ name: 'debate', sessionId: session.id })
      } else {
        navigate({ name: 'dashboard' })
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lưu ngữ liệu thất bại.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <Button
        variant="ghost"
        className="mb-4"
        onClick={() => navigate({ name: 'dashboard' })}
      >
        <ArrowLeft /> Về trang chủ
      </Button>

      <div className="mb-6">
        <h1 className="font-heading text-2xl font-bold">
          Phân hệ 1 · Tiếp nhận & Phân tích Ngữ liệu Mới
        </h1>
        <p className="text-sm text-muted-foreground">
          Nhập văn bản hoặc tải ảnh trang sách để AI bóc tách thể loại, từ khó,
          bối cảnh và tạo ma trận câu hỏi định hướng.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Cột nhập liệu */}
        <Card>
          <CardHeader>
            <CardTitle>Nguồn ngữ liệu</CardTitle>
            <CardDescription>
              Chọn gõ/dán văn bản hoặc tải ảnh để OCR.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="text">
              <TabsList className="w-full">
                <TabsTrigger value="text">
                  <FileText /> Văn bản
                </TabsTrigger>
                <TabsTrigger value="image">
                  <ImageUp /> Ảnh / Trang sách
                </TabsTrigger>
              </TabsList>

              <TabsContent value="text" className="pt-4">
                <Textarea
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder="Dán hoặc gõ ngữ liệu văn học tại đây…"
                  className="min-h-56"
                />
              </TabsContent>

              <TabsContent value="image" className="pt-4">
                <div className="space-y-3">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFile}
                  />
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => fileRef.current?.click()}
                  >
                    <ScanText /> Chọn ảnh trang sách
                  </Button>
                  {imageBase64 && (
                    <img
                      src={imageBase64}
                      alt="Xem trước"
                      className="max-h-56 w-full rounded-lg border object-contain"
                    />
                  )}
                  <p className="text-xs text-muted-foreground">
                    AI sẽ đóng vai OCR trích xuất chữ tiếng Việt từ ảnh.
                  </p>
                </div>
              </TabsContent>
            </Tabs>

            <Button
              className="mt-4 w-full"
              onClick={handleAnalyze}
              disabled={analyzing}
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
        <Card>
          <CardHeader>
            <CardTitle>Kết quả bóc tách</CardTitle>
            <CardDescription>
              Thông tin do AI phân tích theo định hướng GDPT 2018.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {analyzing && (
              <div className="space-y-3">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            )}

            {!analyzing && !result && (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Kết quả phân tích sẽ hiển thị ở đây.
              </p>
            )}

            {!analyzing && result && (
              <>
                <div>
                  <h3 className="font-heading text-lg font-semibold">
                    {result.title}
                  </h3>
                  <Badge variant="secondary" className="mt-1">
                    {result.genre}
                  </Badge>
                </div>

                <div>
                  <p className="mb-1 text-xs font-semibold text-muted-foreground uppercase">
                    Từ khó / Hán-Việt
                  </p>
                  {result.keywords.length === 0 ? (
                    <p className="text-sm text-muted-foreground">—</p>
                  ) : (
                    <ul className="space-y-1 text-sm">
                      {result.keywords.map((k, i) => (
                        <li key={i}>
                          <span className="font-medium">{k.term}</span>
                          {k.meaning && (
                            <span className="text-muted-foreground">
                              {' '}
                              — {k.meaning}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <p className="mb-1 text-xs font-semibold text-muted-foreground uppercase">
                    Bối cảnh lịch sử - văn hóa
                  </p>
                  <p className="text-sm leading-relaxed">
                    {result.background || '—'}
                  </p>
                </div>

                <div>
                  <p className="mb-1 text-xs font-semibold text-muted-foreground uppercase">
                    Câu hỏi định hướng
                  </p>
                  <ol className="list-inside list-decimal space-y-1 text-sm">
                    {result.initial_questions.map((q, i) => (
                      <li key={i}>{q}</li>
                    ))}
                  </ol>
                </div>

                <div className="rounded-lg border bg-muted/40 p-3">
                  <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase">
                    (Tùy chọn) Khởi tạo phiên ngay — nhập thông tin học sinh
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Họ và tên"
                    />
                    <Input
                      value={className}
                      onChange={(e) => setClassName(e.target.value)}
                      placeholder="Lớp"
                    />
                  </div>
                </div>

                <Button
                  className="w-full"
                  onClick={handleSaveAndStart}
                  disabled={saving}
                >
                  {saving ? <Loader2 className="animate-spin" /> : <Save />}
                  {fullName.trim() && className.trim()
                    ? 'Lưu ngữ liệu & Khởi tạo phiên tranh luận'
                    : 'Lưu ngữ liệu vào thư viện'}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default TextInputPage
