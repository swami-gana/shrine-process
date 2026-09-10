import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import { BatchCard } from './BatchCard'
import { PersonPicker } from './PersonPicker'
import { scheduleBatchRange, isTodayInSlot } from '../lib/slots'

export function ScheduleTab() {
  const people = useStore((s) => s.people)
  const slots = useStore((s) => s.slots)
  const loading = useStore((s) => s.loading)
  const assignPerson = useStore((s) => s.assignPerson)
  const setOpenPanel = useStore((s) => s.setOpenPanel)

  const [picker, setPicker] = useState<{ slotIndex: number; mode: 'assign' | 'replace' } | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const scrolledRef = useRef(false)

  const { min, max } = scheduleBatchRange()
  const batches = Array.from({ length: max - min + 1 }, (_, i) => min + i)

  useEffect(() => {
    if (scrolledRef.current || loading) return
    const currentBatch = batches.find((b) => {
      const indices = [b * 4, b * 4 + 1, b * 4 + 2, b * 4 + 3]
      return indices.some((i) => isTodayInSlot(i))
    })
    if (currentBatch !== undefined) {
      const el = document.getElementById(`batch-${currentBatch}`)
      if (el && scrollRef.current) {
        scrollRef.current.scrollTop = el.offsetTop - scrollRef.current.offsetTop
        scrolledRef.current = true
      }
    }
  }, [loading, batches])

  const handleConfirm = (personId: string) => {
    if (!picker) return
    assignPerson(picker.slotIndex, personId)
    setPicker(null)
    setOpenPanel(null)
  }

  if (loading) {
    return (
      <div className="px-4 pt-4 space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-card rounded-lg h-48 animate-pulse border border-hairline" />
        ))}
      </div>
    )
  }

  return (
    <>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 pt-4 pb-24">
        {batches.map((batch) => (
          <div key={batch} id={`batch-${batch}`}>
            <BatchCard
              batch={batch}
              slots={slots}
              people={people}
              onAssignSlot={(index) => setPicker({ slotIndex: index, mode: 'assign' })}
              onReplaceSlot={(index) => setPicker({ slotIndex: index, mode: 'replace' })}
            />
          </div>
        ))}
      </div>

      <PersonPicker
        open={!!picker}
        title="Choose a person"
        slotIndex={picker?.slotIndex ?? 0}
        people={people}
        showStatus
        excludeUnavailable
        onConfirm={handleConfirm}
        onCancel={() => setPicker(null)}
      />
    </>
  )
}
