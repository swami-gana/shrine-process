import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
import type { Person } from '../types'
import { personStatusLine } from '../lib/derived'
import { formatSlotRange } from '../lib/slots'
import { useStore } from '../store'

type Props = {
  open: boolean
  title: string
  slotIndex: number
  people: Person[]
  showStatus: boolean
  excludeUnavailable?: boolean
  onConfirm: (personId: string) => void
  onCancel: () => void
  confirmLabel?: string
  pending?: boolean
  commitOnRowTap?: boolean
}

export function PersonPicker({
  open,
  title,
  slotIndex,
  people,
  showStatus,
  excludeUnavailable = false,
  onConfirm,
  onCancel,
  confirmLabel = 'Confirm',
  pending = false,
  commitOnRowTap = false,
}: Props) {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [vpHeight, setVpHeight] = useState<number | null>(null)
  const setSheetOpen = useStore((s) => s.setSheetOpen)
  const searchRef = useRef<HTMLInputElement>(null)

  const keyboardUp =
    typeof window !== 'undefined' && vpHeight !== null && window.innerHeight - vpHeight > 80

  useEffect(() => {
    setSheetOpen(open)
    if (open) {
      setSearch('')
      setSelected(null)
      requestAnimationFrame(() => searchRef.current?.focus())
    }
    return () => setSheetOpen(false)
  }, [open, setSheetOpen])

  useEffect(() => {
    if (!open) return
    const vv = window.visualViewport
    if (!vv) return
    const sync = () => setVpHeight(vv.height)
    sync()
    vv.addEventListener('resize', sync)
    return () => vv.removeEventListener('resize', sync)
  }, [open])

  const filtered = useMemo(() => {
    let list = people
    if (excludeUnavailable) list = list.filter((p) => p.available)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((p) => p.fullName.toLowerCase().includes(q))
    }
    return [...list].sort((a, b) => a.fullName.localeCompare(b.fullName))
  }, [people, search, excludeUnavailable])

  if (!open) return null

  const handleClose = () => {
    setSearch('')
    setSelected(null)
    onCancel()
  }

  const pickRow = (personId: string) => {
    if (commitOnRowTap && keyboardUp) {
      onConfirm(personId)
      return
    }
    setSelected(personId)
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col">
      <div className="absolute inset-0 sheet-scrim" onClick={handleClose} />
      <div
        className="relative bg-surface-2 rounded-t-[20px] flex flex-col sheet-enter min-h-0"
        style={{ height: vpHeight ? `${vpHeight}px` : '100dvh' }}
      >
        <div className="px-4 pt-4 pb-2 border-b border-hairline shrink-0">
          <h2 className="font-serif text-[28px] leading-[1.15] font-normal text-text-1">{title}</h2>
          <p className="text-[13px] leading-[1.35] text-text-2 mt-1 tabular">{formatSlotRange(slotIndex)}</p>
          <input
            ref={searchRef}
            type="search"
            placeholder="Search name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full mt-3 px-3 py-2 rounded-[11px] border border-hairline bg-bg text-[15px] text-text-1 placeholder:text-text-3"
            autoFocus
          />
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          {filtered.length === 0 ? (
            <p className="px-4 py-3 text-[15px] text-text-2">No name matches that.</p>
          ) : (
            filtered.map((person) => (
              <button
                key={person.id}
                type="button"
                onClick={() => pickRow(person.id)}
                className={clsx(
                  'w-full text-left px-4 py-3 border-b border-hairline pressable',
                  selected === person.id ? 'bg-surface-3' : 'active:bg-surface-3',
                )}
              >
                <div className="text-[16px] leading-[1.3] font-medium text-text-1">{person.fullName}</div>
                {showStatus && (
                  <div className="text-[13px] leading-[1.35] text-text-2 mt-0.5">{personStatusLine(person)}</div>
                )}
              </button>
            ))
          )}
        </div>

        {!(commitOnRowTap && keyboardUp) && (
          <div className="flex gap-3 px-4 py-3 border-t border-hairline shrink-0 pb-[max(12px,env(safe-area-inset-bottom))]">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 py-2.5 rounded-[11px] border border-hairline text-[15px] text-text-1"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!selected || pending}
              onClick={() => selected && onConfirm(selected)}
              className="flex-1 py-2.5 rounded-[11px] text-[15px] font-medium disabled:bg-surface-3 disabled:text-text-3 bg-ember text-bg"
            >
              {pending ? '…' : confirmLabel}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
