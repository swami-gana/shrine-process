import { useStore } from '../store'

export function OfflineBanner() {
  const offline = useStore((s) => s.offline)
  const queueCount = useStore((s) => s.queueCount)
  const failedCount = useStore((s) => s.failedCount)
  const retryFailed = useStore((s) => s.retryFailed)

  if (failedCount > 0) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 bg-missed text-text text-[13px] px-4 py-1.5 flex items-center justify-between">
        <span>Couldn't save {failedCount} change{failedCount > 1 ? 's' : ''}</span>
        <button type="button" onClick={retryFailed} className="font-[650] underline">
          Retry
        </button>
      </div>
    )
  }

  if (offline && queueCount > 0) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 bg-confirmed text-text text-[13px] px-4 py-1.5 text-center">
        Offline — {queueCount} change{queueCount > 1 ? 's' : ''} will sync
      </div>
    )
  }

  return null
}
