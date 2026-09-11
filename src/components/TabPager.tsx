import { useEffect, useRef, type ReactNode } from 'react'
import type { Tab } from './BottomNav'

const ORDER: Tab[] = ['list', 'schedule', 'book']
const LOCK_PX = 8
const EDGE_PX = 24
const COMMIT_RATIO = 0.25
const FLICK = 0.4

type Props = {
  active: Tab
  onChange: (tab: Tab) => void
  disabled?: boolean
  children: ReactNode[]
}

export function TabPager({ active, onChange, disabled, children }: Props) {
  const index = ORDER.indexOf(active)
  const trackRef = useRef<HTMLDivElement>(null)
  const indexRef = useRef(index)

  useEffect(() => {
    indexRef.current = index
  }, [index])
  const start = useRef({ x: 0, y: 0, t: 0 })
  const last = useRef({ x: 0, t: 0 })
  const axis = useRef<'x' | 'y' | null>(null)
  const dragging = useRef(false)
  const dx = useRef(0)

  const paneWidth = () => trackRef.current?.parentElement?.clientWidth ?? window.innerWidth

  const setOffset = (x: number, animate: boolean) => {
    const el = trackRef.current
    if (!el) return
    el.style.transition = animate ? 'transform 240ms ease-out' : 'none'
    el.style.transform = `translate3d(${x}px,0,0)`
  }

  useEffect(() => {
    if (dragging.current) return
    setOffset(-index * paneWidth(), true)
  }, [index])

  useEffect(() => {
    const onResize = () => {
      if (!dragging.current) setOffset(-indexRef.current * paneWidth(), false)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const onPointerDown = (e: React.PointerEvent) => {
    if (disabled) return
    if (e.clientX < EDGE_PX) return
    dragging.current = true
    axis.current = null
    dx.current = 0
    start.current = { x: e.clientX, y: e.clientY, t: e.timeStamp }
    last.current = { x: e.clientX, t: e.timeStamp }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return
    const mx = e.clientX - start.current.x
    const my = e.clientY - start.current.y
    if (!axis.current) {
      if (Math.abs(mx) < LOCK_PX && Math.abs(my) < LOCK_PX) return
      axis.current = Math.abs(mx) > Math.abs(my) ? 'x' : 'y'
    }
    if (axis.current !== 'x') return
    e.preventDefault()
    last.current = { x: e.clientX, t: e.timeStamp }
    let next = mx
    const i = indexRef.current
    if ((i === 0 && next > 0) || (i === ORDER.length - 1 && next < 0)) {
      next *= 0.28
    }
    dx.current = next
    setOffset(-i * paneWidth() + next, false)
  }

  const onPointerUp = () => {
    if (!dragging.current) return
    dragging.current = false
    const i = indexRef.current
    if (axis.current !== 'x') {
      setOffset(-i * paneWidth(), true)
      axis.current = null
      return
    }
    const width = paneWidth()
    const dt = Math.max(1, last.current.t - start.current.t)
    const v = dx.current / dt
    let next = i
    if (Math.abs(dx.current) > width * COMMIT_RATIO || Math.abs(v) > FLICK) {
      if (dx.current < 0 && i < ORDER.length - 1) next = i + 1
      if (dx.current > 0 && i > 0) next = i - 1
    }
    axis.current = null
    if (next !== i) onChange(ORDER[next])
    setOffset(-next * width, true)
  }

  return (
    <div className="flex-1 min-h-0 overflow-hidden touch-pan-y">
      <div
        ref={trackRef}
        className="flex h-full"
        style={{
          width: `${ORDER.length * 100}%`,
          transform: `translate3d(-${index * (100 / ORDER.length)}%,0,0)`,
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {children.map((child, i) => (
          <div
            key={ORDER[i]}
            className="h-full min-h-0 min-w-0 overflow-hidden flex flex-col"
            style={{ width: `${100 / ORDER.length}%` }}
          >
            {child}
          </div>
        ))}
      </div>
    </div>
  )
}
