import { useStore } from '../store'

export function Snackbar() {
  const snackbar = useStore((s) => s.snackbar)
  const dismissSnackbar = useStore((s) => s.dismissSnackbar)
  if (!snackbar) return null

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 flex justify-center pointer-events-none">
      <div
        key={snackbar.id}
        className="snackbar-enter bg-text-1 text-bg text-[13px] px-4 py-2.5 rounded-[11px] max-w-sm flex items-center gap-4"
      >
        <span className="flex-1 min-w-0 text-center">{snackbar.message}</span>
        {snackbar.action && (
          <button
            type="button"
            onClick={() => {
              const action = snackbar.action
              dismissSnackbar()
              action?.onAction()
            }}
            className="pointer-events-auto shrink-0 font-semibold text-ember-dim -my-2.5 -mr-2 px-2 min-h-11"
          >
            {snackbar.action.label}
          </button>
        )}
      </div>
    </div>
  )
}
