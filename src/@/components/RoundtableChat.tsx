import { CopyButton } from '@/components/CopyButton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  senderAvatarClass,
  senderBadgeClass,
  senderEmoji,
  senderLabel,
} from '@/lib/agents'
import type { Attitude, InteractionLog } from '@/types'
import { cn } from 'cn'
import { useEffect, useRef } from 'react'

interface RoundtableChatProps {
  logs: InteractionLog[]
  loading?: boolean
}

const ATTITUDE_META: Record<Attitude, { label: string; className: string }> = {
  Agree: {
    label: 'Đồng ý',
    className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  },
  Disagree: {
    label: 'Phản bác',
    className: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
  },
  Supplement: {
    label: 'Bổ sung',
    className: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
  },
}

/** Khung Roundtable Chat Feed cho đấu trường Multi-Agent. */
export function RoundtableChat({ logs, loading }: RoundtableChatProps) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs, loading])

  return (
    <div className="flex flex-col gap-4 overflow-y-auto p-1">
      {logs.length === 0 && !loading && (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Chưa có lượt tranh luận nào. Hãy nêu quan điểm của em về ngữ liệu để
          bắt đầu phiên bàn tròn với 4 nhà phê bình.
        </div>
      )}

      {logs.map((log) => {
        const isStudent = log.sender === 'Student'
        return (
          <div
            key={log.id}
            className={cn(
              'flex gap-3',
              isStudent && 'flex-row-reverse text-right'
            )}
          >
            <Avatar className="mt-0.5 shrink-0">
              <AvatarFallback className={senderAvatarClass(log.sender)}>
                <span aria-hidden>{senderEmoji(log.sender)}</span>
              </AvatarFallback>
            </Avatar>

            <div
              className={cn(
                'flex max-w-[85%] flex-col gap-1.5',
                isStudent && 'items-end'
              )}
            >
              <div
                className={cn(
                  'flex flex-wrap items-center gap-1.5',
                  isStudent && 'flex-row-reverse'
                )}
              >
                <Badge className={senderBadgeClass(log.sender)}>
                  {senderLabel(log.sender)}
                </Badge>
                {log.attitude && (
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[10px] font-medium',
                      ATTITUDE_META[log.attitude].className
                    )}
                  >
                    {ATTITUDE_META[log.attitude].label}
                  </span>
                )}
              </div>

              <div
                className={cn(
                  'group/msg relative rounded-xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ring-1 ring-foreground/10',
                  isStudent
                    ? 'bg-sky-50 text-sky-950 dark:bg-sky-950/40 dark:text-sky-100'
                    : 'bg-card'
                )}
              >
                {/* Nút copy — chỉ hiện khi hover vào message */}
                {log.message && (
                  <CopyButton
                    text={log.message}
                    className={cn(
                      'absolute top-1 opacity-0 transition-opacity group-hover/msg:opacity-100',
                      isStudent ? 'left-1' : 'right-1',
                      'bg-background/70 backdrop-blur'
                    )}
                  />
                )}
                {log.message}
              </div>

              {log.fallacies && log.fallacies.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {log.fallacies.map((f, i) => (
                    <Badge key={i} variant="destructive" className="text-[10px]">
                      ⚠ {f}
                    </Badge>
                  ))}
                </div>
              )}

              {typeof log.s_critical_score === 'number' && (
                <span className="text-[10px] text-muted-foreground">
                  Điểm tư duy lượt này: {log.s_critical_score.toFixed(0)}/100
                </span>
              )}
            </div>
          </div>
        )
      })}

      {loading && (
        <div className="flex flex-col gap-3">
          {['Structuralist', 'Psychoanalytic', 'SocioHistorical'].map((s) => (
            <div key={s} className="flex gap-3">
              <Skeleton className="size-8 shrink-0 rounded-full" />
              <div className="flex w-full flex-col gap-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-12 w-full" />
              </div>
            </div>
          ))}
          <p className="text-center text-xs text-muted-foreground">
            Các nhà phê bình đang suy nghĩ…
          </p>
        </div>
      )}

      <div ref={endRef} />
    </div>
  )
}

export default RoundtableChat
