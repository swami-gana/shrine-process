import { describe, expect, it } from 'vitest'
import peopleCsv from '../data/people.csv?raw'
import slotsCsv from '../data/slots.csv?raw'
import { NEVER_DONE_KEYS } from '../data/neverDone'
import { computeLastDone } from './derived'
import { isPastSlot, seedPastSlotDone, slotIndexFromStart } from './slots'
import {
  applyScheduleSeedOverrides,
  buildSlotsFromAssignments,
  findShrineProcessColumns,
  parseRosterCsv,
  parseSlotAssignmentsCsv,
  parseSlotAssignmentsFromRows,
} from './csv'

describe('roster seed', () => {
  const roster = parseRosterCsv(peopleCsv)

  it('parses every non-blank CSV row as a person', () => {
    expect(roster.people.length).toBe(227)
  })

  it('seeds Maa Mukulita as the only backup person', () => {
    const backups = roster.people.filter((p) => p.backup)
    expect(backups.map((p) => p.fullName)).toEqual(['Maa Mukulita'])
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

  it('finds Shrine Process next to Start Dates in the wide reserve CSV', () => {
    const rows = slotsCsv.split(/\r?\n/).map((line) => {
      const cols: string[] = []
      let current = ''
      let inQuotes = false
      for (const ch of line) {
        if (ch === '"') inQuotes = !inQuotes
        else if (ch === ',' && !inQuotes) {
          cols.push(current)
          current = ''
        } else current += ch
      }
      cols.push(current)
      return cols
    })
    const cols = findShrineProcessColumns(rows)
    expect(cols).not.toBeNull()
    expect(cols?.nameCol).toBe(8)
    expect(cols?.startCol).toBe(6)
  })

  it('parses a three-column Start Dates / End Dates / Shrine Process paste', () => {
    const paste = [
      'Start Dates,End Dates,Shrine Process',
      'Sep-9,Sep-11,Swami Mukula',
      'Sep-12,Sep-14,Swami Nabha',
      'Sep-15,Sep-17,Swami Phaalguna',
    ].join('\n')
    const assignments = parseSlotAssignmentsCsv(paste, roster.people)
    expect(assignments.get(-1)).toBe(roster.people.find((p) => p.fullName === 'Swami Mukula')?.id)
    expect(assignments.get(0)).toBe(roster.people.find((p) => p.fullName === 'Swami Nabha')?.id)
    expect(assignments.get(1)).toBe(roster.people.find((p) => p.fullName === 'Swami Phaalguna')?.id)
  })

  it('reads Google Date objects in the start column', () => {
    const parsed = parseSlotAssignmentsFromRows(
      [
        ['Start Dates', 'End Dates', 'Shrine Process'],
        [new Date(2026, 8, 15), new Date(2026, 8, 17), 'Swami Phaalguna'],
      ],
      roster.people,
    )
    expect(parsed.assignments.get(1)).toBe(roster.people.find((p) => p.fullName === 'Swami Phaalguna')?.id)
  })

  it('keeps past CSV dates and seeds slot 0/ -1 overrides', () => {
    const assignments = applyScheduleSeedOverrides(
      parseSlotAssignmentsCsv(slotsCsv, roster.people),
      roster.people,
    )
    const yastir = roster.people.find((p) => p.fullName === 'Swami Yastir')
    const mukula = roster.people.find((p) => p.fullName === 'Swami Mukula')
    const nabha = roster.people.find((p) => p.fullName === 'Swami Nabha')
    const ayurtatwa = roster.people.find((p) => p.fullName === 'Maa Ayurtatwa')
    expect(assignments.get(0)).toBe(yastir?.id)
    expect(assignments.get(-1)).toBe(mukula?.id)
    expect(assignments.get(0)).not.toBe(nabha?.id)
    expect(assignments.get(1)).toBe(roster.people.find((p) => p.fullName === 'Swami Phaalguna')?.id)
    expect(assignments.get(2)).toBe(roster.people.find((p) => p.fullName === 'Swami Nandikesha')?.id)
    expect(assignments.size).toBeGreaterThan(40)
    expect(assignments.get(8)).toBe(roster.people.find((p) => p.fullName === 'Maa Meghaja')?.id)
    expect(assignments.get(slotIndexFromStart(new Date(2026, 3, 15)))).toBe(ayurtatwa?.id)
  })

  it('marks past assigned slots done so status can show last done instead of yet to do', () => {
    const pastIndex = -20
    expect(isPastSlot(pastIndex)).toBe(true)
    const seeded = seedPastSlotDone({
      index: pastIndex,
      personId: '1',
      confirmedAt: null,
      kitAckAt: null,
      doneAt: null,
    })
    expect(seeded.doneAt).not.toBeNull()
    expect(computeLastDone('1', [seeded])).not.toBeNull()

    const slots = buildSlotsFromAssignments(new Map([[pastIndex, '1'], [20, '2']]))
    expect(slots.find((s) => s.index === pastIndex)?.doneAt).not.toBeNull()
    expect(slots.find((s) => s.index === 20)?.doneAt).toBeNull()
  })
})
