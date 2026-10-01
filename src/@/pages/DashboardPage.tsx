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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useNav } from '@/lib/navigation'
import { isSupabaseConfigured } from '@/lib/supabaseClient'
import { isGeminiConfigured } from '@/services/geminiService'
import { createSession, listTexts, upsertStudent } from '@/services/supabaseService'
import type { TextItem } from '@/types'
import {
  AlertCircle,
  BarChart3,
  BookOpenText,
  GraduationCap,
  Plus,
  Swords,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

export function DashboardPage() {
  const { navigate } = useNav()
  const [texts, setTexts] = useState<TextItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Dialog nhập thông tin học sinh trước khi vào tranh luận
  const [startFor, setStartFor] = useState<TextItem | null>(null)
  const [fullName, setFullName] = useState('')
  const [className, setClassName] = useState('')
  const [starting, setStarting] = useState(false)

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

  // Tải dữ liệu khi mount — mẫu data-fetch hợp lệ.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh()
  }, [refresh])

  async function handleStart() {
    if (!startFor || !fullName.trim() || !className.trim()) return
    setStarting(true)
    try {
      const student = await upsertStudent(fullName.trim(), className.trim())
      const session = await createSession(student.id, startFor.id)
      setStartFor(null)
      setFullName('')
      setClassName('')
      navigate({ name: 'debate', sessionId: session.id })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không khởi tạo được phiên tranh luận.')
    } finally {
      setStarting(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      {/* Header */}
      <header className="mb-8 flex flex-col gap-4 rounded-2xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 p-8 text-white shadow-lg">
        <div className="flex items-center gap-2 text-sm font-medium opacity-90">
          <GraduationCap className="size-5" />
          Đề tài nghiên cứu khoa học kỹ thuật ViSEF
        </div>
        <h1 className="font-heading text-2xl leading-tight font-bold sm:text-3xl">
          Hệ thống AI Multi-Agent Đánh giá & Phát triển
          <br className="hidden sm:block" /> Tư duy Phản biện trong Đọc hiểu Ngữ văn
        </h1>
        <p className="max-w-3xl text-sm text-white/85">
          Bám sát Chương trình GDPT 2018. Học sinh tranh luận bàn tròn cùng 4
          nhà phê bình AI (Cấu trúc luận · Tâm lý học · Xã hội - Lịch sử · Nữ
          quyền/Văn hóa) dưới sự điều phối của Trọng tài, từ đó đo lường chỉ số
          tư duy phản biện mở S_critical.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            variant="secondary"
            onClick={() => navigate({ name: 'textInput' })}
          >
            <Plus /> Tạo bài mới
          </Button>
          <Button
            variant="outline"
            className="border-white/40 bg-white/10 text-white hover:bg-white/20 hover:text-white"
            onClick={() => navigate({ name: 'admin' })}
          >
            <BarChart3 /> Dashboard Quản trị ViSEF
          </Button>
        </div>
      </header>

      {/* Cảnh báo cấu hình */}
      {(!isSupabaseConfigured || !isGeminiConfigured) && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertCircle className="mt-0.5 size-5 shrink-0" />
          <div className="space-y-1">
            <p className="font-medium">Lưu ý cấu hình môi trường (.env)</p>
            <ul className="list-inside list-disc space-y-0.5 text-amber-700 dark:text-amber-300">
              {!isGeminiConfigured && (
                <li>
                  Thiếu <code>VITE_GEMINI_API_KEY</code> — các tính năng AI chưa
                  hoạt động.
                </li>
              )}
              {!isSupabaseConfigured && (
                <li>
                  Thiếu <code>VITE_SUPABASE_URL</code> /{' '}
                  <code>VITE_SUPABASE_ANON_KEY</code> — đang chạy chế độ demo
                  (dữ liệu lưu tạm trong trình duyệt).
                </li>
              )}
            </ul>
          </div>
        </div>
      )}

      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-heading flex items-center gap-2 text-lg font-semibold">
          <BookOpenText className="size-5" /> Thư viện ngữ liệu
        </h2>
        <span className="text-sm text-muted-foreground">
          {texts.length} bài đọc
        </span>
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-6 w-40" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : texts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="text-4xl">📚</span>
            <p className="text-sm text-muted-foreground">
              Chưa có ngữ liệu nào. Hãy tạo bài đọc đầu tiên để bắt đầu.
            </p>
            <Button onClick={() => navigate({ name: 'textInput' })}>
              <Plus /> Tạo bài mới
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {texts.map((t) => (
            <Card key={t.id} className="flex flex-col">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{t.genre}</Badge>
                  {t.keywords.length > 0 && (
                    <Badge variant="outline">{t.keywords.length} từ khó</Badge>
                  )}
                </div>
                <CardTitle className="line-clamp-2">{t.title}</CardTitle>
                <CardDescription className="line-clamp-3">
                  {t.content}
                </CardDescription>
              </CardHeader>
              <CardContent className="mt-auto">
                <Button className="w-full" onClick={() => setStartFor(t)}>
                  <Swords /> Vào tranh luận
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog thông tin học sinh */}
      <Dialog open={!!startFor} onOpenChange={(o) => !o && setStartFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Thông tin học sinh tham gia</DialogTitle>
            <DialogDescription>
              Nhập họ tên và lớp để ghi nhận phiên tranh luận cho bài{' '}
              <strong>{startFor?.title}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Họ và tên</label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Nguyễn Văn A"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Lớp</label>
              <Input
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                placeholder="11A1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStartFor(null)}>
              Hủy
            </Button>
            <Button
              onClick={handleStart}
              disabled={starting || !fullName.trim() || !className.trim()}
            >
              {starting ? 'Đang khởi tạo…' : 'Bắt đầu tranh luận'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default DashboardPage
