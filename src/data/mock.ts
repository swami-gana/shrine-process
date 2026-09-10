import type { AppState } from '../types'
import { DEFAULT_TEMPLATES } from '../lib/templates'
import { parsePeopleCsv, parseSlotAssignmentsCsv, buildSlotsFromAssignments } from '../lib/csv'
import { recomputeAllLastDone } from '../lib/derived'
import peopleCsv from './people.csv?raw'
import slotsCsv from './slots.csv?raw'

function generateMockState(): AppState {
  const people = parsePeopleCsv(peopleCsv)
  const assignments = parseSlotAssignmentsCsv(slotsCsv, people)
  let slots = buildSlotsFromAssignments(assignments, -4, 47)

  // Mark one past slot as missed (assigned but not done)
  const missedSlot = slots.find((s) => s.index === -2)
  if (missedSlot && missedSlot.personId) {
    missedSlot.confirmedAt = '2026-08-28T10:00:00.000Z'
    missedSlot.kitAckAt = '2026-09-05T10:00:00.000Z'
  }

  // Mark some slots with partial acks for demo
  const currentBatch = slots.filter((s) => s.index >= 0 && s.index <= 3)
  currentBatch.forEach((s, i) => {
    if (s.personId && i < 2) {
      s.confirmedAt = new Date().toISOString()
    }
  })

  // Clear assignments after batch 11 (index 47) - TBD after that per spec
  slots = slots.map((s) => {
    if (s.index > 47) return s
    return s
  })

  const peopleWithLastDone = recomputeAllLastDone(people, slots)

  return {
    people: peopleWithLastDone,
    slots,
    templates: DEFAULT_TEMPLATES,
    version: 1,
  }
}

export const mockState: AppState = generateMockState()
