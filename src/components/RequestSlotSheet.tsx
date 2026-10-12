import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Person } from '../types'
import { useStore } from '../store'
import { useViewportHeight } from '../hooks/useViewportHeight'
import { bookableSlotIndices, groupByMonth } from '../lib/slots'
import { getPersonById } from '../lib/derived'
import { hasSlotStarted, openRequestsForSlot } from '../lib/requests'
import { SlotTile } from './SlotTile'

type Props = {
  person: Person | null
  onCancel: () => void
  onConfirm: (slotIndex: number) => void
}

/** CR-176, CR-177: pick the open slot a person is being asked to take. Mount with key={person.id}. */
export function RequestSlotSheet({ person, onCancel, onConfirm }: Props) {
  const open = person !== null
  const people = useStore((s) => s.people)
  const slots = useStore((s) => s.slots)
  const requests = useStore((s) => s.requests)
  const setSheetOpen = useStore((s) => s.setSheetOpen)
  const vpHeight = useViewportHeight(open)
  const [selected, setSelected] = useState<number | null>(null)

  useEffect(() => {
    setSheetOpen(open)
    return () => setSheetOpen(false)
  }, [open, setSheetOpen])

  const byMonth = useMemo(() => groupByMonth(bookableSlotIndices().filter((i) => !hasSlotStarted(i))), [])

  if (!person) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col">
      <div className="absolute inset-0 sheet-scrim" onClick={onCancel} />
      <div
        className="relative bg-surface-2 rounded-t-[20px] flex flex-col sheet-enter min-h-0"
        style={{ height: vpHeight ? `${vpHeight}px` : '100dvh' }}
      >
        <div className="px-4 pt-4 pb-3 border-b border-hairline shrink-0">
          <h2 className="font-serif text-[28px] leading-[1.15] font-normal text-text-1">Request for a slot</h2>
          <p className="text-[13px] leading-[1.35] text-text-2 mt-1">{person.fullName}</p>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 px-4 pt-4">
          {byMonth.map(([month, indices]) => (
            <section key={month} className="mb-6">
              <h3 className="text-[13px] font-medium text-text-2 mb-2">{month}</h3>
              <div className="grid grid-cols-2 gap-2">
                {indices.map((index) => {
                  const holderId = slots.find((s) => s.index === index)?.personId ?? null
                  if (holderId) {
                    return (
                      <SlotTile
                        key={index}
                        index={index}
                        state="scheduled"
                        subtitle={getPersonById(people, holderId)?.fullName}
                      />
                    )
                  }
                  const others = openRequestsForSlot(requests, index).filter((r) => r.personId !== person.id).length
                  const isSelected = selected === index
                  return (
                    <SlotTile
                      key={index}
                      index={index}
                      state={isSelected ? 'selected' : 'open'}
                      subtitle={others > 0 ? `${others} requested` : undefined}
                      glyph={isSelected ? 'check' : 'plus'}
                      onClick={() => setSelected(isSelected ? null : index)}
                    />
                  )
                })}
              </div>
            </section>
          ))}
        </div>

        <div className="flex gap-3 px-4 py-3 border-t border-hairline shrink-0 pb-[max(12px,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-[11px] border border-hairline text-[15px] text-text-1"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={selected === null}
            onClick={() => selected !== null && onConfirm(selected)}
            className="flex-1 py-2.5 rounded-[11px] text-[15px] font-medium disabled:bg-surface-3 disabled:text-text-3 bg-ember text-bg"
          >
            Mark requested
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
