import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { NOTE_MAX_LENGTH } from '../config'
import { useStore } from '../store'
import { useViewportHeight } from '../hooks/useViewportHeight'
import { formatSlotRange } from '../lib/slots'

type Props = {
  personName: string
  slotIndex: number
  note: string | null
  onSave: (note: string | null) => void
  onCancel: () => void
}

/** CR-161: bottom sheet for a slot note, kept above the keyboard. Mounted only while open. */
export function NoteSheet({ personName, slotIndex, note, onSave, onCancel }: Props) {
  const setSheetOpen = useStore((s) => s.setSheetOpen)
  const vpHeight = useViewportHeight(true)
  const [text, setText] = useState(note ?? '')
  const fieldRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setSheetOpen(true)
    requestAnimationFrame(() => {
      const el = fieldRef.current
      if (!el) return
      el.focus()
      el.setSelectionRange(el.value.length, el.value.length)
    })
    return () => setSheetOpen(false)
  }, [setSheetOpen])

  return createPortal(
    <div
      className="fixed inset-x-0 top-0 z-50 flex flex-col justify-end"
      style={{ height: vpHeight ? `${vpHeight}px` : '100dvh' }}
    >
      <div className="absolute inset-0 sheet-scrim" onClick={onCancel} />
      <div className="relative bg-surface-2 rounded-t-[20px] sheet-enter flex flex-col min-h-0 max-h-full">
        <div className="px-4 pt-4 pb-2 shrink-0">
          <h2 className="font-serif text-[28px] leading-[1.15] font-normal text-text-1">Note</h2>
          <p className="text-[13px] leading-[1.35] text-text-2 mt-1 tabular">
            {personName} · {formatSlotRange(slotIndex)}
          </p>
        </div>
        <div className="px-4 pb-3 min-h-0 flex flex-col">
          <textarea
            ref={fieldRef}
            value={text}
            maxLength={NOTE_MAX_LENGTH}
            onChange={(e) => setText(e.target.value)}
            placeholder="Status, follow-ups, anything to remember"
            rows={4}
            className="w-full min-h-[96px] px-3 py-2 rounded-[11px] border border-hairline bg-bg text-[15px] leading-[1.4] text-text-1 placeholder:text-text-3 resize-none"
          />
        </div>
        <div className="flex gap-3 px-4 py-3 border-t border-hairline shrink-0 pb-[max(12px,env(safe-area-inset-bottom))]">
          {note && (
            <button
              type="button"
              onClick={() => onSave(null)}
              className="flex-1 py-2.5 rounded-[11px] border border-hairline text-[15px] text-text-2"
            >
              Clear
            </button>
          )}
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-[11px] border border-hairline text-[15px] text-text-1"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave(text.trim() ? text.trim() : null)}
            className="flex-1 py-2.5 rounded-[11px] text-[15px] font-medium bg-ember text-bg"
          >
            Save
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
