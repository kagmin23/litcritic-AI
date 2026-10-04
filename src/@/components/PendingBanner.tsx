import { motion } from 'framer-motion'
import { Clock, ShieldX } from 'lucide-react'
import { useAuth } from '@/lib/authContext'

/**
 * Banner hiển thị khi tài khoản giáo viên đang CHỜ PHÊ DUYỆT hoặc BỊ TỪ CHỐI.
 * Khi pending/rejected, các tính năng chính bị khóa (xem `useAuth().isActive`).
 */
export function PendingBanner() {
  const { isPending, isRejected } = useAuth()
  if (!isPending && !isRejected) return null

  if (isRejected) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-5 flex items-start gap-3 rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200"
      >
        <ShieldX className="mt-0.5 size-5 shrink-0" />
        <div>
          <p className="font-semibold">Tài khoản bị từ chối</p>
          <p className="text-rose-700 dark:text-rose-300">
            Quản trị viên đã từ chối tài khoản giáo viên của bạn. Vui lòng liên
            hệ ban tổ chức ViSEF nếu cần hỗ trợ.
          </p>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-5 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
    >
      <span className="relative mt-0.5 flex size-5 shrink-0">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-400 opacity-60" />
        <Clock className="relative size-5" />
      </span>
      <div>
        <p className="font-semibold">Đang chờ phê duyệt</p>
        <p className="text-amber-700 dark:text-amber-300">
          Tài khoản giáo viên đang chờ Quản trị viên phê duyệt. Các tính
          năng sẽ được mở khóa ngay khi được duyệt. Vui lòng tải lại trang sau
          khi được phê duyệt.
        </p>
      </div>
    </motion.div>
  )
}

export default PendingBanner
