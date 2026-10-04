import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Clock } from 'lucide-react'

interface IdleWarningDialogProps {
  open: boolean
  secondsLeft: number
  onStay: () => void
  onLogout: () => void
}

/**
 * Hộp thoại cảnh báo sắp bị đăng xuất do không hoạt động.
 * Hiện đếm ngược và cho phép người dùng chủ động ở lại.
 */
export function IdleWarningDialog({
  open,
  secondsLeft,
  onStay,
  onLogout,
}: IdleWarningDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onStay()}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
              <Clock className="size-5" />
            </span>
            <DialogTitle>Phiên sắp hết hạn</DialogTitle>
          </div>
          <DialogDescription>
            Bạn không hoạt động một thời gian. Hệ thống sẽ tự động đăng xuất
            sau{' '}
            <span className="font-semibold tabular-nums text-foreground">
              {secondsLeft}
            </span>{' '}
            giây để bảo vệ tài khoản.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onLogout}>
            Đăng xuất ngay
          </Button>
          <Button onClick={onStay}>Tiếp tục làm việc</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default IdleWarningDialog
