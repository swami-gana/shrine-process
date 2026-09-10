import { useCallback, useRef } from 'react'

const THRESHOLD_MS = 500
const MOVE_THRESHOLD_PX = 10

type LongPressOptions = {
  onLongPress: () => void
  onClick?: () => void
  disabled?: boolean
}

export function useLongPress({ onLongPress, onClick, disabled }: LongPressOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startPosRef = useRef({ x: 0, y: 0 })
  const firedRef = useRef(false)
  const scrollingRef = useRef(false)

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (disabled) return
      firedRef.current = false
      startPosRef.current = { x: e.clientX, y: e.clientY }
      scrollingRef.current = false

      clearTimer()
      timerRef.current = setTimeout(() => {
        if (!scrollingRef.current) {
          firedRef.current = true
          if (navigator.vibrate) navigator.vibrate(10)
          onLongPress()
        }
      }, THRESHOLD_MS)
    },
    [disabled, onLongPress, clearTimer],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!timerRef.current) return
      const dx = Math.abs(e.clientX - startPosRef.current.x)
      const dy = Math.abs(e.clientY - startPosRef.current.y)
      if (dx > MOVE_THRESHOLD_PX || dy > MOVE_THRESHOLD_PX) {
        clearTimer()
      }
    },
    [clearTimer],
  )

  const onPointerUp = useCallback(() => {
    clearTimer()
  }, [clearTimer])

  const onPointerCancel = useCallback(() => {
    clearTimer()
  }, [clearTimer])

  const onClickHandler = useCallback(
    (e: React.MouseEvent) => {
      if (firedRef.current) {
        e.preventDefault()
        e.stopPropagation()
        firedRef.current = false
        return
      }
      onClick?.()
    },
    [onClick],
  )

  const onContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
  }, [])

  const onScrollCapture = useCallback(() => {
    scrollingRef.current = true
    clearTimer()
  }, [clearTimer])

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onClick: onClickHandler,
    onContextMenu,
    onScrollCapture,
  }
}
