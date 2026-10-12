import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../store'
import { PersonPicker } from './PersonPicker'
import { SlotTile } from './SlotTile'
import { bookableSlotIndices, formatSlotRange, groupByMonth } from '../lib/slots'
import { getPersonById } from '../lib/derived'
import { addMyBooking, loadMyBookings, removeMyBooking } from '../lib/myBookings'

export function BookView({ poll = false }: { poll?: boolean }) {
  const people = useStore((s) => s.people)
  const slots = useStore((s) => s.slots)
  const bookSlot = useStore((s) => s.bookSlot)
  const unbookSlot = useStore((s) => s.unbookSlot)
  const showSnackbar = useStore((s) => s.showSnackbar)
  const refresh = useStore((s) => s.refresh)

  const [pickerSlot, setPickerSlot] = useState<number | null>(null)
  const [pending, setPending] = useState(false)
  const [mine, setMine] = useState(loadMyBookings)

  useEffect(() => {
    if (!poll) return
    refresh()
    const interval = setInterval(refresh, 30000)
    return () => clearInterval(interval)
  }, [poll, refresh])

  const bookable = useMemo(() => bookableSlotIndices(), [])
  const byMonth = useMemo(() => groupByMonth(bookable), [bookable])

  const openSlots = bookable.filter((i) => !slots.find((s) => s.index === i)?.personId)

  const handleBook = async (personId: string) => {
    if (pickerSlot === null) return
    const index = pickerSlot
    setPending(true)
    const result = await bookSlot(index, personId)
    setPending(false)
    setPickerSlot(null)

    if (result.ok) {
      setMine(addMyBooking(index, personId))
      showSnackbar(`Added — ${formatSlotRange(index)} is yours.`)
    } else {
      showSnackbar('That slot was just taken — please pick another')
    }
  }

  const handleUnbook = async (index: number, personId: string) => {
    const result = await unbookSlot(index, personId)
    if (result.ok) {
      setMine(removeMyBooking(index))
      showSnackbar(`Removed — ${formatSlotRange(index)} is open again.`)
    } else {
      showSnackbar('Could not remove that booking — please try again')
    }
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 pt-1 pb-8">
      <p className="text-[14px] text-text-2 mb-4">
        {openSlots.length === 0 ? 'Every slot is taken. Nothing to schedule right now.' : 'Tap an open slot to add your name.'}
      </p>

      {byMonth.map(([month, indices]) => (
        <section key={month} className="mb-6">
          <h2 className="text-[13px] font-medium text-text-2 mb-2">{month}</h2>
          <div className="grid grid-cols-2 gap-2">
            {indices.map((index) => {
              const holderId = slots.find((s) => s.index === index)?.personId ?? null
              if (!holderId) {
                return <SlotTile key={index} index={index} state="open" glyph="plus" onClick={() => setPickerSlot(index)} />
              }
              const holder = getPersonById(people, holderId)
              const undoable = mine.some((b) => b.slot === index && b.personId === holderId)
              return (
                <SlotTile
                  key={index}
                  index={index}
                  state="scheduled"
                  subtitle={holder?.fullName}
                  glyph={undoable ? 'x' : null}
                  onClick={undoable ? () => handleUnbook(index, holderId) : undefined}
                />
              )
            })}
          </div>
        </section>
      ))}

      <PersonPicker
        open={pickerSlot !== null}
        title="Find your name"
        slotIndex={pickerSlot ?? 0}
        people={people}
        showStatus={false}
        excludeUnavailable={false}
        onConfirm={handleBook}
        onCancel={() => setPickerSlot(null)}
        confirmLabel="Confirm this slot"
        pending={pending}
      />
    </div>
  )
}
