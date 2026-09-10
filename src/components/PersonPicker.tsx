import { useMemo, useState } from 'react'
import clsx from 'clsx'
import type { Person } from '../types'
import { personStatusLine } from '../lib/derived'
import { formatSlotRange } from '../lib/slots'

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
}: Props) {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string | null>(null)

  const filtered = useMemo(() => {
    let list = people
    if (excludeUnavailable) list = list.filter((p) => p.available)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((p) => p.fullName.toLowerCase().includes(q))
    }
    return list.sort((a, b) => a.fullName.localeCompare(b.fullName))
  }, [people, search, excludeUnavailable])

  if (!open) return null

  const handleClose = () => {
    setSearch('')
    setSelected(null)
    onCancel()
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      <div className="absolute inset-0 bg-black/34" onClick={handleClose} />
      <div className="relative mt-auto bg-card rounded-t-2xl flex flex-col max-h-[90vh] sheet-enter">
        <div className="px-4 pt-4 pb-2 border-b border-hairline">
          <h2 className="text-[15px] font-[650] text-text">{title}</h2>
          <p className="text-[12px] text-secondary mt-0.5">{formatSlotRange(slotIndex)}</p>
          <input
            type="search"
            placeholder="Search name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full mt-3 px-3 py-2 rounded-lg border border-hairline bg-bg text-[15px] outline-none focus:border-active-stroke"
            autoFocus
          />
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          {filtered.length === 0 ? (
            <p className="px-4 py-8 text-[13px] text-secondary text-center">
              No name matches that. Check the spelling or contact the coordinator.
            </p>
          ) : (
            filtered.map((person) => (
              <button
                key={person.id}
                type="button"
                onClick={() => setSelected(person.id)}
                className={clsx(
                  'w-full text-left px-4 py-3 border-b border-hairline pressable',
                  selected === person.id ? 'bg-kit/50' : 'active:bg-bg',
                )}
              >
                <div className="text-[15px] text-text">{person.fullName}</div>
                {showStatus && (
                  <div className="text-[13px] text-secondary mt-0.5">{personStatusLine(person)}</div>
                )}
              </button>
            ))
          )}
        </div>

        <div className="flex gap-3 px-4 py-3 border-t border-hairline pb-safe">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 py-2.5 rounded-lg border border-hairline text-[15px] text-text"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!selected || pending}
            onClick={() => selected && onConfirm(selected)}
            className="flex-1 py-2.5 rounded-lg bg-active-stroke text-white text-[15px] font-[550] disabled:opacity-40"
          >
            {pending ? '…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
