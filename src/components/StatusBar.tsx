import { useRef, useState } from 'react'
import { useStore } from '../store'

export function StatusBar() {
  const queueCount = useStore((s) => s.queueCount)
  const lastFailure = useStore((s) => s.lastFailure)
  const bannerDismissed = useStore((s) => s.bannerDismissed)
  const retryFailed = useStore((s) => s.retryFailed)
  const dismissBanner = useStore((s) => s.dismissBanner)

  const [diag, setDiag] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const visible = queueCount > 0 && !bannerDismissed

  const onPointerDown = () => {
    timer.current = setTimeout(() => setDiag(true), 500)
  }
  const clear = () => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
  }

  return (
    <div className="banner-slot" data-open={visible}>
      <div>
        <div
          className="bg-surface-3 text-text-1 text-[13px] px-4 py-2 flex items-center gap-3"
          onPointerDown={onPointerDown}
          onPointerUp={clear}
          onPointerCancel={clear}
          onContextMenu={(e) => e.preventDefault()}
        >
          <span className="flex-1 min-w-0">
            Not saved yet — {queueCount} change{queueCount === 1 ? '' : 's'} waiting
          </span>
          <button type="button" onClick={retryFailed} className="font-semibold text-ember shrink-0">
            Retry
          </button>
          <button
            type="button"
            onClick={dismissBanner}
            className="text-text-3 shrink-0 w-8 h-8 flex items-center justify-center"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
        {diag && lastFailure && (
          <pre className="px-4 py-2 text-[11px] text-text-2 bg-bg whitespace-pre-wrap break-all max-h-40 overflow-y-auto">
            {JSON.stringify(lastFailure, null, 2)}
            <button type="button" className="block mt-2 text-ember" onClick={() => setDiag(false)}>
              Hide details
            </button>
          </pre>
        )}
      </div>
    </div>
  )
}
