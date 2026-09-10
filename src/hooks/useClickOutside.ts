import { useEffect } from 'react'

export function useClickOutside(onClose: () => void, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return

    const handler = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('[data-panel]') || target.closest('.pressable')) return
      onClose()
    }

    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
    }
  }, [onClose, enabled])
}
