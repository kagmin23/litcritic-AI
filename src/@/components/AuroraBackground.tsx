import { cn } from 'cn'

/**
 * Nền trang trí "aurora" — các khối gradient mờ chuyển động chậm + lưới chấm.
 * Dùng cho trang auth và hero. Thuần CSS, nhẹ, tôn trọng prefers-reduced-motion.
 */
export function AuroraBackground({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-0 -z-10 overflow-hidden',
        className
      )}
      aria-hidden
    >
      <div className="absolute inset-0 bg-dot-grid text-foreground/[0.04]" />
      <div className="animate-aurora absolute -top-32 -left-24 size-[32rem] rounded-full bg-indigo-500/30 blur-3xl dark:bg-indigo-500/20" />
      <div
        className="animate-aurora absolute -right-24 top-10 size-[28rem] rounded-full bg-violet-500/25 blur-3xl dark:bg-violet-500/15"
        style={{ animationDelay: '-6s' }}
      />
      <div
        className="animate-aurora absolute bottom-[-10rem] left-1/3 size-[30rem] rounded-full bg-fuchsia-500/20 blur-3xl dark:bg-fuchsia-500/12"
        style={{ animationDelay: '-11s' }}
      />
    </div>
  )
}

export default AuroraBackground
