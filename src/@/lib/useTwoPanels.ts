import { useCallback, useEffect, useRef, useState } from 'react'

export interface TwoPanelState {
  leftOpen: boolean
  rightOpen: boolean
  /** Độ rộng ô TRÁI theo % toàn vùng (ô phải = 100 - leftPct). */
  leftPct: number
}

const DEFAULT: TwoPanelState = {
  leftOpen: true,
  rightOpen: true,
  leftPct: 50,
}

// Giới hạn co giãn (phần trăm) — mỗi ô không quá hẹp cũng không quá rộng.
const MIN_PCT = 30
const MAX_PCT = 70

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

/**
 * Quản lý bố cục 2 ô (trái / phải): kéo co giãn CÓ GIỚI HẠN + gập/mở từng ô.
 *
 * - Kéo thanh ở giữa để đổi tỉ lệ rộng; chặn trong khoảng [MIN_PCT, MAX_PCT].
 * - Gập một ô → ô còn lại chiếm toàn bộ chiều rộng; ô bị gập thu thành thanh dọc.
 * - Lưu trạng thái vào localStorage theo `storageKey`.
 */
export function useTwoPanels(storageKey: string) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<TwoPanelState>(() => {
    if (typeof localStorage === 'undefined') return DEFAULT
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) return { ...DEFAULT, ...(JSON.parse(raw) as TwoPanelState) }
    } catch {
      /* ignore */
    }
    return DEFAULT
  })

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(state))
  }, [state, storageKey])

  const toggleLeft = useCallback(
    () =>
      setState((s) => {
        // Không cho gập cả hai ô cùng lúc.
        if (s.leftOpen && !s.rightOpen) return s
        return { ...s, leftOpen: !s.leftOpen }
      }),
    []
  )
  const toggleRight = useCallback(
    () =>
      setState((s) => {
        if (s.rightOpen && !s.leftOpen) return s
        return { ...s, rightOpen: !s.rightOpen }
      }),
    []
  )

  const startDrag = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const onMove = (ev: PointerEvent) => {
      const pct = ((ev.clientX - rect.left) / rect.width) * 100
      setState((s) => ({ ...s, leftPct: clamp(pct, MIN_PCT, MAX_PCT) }))
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [])

  // Độ rộng thực tế (%), tính lại theo trạng thái gập.
  const bothOpen = state.leftOpen && state.rightOpen
  const left = !state.leftOpen ? 0 : !state.rightOpen ? 100 : state.leftPct
  const right = !state.rightOpen ? 0 : !state.leftOpen ? 100 : 100 - left

  return {
    containerRef,
    leftOpen: state.leftOpen,
    rightOpen: state.rightOpen,
    bothOpen,
    widths: { left, right },
    toggleLeft,
    toggleRight,
    startDrag,
  }
}
