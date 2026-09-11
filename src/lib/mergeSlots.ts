import type { Slot } from '../types'
import { emptySlot, seedPastSlotDone } from './slots'

export type SlotConflict = {
  index: number
  existingPersonId: string
  incomingPersonId: string
}

function hasAck(slot: Slot): boolean {
  return !!(slot.confirmedAt || slot.kitAckAt || slot.doneAt)
}

export function mergeSlotAssignments(
  existing: Slot[],
  incoming: Map<number, string>,
): { slots: Slot[]; conflicts: SlotConflict[] } {
  const byIndex = new Map(existing.map((s) => [s.index, { ...s }]))
  const conflicts: SlotConflict[] = []

  for (const [index, personId] of incoming) {
    const prev = byIndex.get(index) ?? emptySlot(index)
    if (hasAck(prev) && prev.personId && prev.personId !== personId) {
      conflicts.push({
        index,
        existingPersonId: prev.personId,
        incomingPersonId: personId,
      })
      byIndex.set(index, prev)
      continue
    }
    if (hasAck(prev) && prev.personId) {
      byIndex.set(index, prev)
      continue
    }
    byIndex.set(index, seedPastSlotDone({ ...prev, personId }))
  }

  return {
    slots: [...byIndex.values()].sort((a, b) => a.index - b.index),
    conflicts,
  }
}
