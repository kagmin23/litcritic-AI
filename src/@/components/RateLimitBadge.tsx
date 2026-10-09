import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  subscribeRateLimit,
  type RateLimitInfo,
} from '@/services/groqService'
import { cn } from 'cn'
import { Gauge } from 'lucide-react'
import { useEffect, useState } from 'react'

/**
 * Badge nhỏ gọn hiển thị số lượt gọi API Groq còn lại trong cửa sổ hạn ngạch
 * hiện tại (đọc từ header x-ratelimit-remaining-requests).
 *
 * - Tự cập nhật qua store observable của groqService sau mỗi lời gọi API.
 * - Ẩn khi CHƯA có dữ liệu (chưa gọi API lần nào) để không gây rối giao diện.
 * - Màu đổi theo mức còn lại: xanh (dư dả) → hổ phách (sắp hết) → đỏ (rất ít).
 */
export function RateLimitBadge({ className }: { className?: string }) {
  const [info, setInfo] = useState<RateLimitInfo | null>(null)

  useEffect(() => subscribeRateLimit(setInfo), [])

  // Chưa gọi API lần nào hoặc header không có → không hiển thị.
  if (!info || info.remainingRequests == null) return null

  const { remainingRequests: remaining, limitRequests: limit } = info

  // Tỷ lệ còn lại để quyết định tông màu (nếu biết hạn mức tối đa).
  const ratio = limit && limit > 0 ? remaining / limit : null
  const tone =
    (ratio != null && ratio <= 0.1) || remaining <= 5
      ? 'danger'
      : (ratio != null && ratio <= 0.3) || remaining <= 20
        ? 'warn'
        : 'ok'

  const toneClass = {
    ok: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
    warn: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
    danger:
      'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300',
  }[tone]

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            className={cn('cursor-default gap-1 font-semibold', toneClass, className)}
          >
            <Gauge className="size-3" />
            {remaining}
            {limit != null && (
              <span className="font-normal opacity-70">/{limit}</span>
            )}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-0.5">
            <p className="font-semibold">Hạn ngạch API Groq</p>
            <p>
              Còn <strong>{remaining}</strong>
              {limit != null ? ` / ${limit}` : ''} lượt gọi trong cửa sổ hiện
              tại.
            </p>
            {info.remainingTokens != null && (
              <p className="opacity-80">
                Token còn lại: {info.remainingTokens.toLocaleString('vi-VN')}
              </p>
            )}
            <p className="opacity-70">Cập nhật lúc {formatUpdatedAt(info.updatedAt)}</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/** Định dạng thời điểm cập nhật: giờ:phút hôm nay, kèm ngày nếu khác hôm nay. */
function formatUpdatedAt(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  const time = d.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  })
  if (sameDay) return time
  const date = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
  return `${time} ${date}`
}

export default RateLimitBadge
