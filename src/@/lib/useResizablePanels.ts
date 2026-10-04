import { useCallback, useEffect, useRef, useState } from 'react'

export interface PanelState {
  leftOpen: boolean
  rightOpen: boolean
  /** Độ rộng ô trái tính theo % toàn vùng (chỉ áp dụng khi mở). */
  leftPct: number
  /** Độ rộng ô phải tính theo %. */
  rightPct: number
}

const DEFAULT: PanelState = {
  leftOpen: true,
  rightOpen: true,
  leftPct: 30,
  rightPct: 26,
}

// Giới hạn co giãn (phần trăm).
const MIN_SIDE = 18
const MAX_SIDE = 42
const MIN_CENTER = 26

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

/**
 * Quản lý trạng thái 3 ô (trái / giữa / phải): gập-mở + kéo co giãn có giới hạn.
 * Trả về % độ rộng thực tế của từng ô (đã tính lại khi gập), cùng các handler kéo.
 */
export function useResizablePanels(storageKey: string) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<PanelState>(() => {
    if (typeof localStorage === 'undefined') return DEFAULT
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) return { ...DEFAULT, ...(JSON.parse(raw) as PanelState) }
    } catch {
      /* ignore */
    }
    return DEFAULT
  })

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(state))
  }, [state, storageKey])

  const toggleLeft = useCallback(
    () => setState((s) => ({ ...s, leftOpen: !s.leftOpen })),
    []
  )
  const toggleRight = useCallback(
    () => setState((s) => ({ ...s, rightOpen: !s.rightOpen })),
    []
  )

  // Kéo thanh giữa ô TRÁI và ô giữa.
  const startDragLeft = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const onMove = (ev: PointerEvent) => {
      const pct = ((ev.clientX - rect.left) / rect.width) * 100
      setState((s) => {
        const maxLeft = Math.min(
          MAX_SIDE,
          100 - (s.rightOpen ? s.rightPct : 0) - MIN_CENTER
        )
        return { ...s, leftPct: clamp(pct, MIN_SIDE, maxLeft) }
      })
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

  // Kéo thanh giữa ô giữa và ô PHẢI.
  const startDragRight = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const onMove = (ev: PointerEvent) => {
      const pctFromRight = ((rect.right - ev.clientX) / rect.width) * 100
      setState((s) => {
        const maxRight = Math.min(
          MAX_SIDE,
          100 - (s.leftOpen ? s.leftPct : 0) - MIN_CENTER
        )
        return { ...s, rightPct: clamp(pctFromRight, MIN_SIDE, maxRight) }
      })
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
  const left = state.leftOpen ? state.leftPct : 0
  const right = state.rightOpen ? state.rightPct : 0
  const center = 100 - left - right

  return {
    containerRef,
    leftOpen: state.leftOpen,
    rightOpen: state.rightOpen,
    widths: { left, center, right },
    toggleLeft,
    toggleRight,
    startDragLeft,
    startDragRight,
  }
}
