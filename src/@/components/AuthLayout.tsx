import { AuroraBackground } from '@/components/AuroraBackground'
import { AGENTS } from '@/lib/agents'
import { motion } from 'framer-motion'
import { BrainCircuit, GraduationCap, Sparkles, Users } from 'lucide-react'

interface AuthLayoutProps {
  title: string
  subtitle: string
  children: React.ReactNode
  /** Nội dung tùy chọn ở góc trên bên phải (vd: nút Đăng nhập Quản trị) */
  topRight?: React.ReactNode
}

/** Bố cục 2 cột cho các trang xác thực: showcase thương hiệu + form. */
export function AuthLayout({
  title,
  subtitle,
  children,
  topRight,
}: AuthLayoutProps) {
  return (
    <div className="relative flex min-h-screen w-full items-stretch">
      <AuroraBackground />

      {/* Cột trái: showcase thương hiệu (ẩn trên mobile) */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-brand-gradient p-10 text-white lg:flex">
        <div className="bg-dot-grid pointer-events-none absolute inset-0 text-white/10" />

        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative flex items-center gap-2 text-sm font-medium"
        >
          <GraduationCap className="size-5" />
          Licritic AI · ViSEF
        </motion.div>

        <div className="relative space-y-6">
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="font-heading text-4xl leading-tight font-bold"
          >
            Tư duy phản biện
            <br />
            trong Đọc hiểu Ngữ văn
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.18 }}
            className="max-w-md text-white/85"
          >
            Nền tảng AI Multi-Agent giúp học sinh tranh luận bàn tròn cùng 4 nhà
            phê bình và đo lường năng lực tư duy phản biện theo GDPT 2018.
          </motion.p>

          <motion.div
            initial="hidden"
            animate="show"
            variants={{ show: { transition: { staggerChildren: 0.08, delayChildren: 0.3 } } }}
            className="flex flex-wrap gap-2 pt-2"
          >
            {Object.values(AGENTS)
              .filter((a) => a.id !== 'Moderator')
              .map((a) => (
                <motion.span
                  key={a.id}
                  variants={{
                    hidden: { opacity: 0, scale: 0.8 },
                    show: { opacity: 1, scale: 1 },
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium ring-1 ring-white/25 backdrop-blur"
                >
                  <span>{a.emoji}</span> {a.shortName}
                </motion.span>
              ))}
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="relative grid grid-cols-3 gap-4 text-white/90"
        >
          <Feature icon={BrainCircuit} label="4 Critic Agents" />
          <Feature icon={Sparkles} label="Chấm điểm S_critical" />
          <Feature icon={Users} label="Theo dõi theo lớp" />
        </motion.div>
      </div>

      {/* Cột phải: form */}
      <div className="relative flex w-full items-center justify-center p-6 lg:w-1/2">
        {topRight && (
          <div className="absolute top-5 right-5 z-10">{topRight}</div>
        )}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-sm"
        >
          <div className="mb-6 flex items-center gap-2 lg:hidden">
            <div className="flex size-9 items-center justify-center rounded-xl bg-brand-gradient text-white">
              <GraduationCap className="size-5" />
            </div>
            <span className="font-heading font-semibold">ViSEF LitCritic</span>
          </div>

          <h2 className="font-heading text-2xl font-bold tracking-tight">
            {title}
          </h2>
          <p className="mt-1 mb-6 text-sm text-muted-foreground">{subtitle}</p>

          {children}
        </motion.div>
      </div>
    </div>
  )
}

function Feature({
  icon: Icon,
  label,
}: {
  icon: typeof Users
  label: string
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 text-center">
      <div className="flex size-10 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20">
        <Icon className="size-5" />
      </div>
      <span className="text-[11px] leading-tight">{label}</span>
    </div>
  )
}

export default AuthLayout
