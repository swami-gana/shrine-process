import { useLayoutEffect, useRef, useState } from 'react'
import { Calendar } from 'lucide-react'
import { BadgeIcon } from '../icons/BadgeIcon'

/**
 * CR-191, CR-192: one line, as many names as fit, then "+N". Names are measured after
 * layout and dropped one at a time until the line no longer overflows.
 */
export function RequestedLine({ names }: { names: string[] }) {
  const textRef = useRef<HTMLSpanElement>(null)
  const [width, setWidth] = useState(0)
  const sig = `${names.join('\u0000')}|${width}`
  const [fit, setFit] = useState({ sig, shown: names.length })
  const shown = fit.sig === sig ? fit.shown : names.length

  useLayoutEffect(() => {
    const el = textRef.current
    if (el && el.scrollWidth > el.clientWidth && shown > 1) setFit({ sig, shown: shown - 1 })
  }, [shown, sig])

  useLayoutEffect(() => {
    const el = textRef.current?.parentElement
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => setWidth(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  if (names.length === 0) return null
  const visible = Math.min(shown, names.length)
  const rest = names.length - visible

  return (
    <div className="flex items-center gap-1.5 mt-1 text-[13px] leading-[1.35] text-text-2 min-w-0">
      <span className="shrink-0 w-3.5 h-3.5 flex items-center justify-center" aria-hidden>
        <BadgeIcon icon={Calendar} badge="arrow" className="scale-[0.5834] shrink-0" />
      </span>
      <span ref={textRef} className="min-w-0 flex-1 whitespace-nowrap overflow-hidden text-ellipsis">
        Requested: {names.slice(0, visible).join(', ')}
        {rest > 0 && ` +${rest}`}
      </span>
    </div>
  )
}
