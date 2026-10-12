import { useEffect, useState } from 'react'

/** Visible viewport height while a sheet is open, so it sits above the keyboard (CR-21 to CR-23). */
export function useViewportHeight(open: boolean): number | null {
  const [height, setHeight] = useState<number | null>(null)
  useEffect(() => {
    if (!open) return
    const vv = window.visualViewport
    if (!vv) return
    const sync = () => setHeight(vv.height)
    sync()
    vv.addEventListener('resize', sync)
    return () => vv.removeEventListener('resize', sync)
  }, [open])
  return height
}
