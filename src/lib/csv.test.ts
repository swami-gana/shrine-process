import { describe, expect, it } from 'vitest'
import peopleCsv from '../data/people.csv?raw'
import slotsCsv from '../data/slots.csv?raw'
import { NEVER_DONE_KEYS } from '../data/neverDone'
import {
  applyScheduleSeedOverrides,
  parseRosterCsv,
  parseSlotAssignmentsCsv,
} from './csv'

describe('roster seed', () => {
  const roster = parseRosterCsv(peopleCsv)

  it('parses every non-blank CSV row as a person', () => {
    expect(roster.people.length).toBe(227)
  })

  it('reports no unmatched neverDone names', () => {
    expect(roster.unmatchedNeverDone).toEqual([])
  })

  it('sets neverDone only for exact title+name matches', () => {
    const flagged = roster.people.filter((p) => p.neverDone)
    expect(flagged).toHaveLength(NEVER_DONE_KEYS.size)
    expect(flagged.some((p) => p.fullName === 'Swami Yastir')).toBe(true)
    expect(flagged.some((p) => p.fullName === 'Swami Nabha')).toBe(true)
  })

  it('seeds slot 0 as Yastir and slot -1 as Mukula', () => {
    const assignments = applyScheduleSeedOverrides(
      parseSlotAssignmentsCsv(slotsCsv, roster.people),
      roster.people,
    )
    const yastir = roster.people.find((p) => p.fullName === 'Swami Yastir')
    const mukula = roster.people.find((p) => p.fullName === 'Swami Mukula')
    const nabha = roster.people.find((p) => p.fullName === 'Swami Nabha')
    expect(assignments.get(0)).toBe(yastir?.id)
    expect(assignments.get(-1)).toBe(mukula?.id)
    expect(assignments.get(0)).not.toBe(nabha?.id)
    expect(assignments.get(1)).toBe(roster.people.find((p) => p.fullName === 'Swami Phaalguna')?.id)
    expect(assignments.get(2)).toBe(roster.people.find((p) => p.fullName === 'Swami Nandikesha')?.id)
  })
})
