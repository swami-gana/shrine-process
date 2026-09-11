import { differenceInCalendarDays } from 'date-fns'
import type { Person, Slot, SlotCardState } from '../types'
import { isPastSlot, slotEnd, today } from './slots'

export function getSlotCardState(slot: Slot): SlotCardState {
  if (slot.personId === null) return 'tbd'
  if (slot.doneAt !== null) return 'done'
  if (isPastSlot(slot.index)) return 'missed'
  if (slot.kitAckAt !== null) return 'kit'
  if (slot.confirmedAt !== null) return 'confirmed'
  return 'assigned'
}

export const SLOT_FILL: Record<SlotCardState, string> = {
  tbd: 'bg-tbd text-tbd-fg',
  assigned: 'bg-assigned text-assigned-fg',
  confirmed: 'bg-confirmed text-confirmed-fg',
  kit: 'bg-kit text-kit-fg',
  done: 'bg-done text-done-fg',
  missed: 'bg-missed text-missed-fg',
}

export function isBatchComplete(slots: Slot[], batch: number): boolean {
  const indices = [batch * 4, batch * 4 + 1, batch * 4 + 2, batch * 4 + 3]
  return indices.every((i) => {
    const s = slots.find((sl) => sl.index === i)
    if (!s || !s.personId) return false
    return s.confirmedAt && s.kitAckAt && s.doneAt
  })
}

export function computeLastDone(personId: string, slots: Slot[]): string | null {
  let latest: Date | null = null
  for (const s of slots) {
    if (String(s.personId) === String(personId) && s.doneAt) {
      const end = slotEnd(s.index)
      if (!latest || end > latest) latest = end
    }
  }
  return latest ? latest.toISOString().slice(0, 10) : null
}

export function recomputeAllLastDone(people: Person[], slots: Slot[]): Person[] {
  return people.map((p) => ({
    ...p,
    lastDone: computeLastDone(p.id, slots),
  }))
}

export function personStatusLine(person: Person): string {
  let base: string
  if (!person.available) {
    base = 'Not available'
  } else if (person.lastDone !== null) {
    const days = differenceInCalendarDays(today(), new Date(person.lastDone + 'T12:00:00'))
    base = `Last done ${days} days ago`
  } else if (person.neverDone) {
    base = 'Yet to do'
  } else {
    base = 'Done before'
  }
  return person.backup ? `${base} (backup)` : base
}

export function prevPersonId(slots: Slot[], index: number): string | null {
  const prev = slots.find((s) => s.index === index - 1)
  return prev?.personId ?? null
}

export function nextPersonId(slots: Slot[], index: number): string | null {
  const next = slots.find((s) => s.index === index + 1)
  return next?.personId ?? null
}

export function getPersonById(people: Person[], id: string | number | null): Person | undefined {
  if (id === null || id === undefined || id === '') return undefined
  const key = String(id)
  return people.find((p) => String(p.id) === key)
}

export function bestContact(person: Person): { value: string; channel: 'email' | 'phone' | 'whatsapp' } | null {
  if (person.whatsapp) return { value: person.whatsapp, channel: 'whatsapp' }
  if (person.phone) return { value: person.phone, channel: 'phone' }
  if (person.email) return { value: person.email, channel: 'email' }
  return null
}

function nextUpGroup(person: Person): number {
  if (person.lastDone !== null) return 2
  if (person.neverDone) return 0
  return 1
}

function byFullName(a: Person, b: Person): number {
  return a.fullName.localeCompare(b.fullName)
}

export function sortNextUp(people: Person[]): Person[] {
  return [...people]
    .filter((p) => p.available)
    .sort((a, b) => {
      const ga = nextUpGroup(a)
      const gb = nextUpGroup(b)
      if (ga !== gb) return ga - gb
      if (ga === 2) {
        const daysA = differenceInCalendarDays(today(), new Date(a.lastDone! + 'T12:00:00'))
        const daysB = differenceInCalendarDays(today(), new Date(b.lastDone! + 'T12:00:00'))
        if (daysB !== daysA) return daysB - daysA
      }
      return byFullName(a, b)
    })
}

export function sortBackup(people: Person[]): Person[] {
  return sortNextUp(people.filter((p) => p.backup))
}
