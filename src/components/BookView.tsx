import { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { useStore } from '../store'
import { PersonPicker } from './PersonPicker'
import { bookableSlotIndices, formatSlotRange, formatMonthYear, slotStart } from '../lib/slots'
import { getPersonById, prevPersonId } from '../lib/derived'

export function BookView() {
  const people = useStore((s) => s.people)
  const slots = useStore((s) => s.slots)
  const bookSlot = useStore((s) => s.bookSlot)
  const showSnackbar = useStore((s) => s.showSnackbar)
  const refresh = useStore((s) => s.refresh)

  const [pickerSlot, setPickerSlot] = useState<number | null>(null)
  const [pending, setPending] = useState(false)
  const [confirmation, setConfirmation] = useState<string | null>(null)

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 30000)
    return () => clearInterval(interval)
  }, [refresh])

  const bookable = useMemo(() => bookableSlotIndices(), [slots])

  const openSlots = bookable.filter((i) => !slots.find((s) => s.index === i)?.personId)

  const byMonth = useMemo(() => {
    const map = new Map<string, number[]>()
    for (const i of bookable) {
      const start = slotStart(i)
      const key = formatMonthYear(start)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(i)
    }
    return map
  }, [bookable])

  const handleBook = async (personId: string) => {
    if (pickerSlot === null) return
    setPending(true)
    const result = await bookSlot(pickerSlot, personId)
    setPending(false)

    if (result.ok) {
      const prev = prevPersonId(slots, pickerSlot)
      const prevName = getPersonById(people, prev)?.fullName ?? 'TBD'
      setConfirmation(`Booked. ${formatSlotRange(pickerSlot)} is yours — collect the kit from ${prevName} the day before.`)
      setPickerSlot(null)
    } else {
      showSnackbar('That slot was just taken — please pick another')
      setPickerSlot(null)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 pt-4 pb-8">
      {openSlots.length === 0 && (
        <p className="text-[13px] text-secondary text-center mb-6">
          Every slot is taken. Nothing to schedule right now.
        </p>
      )}

      {confirmation && (
        <p className="text-[13px] text-active-stroke bg-kit/40 rounded-lg px-4 py-3 mb-4">{confirmation}</p>
      )}

      {Array.from(byMonth.entries()).map(([month, indices]) => (
        <section key={month} className="mb-6">
          <h2 className="text-[13px] font-[650] text-secondary mb-2">{month}</h2>
          <div className="grid grid-cols-2 gap-2">
            {indices.map((index) => {
              const slot = slots.find((s) => s.index === index)
              const taken = !!slot?.personId
              const holder = getPersonById(people, slot?.personId ?? null)

              return (
                <button
                  key={index}
                  type="button"
                  disabled={taken}
                  onClick={() => !taken && setPickerSlot(index)}
                  className={clsx(
                    'text-left p-3 rounded-lg border border-hairline pressable transition-colors duration-200',
                    taken ? 'bg-bg opacity-50' : 'bg-card active:bg-kit/30',
                  )}
                >
                  <div className="text-[13px] font-[550]">{formatSlotRange(index)}</div>
                  <div className="text-[11px] text-secondary mt-1">
                    {taken ? holder?.fullName : 'Tap to schedule yourself'}
                  </div>
                </button>
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
