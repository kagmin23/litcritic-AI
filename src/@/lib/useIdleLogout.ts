import { useCallback, useEffect, useRef, useState } from 'react'

// ============================================================================
// useIdleLogout — Tự động đăng xuất khi người dùng không hoạt động.
//
// Cơ chế:
// - Theo dõi các sự kiện tương tác (chuột, bàn phím, chạm, cuộn).
// - Sau `idleMs - warningMs` không hoạt động: hiện cảnh báo (đếm ngược).
// - Hết `idleMs` không hoạt động: gọi `onTimeout` (đăng xuất).
// - Đồng bộ "lần hoạt động cuối" qua localStorage để nhiều tab chung một phiên.
//
// Khoảng thời gian mặc định được chọn hợp lý cho ứng dụng giáo dục dùng chung
// máy (phòng máy trường học): 30 phút cho học sinh/giáo viên, 15 phút cho admin.
// ============================================================================

/** Kênh localStorage để đồng bộ hoạt động giữa các tab. */
const ACTIVITY_KEY = 'visef_last_activity'

/** Các sự kiện trên window coi là "có hoạt động". */
const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  'mousedown',
  'mousemove',
  'keydown',
  'touchstart',
  'scroll',
  'wheel',
]

export interface UseIdleLogoutOptions {
  /** Bật/tắt (vd: chỉ bật khi đã đăng nhập). Mặc định true. */
  enabled?: boolean
  /** Tổng thời gian idle trước khi đăng xuất (ms). */
  idleMs: number
  /** Thời gian hiện cảnh báo trước khi đăng xuất (ms). */
  warningMs: number
  /** Gọi khi hết giờ — thường là logout(). */
  onTimeout: () => void
}

export interface UseIdleLogoutResult {
  /** Đang trong giai đoạn cảnh báo (nên hiện dialog). */
  warning: boolean
  /** Số giây còn lại trước khi đăng xuất (khi đang cảnh báo). */
  secondsLeft: number
  /** Người dùng bấm "Tiếp tục" — reset bộ đếm. */
  stayActive: () => void
}

export function useIdleLogout({
  enabled = true,
  idleMs,
  warningMs,
  onTimeout,
}: UseIdleLogoutOptions): UseIdleLogoutResult {
  const [warning, setWarning] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(0)

  // Giữ callback mới nhất mà không làm effect chạy lại.
  const onTimeoutRef = useRef(onTimeout)
  useEffect(() => {
    onTimeoutRef.current = onTimeout
  }, [onTimeout])

  const warnTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const logoutTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdown = useRef<ReturnType<typeof setInterval> | null>(null)

  const clearTimers = useCallback(() => {
    if (warnTimer.current) clearTimeout(warnTimer.current)
    if (logoutTimer.current) clearTimeout(logoutTimer.current)
    if (countdown.current) clearInterval(countdown.current)
    warnTimer.current = null
    logoutTimer.current = null
    countdown.current = null
  }, [])

  // Lên lịch cảnh báo + đăng xuất dựa trên mốc hoạt động cuối (timestamp ms).
  const schedule = useCallback(
    (lastActivity: number) => {
      clearTimers()
      setWarning(false)

      const now = Date.now()
      const elapsed = now - lastActivity
      const untilWarn = Math.max(0, idleMs - warningMs - elapsed)
      const untilLogout = Math.max(0, idleMs - elapsed)

      // Nếu đã quá hạn (vd: tab ngủ lâu) → đăng xuất ngay.
      if (untilLogout <= 0) {
        onTimeoutRef.current()
        return
      }

      const startWarning = () => {
        setWarning(true)
        const tick = () => {
          const remain = Math.ceil(
            (lastActivity + idleMs - Date.now()) / 1000
          )
          setSecondsLeft(Math.max(0, remain))
        }
        tick()
        countdown.current = setInterval(tick, 1000)
      }

      if (untilWarn <= 0) {
        startWarning()
      } else {
        warnTimer.current = setTimeout(startWarning, untilWarn)
      }

      logoutTimer.current = setTimeout(() => {
        onTimeoutRef.current()
      }, untilLogout)
    },
    [clearTimers, idleMs, warningMs]
  )

  // Ghi nhận hoạt động: cập nhật mốc, phát sang các tab khác, lên lịch lại.
  const registerActivity = useCallback(() => {
    const now = Date.now()
    try {
      localStorage.setItem(ACTIVITY_KEY, String(now))
    } catch {
      /* bỏ qua nếu localStorage không khả dụng */
    }
    schedule(now)
  }, [schedule])

  const stayActive = useCallback(() => {
    registerActivity()
  }, [registerActivity])

  useEffect(() => {
    if (!enabled) {
      clearTimers()
      // Không reset state đồng bộ trong effect; dialog đã bị ẩn khi
      // `enabled` tắt (vd: đã đăng xuất) nhờ điều kiện render phía ngoài.
      return
    }

    // Bật idle tracking đồng nghĩa phiên vừa được khôi phục hoặc đăng nhập.
    // Không dùng timestamp cũ vì nó có thể khiến phiên mới bị logout ngay.
    const last = Date.now()
    try {
      localStorage.setItem(ACTIVITY_KEY, String(last))
    } catch {
      /* bỏ qua */
    }
    // Hoãn lịch đầu tiên sang tick kế để tránh setState đồng bộ trong effect.
    const initial = setTimeout(() => schedule(last), 0)

    // Trong lúc đang cảnh báo, KHÔNG tự reset khi di chuột — người dùng phải
    // chủ động bấm "Tiếp tục". Nhưng vẫn gom hoạt động ngoài giai đoạn cảnh báo.
    let throttle = 0
    const onActivity = () => {
      // Khi tab ẩn thì bỏ qua mousemove giả.
      if (document.visibilityState === 'hidden') return
      const now = Date.now()
      if (now - throttle < 1000) return // gom sự kiện, tối đa 1 lần/giây
      throttle = now
      registerActivity()
    }

    ACTIVITY_EVENTS.forEach((ev) =>
      window.addEventListener(ev, onActivity, { passive: true })
    )
    // Quay lại tab (visibilitychange thuộc document) cũng tính là hoạt động.
    const onVisible = () => {
      if (document.visibilityState === 'visible') registerActivity()
    }
    document.addEventListener('visibilitychange', onVisible)

    // Đồng bộ giữa các tab: tab khác hoạt động → lên lịch lại theo mốc mới.
    const onStorage = (e: StorageEvent) => {
      if (e.key !== ACTIVITY_KEY || !e.newValue) return
      const ts = Number(e.newValue)
      if (!Number.isNaN(ts)) schedule(ts)
    }
    window.addEventListener('storage', onStorage)

    return () => {
      clearTimeout(initial)
      ACTIVITY_EVENTS.forEach((ev) =>
        window.removeEventListener(ev, onActivity)
      )
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('storage', onStorage)
      clearTimers()
    }
  }, [enabled, schedule, registerActivity, clearTimers])

  return { warning, secondsLeft, stayActive }
}
