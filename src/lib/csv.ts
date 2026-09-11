import type { Person, Slot } from '../types'
import { NEVER_DONE_KEYS, neverDoneKey } from '../data/neverDone'
import { isBackupSeed } from '../data/backup'
import { scheduleBatchRange, slotIndexFromStart, slotStart, seedPastSlotDone } from './slots'

function parseTitleName(full: string): { title: 'Swami' | 'Maa'; name: string; fullName: string } {
  const trimmed = full.trim()
  if (trimmed.startsWith('Swami ')) {
    return { title: 'Swami', name: trimmed.slice(6), fullName: trimmed }
  }
  if (trimmed.startsWith('Maa ')) {
    return { title: 'Maa', name: trimmed.slice(4), fullName: trimmed }
  }
  return { title: 'Swami', name: trimmed, fullName: trimmed }
}

function isInAshram(value: string): boolean {
  const v = value.trim().toLowerCase()
  return v === 'yes' || v === 'y'
}

function parseComm(comm: string, contact: string, email: string): {
  email: string | null
  phone: string | null
  whatsapp: string | null
} {
  const c = comm.trim().toUpperCase()
  const contactClean = contact.trim().replace(/[\s‭‬]/g, '')
  const emailClean = email.trim().split('&')[0].trim()

  let emailVal: string | null = null
  let phoneVal: string | null = null
  let whatsappVal: string | null = null

  if (emailClean && emailClean.includes('@')) {
    emailVal = emailClean
  }

  if (c.includes('WA') && contactClean) {
    whatsappVal = contactClean
  } else if (c.includes('SMS') && contactClean) {
    phoneVal = contactClean
  } else if (c.includes('EMAIL') && !emailVal && contactClean.includes('@')) {
    emailVal = contactClean
  } else if (contactClean && /^\d/.test(contactClean)) {
    phoneVal = contactClean
  }

  return { email: emailVal, phone: phoneVal, whatsapp: whatsappVal }
}

export type RosterParse = {
  people: Person[]
  unmatchedNeverDone: string[]
  duplicateIds: string[]
}

export function parsePeopleCsv(csv: string): Person[] {
  return parseRosterCsv(csv).people
}

export function parseRosterCsv(csv: string): RosterParse {
  const lines = csv.trim().split('\n')
  const people: Person[] = []
  const usedIds = new Set<string>()
  const duplicateIds: string[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) continue

    const cols = parseCsvLine(line)
    if (cols.length < 6) continue

    const brNo = cols[0].trim()
    const nameCol = cols[1].trim()
    const contact = cols[3]?.trim() ?? ''
    const comm = cols[4]?.trim() ?? ''
    const email = cols[5]?.trim() ?? ''
    const inAshram = cols[6]?.trim() ?? ''

    if (!nameCol || !brNo) continue

    const { title, name, fullName } = parseTitleName(nameCol)
    const contacts = parseComm(comm, contact, email)

    let id = brNo
    if (usedIds.has(id)) {
      duplicateIds.push(id)
      id = `${brNo}:${name}`
    }
    usedIds.add(id)

    people.push({
      id,
      title,
      name,
      fullName,
      available: isInAshram(inAshram),
      backup: isBackupSeed(fullName),
      email: contacts.email,
      phone: contacts.phone,
      whatsapp: contacts.whatsapp,
      language: null,
      lastDone: null,
      neverDone: NEVER_DONE_KEYS.has(neverDoneKey(title, name)),
    })
  }

  const matched = new Set(people.map((p) => neverDoneKey(p.title, p.name)))
  const unmatchedNeverDone = [...NEVER_DONE_KEYS].filter((key) => !matched.has(key))

  return { people, unmatchedNeverDone, duplicateIds }
}

function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

export function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

export type ShrineProcessColumns = {
  headerRow: number
  startCol: number
  nameCol: number
}

/** Find the Shrine Process name column and the Start Dates column to its left. */
export function findShrineProcessColumns(rows: unknown[][]): ShrineProcessColumns | null {
  const scan = Math.min(rows.length, 15)
  for (let i = 0; i < scan; i++) {
    const row = rows[i] ?? []
    for (let j = 0; j < row.length; j++) {
      if (normalizeHeader(row[j]) !== 'shrine process') continue
      let startCol = j - 2
      for (let k = j - 1; k >= 0; k--) {
        const header = normalizeHeader(row[k])
        if (header === 'start dates' || header === 'start date') {
          startCol = k
          break
        }
      }
      return { headerRow: i, startCol, nameCol: j }
    }
  }
  return null
}

function normalizePersonName(value: unknown): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

