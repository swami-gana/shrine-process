import type { AppState } from '../types'
import { DEFAULT_TEMPLATES } from '../lib/templates'
import { parseRosterCsv, parseSlotAssignmentsCsv, buildSlotsFromAssignments, applyScheduleSeedOverrides } from '../lib/csv'
import { recomputeAllLastDone } from '../lib/derived'
import peopleCsv from './people.csv?raw'
import slotsCsv from './slots.csv?raw'

export const rosterParse = parseRosterCsv(peopleCsv)

function generateMockState(): AppState {
  const people = rosterParse.people
  const sheetAssignments = parseSlotAssignmentsCsv(slotsCsv, people)
  const assignments = applyScheduleSeedOverrides(sheetAssignments, people)
  const slots = buildSlotsFromAssignments(assignments, -4, 47)

  if (rosterParse.unmatchedNeverDone.length > 0) {
    console.warn('Unmatched neverDone names (not created):', rosterParse.unmatchedNeverDone)
  }
  if (rosterParse.duplicateIds.length > 0) {
    console.warn('Duplicate Br. No. in roster; suffixed ids:', rosterParse.duplicateIds)
  }

  return {
    people: recomputeAllLastDone(people, slots),
    slots,
    templates: DEFAULT_TEMPLATES,
    version: 2,
  }
}

export const mockState: AppState = generateMockState()
export const rosterCount = rosterParse.people.length
