import { useStore } from '../store'

export function Snackbar() {
  const snackbar = useStore((s) => s.snackbar)
  if (!snackbar) return null

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 flex justify-center pointer-events-none">
      <div className="snackbar-enter bg-text text-white text-[13px] px-4 py-2.5 rounded-lg max-w-sm text-center">
        {snackbar.message}
      </div>
    </div>
  )
}