export function parseCellDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate())
  }
  if (typeof value === 'number' && value > 20000 && value < 80000) {
    const utc = Date.UTC(1899, 11, 30) + value * 86400000
    const d = new Date(utc)
    return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  }
  const str = String(value ?? '').trim()
  if (!str) return null
  const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) {
    return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]))
  }
  return parseFlexibleDate(str)
}

function parseFlexibleDate(str: string): Date | null {
  const cleaned = str.replace(/\s/g, ' ').trim()
  const months: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  }

  let month: number | undefined
  let day: number | undefined
  const mdy = cleaned.match(/^([A-Za-z]+)[-\s]+(\d{1,2})/)
  const dmy = cleaned.match(/^(\d{1,2})[-\s]+([A-Za-z]+)/)
  if (mdy) {
    month = months[mdy[1].toLowerCase().slice(0, 3)]
    day = parseInt(mdy[2], 10)
  } else if (dmy) {
    month = months[dmy[2].toLowerCase().slice(0, 3)]
    day = parseInt(dmy[1], 10)
  }
  if (month === undefined || day === undefined) return null

  for (const year of [2026, 2027]) {
    const d = new Date(year, month, day)
    const idx = slotIndexFromStart(d)
    const expected = slotStart(idx)
    if (
      expected.getFullYear() === d.getFullYear() &&
      expected.getMonth() === d.getMonth() &&
      expected.getDate() === d.getDate()
    ) {
      return d
    }
  }
  return null
}

export type SlotParse = {
  assignments: Map<number, string>
  unmatchedNames: string[]
}

export function parseSlotAssignmentsFromRows(
  rows: unknown[][],
  people: Person[],
): SlotParse {
  const assignments = new Map<number, string>()
  const unmatchedNames: string[] = []
  const nameToId = new Map<string, string>()
  for (const p of people) {
    nameToId.set(normalizePersonName(p.fullName), p.id)
    nameToId.set(normalizePersonName(`${p.title} ${p.name}`), p.id)
  }

  const cols = findShrineProcessColumns(rows)
  if (!cols || cols.startCol < 0) {
    return { assignments, unmatchedNames }
  }

  const seenUnmatched = new Set<string>()
  for (let i = cols.headerRow + 1; i < rows.length; i++) {
    const row = rows[i] ?? []
    const personName = String(row[cols.nameCol] ?? '')
      .replace(/\s+/g, ' ')
      .trim()
    if (!personName) continue

    let start = parseCellDate(row[cols.startCol])
    if (!start) {
      for (let c = 0; c < row.length; c++) {
        if (c === cols.nameCol) continue
        start = parseCellDate(row[c])
        if (start) break
      }
    }
    if (!start) continue

    const index = slotIndexFromStart(start)
    const personId = nameToId.get(normalizePersonName(personName))
    if (personId) {
      assignments.set(index, personId)
    } else if (!seenUnmatched.has(personName)) {
      seenUnmatched.add(personName)
      unmatchedNames.push(personName)
    }
  }

  return { assignments, unmatchedNames }
}

/** Parse shrine process assignments from a reserve sheet / CSV paste. */
export function parseSlotAssignmentsCsv(
  csv: string,
  people: Person[],
): Map<number, string> {
  const rows = csv.split(/\r?\n/).map(parseCsvLine)
  return parseSlotAssignmentsFromRows(rows, people).assignments
}

/** Keep every CSV date; slot 0 = Yastir; slot -1 = Mukula. */
export function applyScheduleSeedOverrides(
  assignments: Map<number, string>,
  people: Person[],
): Map<number, string> {
  const byName = new Map(people.map((p) => [p.fullName.toLowerCase(), p.id]))
  const seeded = new Map(assignments)
  const yastir = byName.get('swami yastir')
  const mukula = byName.get('swami mukula')
  if (yastir) seeded.set(0, yastir)
  if (mukula) seeded.set(-1, mukula)
  return seeded
}

export function assignmentIndexRange(assignments: Map<number, string>): { min: number; max: number } {
  const visible = scheduleBatchRange()
  let min = visible.min * 4
  let max = visible.max * 4 + 3
  for (const index of assignments.keys()) {
    min = Math.min(min, index)
    max = Math.max(max, index)
  }
  return { min, max }
}

export function buildSlotsFromAssignments(
  assignments: Map<number, string>,
  minIndex?: number,
  maxIndex?: number,
): Slot[] {
  const range = assignmentIndexRange(assignments)
  const min = minIndex ?? range.min
  const max = maxIndex ?? range.max
  const slots: Slot[] = []
  for (let i = min; i <= max; i++) {
    slots.push(
      seedPastSlotDone({
        index: i,
        personId: assignments.get(i) ?? null,
        confirmedAt: null,
        kitAckAt: null,
        doneAt: null,
      }),
    )
  }
  return slots
}
