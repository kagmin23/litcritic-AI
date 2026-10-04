import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { cn } from 'cn'

/**
 * Nút copy nhỏ. Dùng trong góc message — chỉ hiện khi hover (gắn class
 * `opacity-0 group-hover:opacity-100` ở nơi gọi). Hiển thị ✓ 1.5s sau khi copy.
 */
export function CopyButton({
  text,
  className,
  label = 'Sao chép',
}: {
  text: string
  className?: string
  label?: string
}) {
  const [copied, setCopied] = useState(false)

  async function handleCopy(e: React.MouseEvent) {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Fallback cho môi trường không có Clipboard API.
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      try {
        document.execCommand('copy')
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      } catch {
        /* ignore */
      }
      document.body.removeChild(ta)
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={label}
      title={copied ? 'Đã sao chép' : label}
      className={cn(
        'inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
        className
      )}
    >
      {copied ? (
        <Check className="size-3.5 text-emerald-500" />
      ) : (
        <Copy className="size-3.5" />
      )}
    </button>
  )
}

export default CopyButton
