import type { Person, Slot } from '../types'
import { NEVER_DONE_KEYS, neverDoneKey } from '../data/neverDone'
import { slotIndexFromStart, slotStart } from './slots'

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
      backup: false,
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

/** Parse shrine process assignments from the reserve CSV columns 7-9 */
export function parseSlotAssignmentsCsv(
  csv: string,
  people: Person[],
): Map<number, string> {
  const assignments = new Map<number, string>()
  const nameToId = new Map<string, string>()
  for (const p of people) {
    nameToId.set(p.fullName.toLowerCase(), p.id)
    nameToId.set(`${p.title} ${p.name}`.toLowerCase(), p.id)
  }

  const lines = csv.trim().split('\n')
  for (let i = 3; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i])
    const startStr = cols[6]?.trim()
    const personName = cols[8]?.trim()
    if (!startStr || !personName) continue

    const start = parseFlexibleDate(startStr)
    if (!start) continue

    const index = slotIndexFromStart(start)
    const personId = nameToId.get(personName.toLowerCase())
    if (personId) {
      assignments.set(index, personId)
    }
  }

  return assignments
}

function parseFlexibleDate(str: string): Date | null {
  const cleaned = str.replace(/\s/g, '')
  const match = cleaned.match(/^([A-Za-z]+)-(\d{1,2})$/)
  if (!match) return null

  const months: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  }
  const month = months[match[1].toLowerCase().slice(0, 3)]
  const day = parseInt(match[2], 10)
  if (month === undefined) return null

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

/** Sheet assignments at index >= 1; slot 0 = Yastir; slot -1 = Mukula. */
export function applyScheduleSeedOverrides(
  assignments: Map<number, string>,
  people: Person[],
): Map<number, string> {
  const byName = new Map(people.map((p) => [p.fullName.toLowerCase(), p.id]))
  const yastir = byName.get('swami yastir')
  const mukula = byName.get('swami mukula')
  const seeded = new Map<number, string>()
  for (const [index, personId] of assignments) {
    if (index >= 1) seeded.set(index, personId)
  }
  if (yastir) seeded.set(0, yastir)
  if (mukula) seeded.set(-1, mukula)
  return seeded
}

export function buildSlotsFromAssignments(
  assignments: Map<number, string>,
  minIndex = -4,
  maxIndex = 47,
): Slot[] {
  const slots: Slot[] = []
  for (let i = minIndex; i <= maxIndex; i++) {
    slots.push({
      index: i,
      personId: assignments.get(i) ?? null,
      confirmedAt: null,
      kitAckAt: null,
      doneAt: null,
    })
  }
  return slots
}
