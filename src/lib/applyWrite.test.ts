import { describe, expect, it } from 'vitest'
import type { AppState, Person, Slot } from '../types'
import { applyQueuedWrites, applyWrite } from './applyWrite'

const person: Person = {
  id: '1',
  title: 'Maa',
  name: 'Misra',
  fullName: 'Maa Misra',
  available: true,
  backup: false,
  email: null,
  phone: null,
  whatsapp: null,
  language: null,
  lastDone: null,
  neverDone: false,
}

function state(slots: Slot[]): AppState {
  return { people: [person], slots, templates: [], version: 1 }
}

describe('applyQueuedWrites', () => {
  it('keeps optimistic assigns when replayed onto an older remote', () => {
    const remote = state([
      { index: 0, personId: null, confirmedAt: null, kitAckAt: null, doneAt: null },
      { index: 1, personId: null, confirmedAt: null, kitAckAt: null, doneAt: null },
    ])
    const merged = applyQueuedWrites(remote, [
      { action: 'assign', slot: 0, personId: '1' },
      { action: 'assign', slot: 1, personId: '1' },
    ])
    expect(merged.slots.find((s) => s.index === 0)?.personId).toBe('1')
    expect(merged.slots.find((s) => s.index === 1)?.personId).toBe('1')
  })

  it('sets lastDone on a done ack without clearing neverDone', () => {
    const never: Person = { ...person, neverDone: true, name: 'Yastir', fullName: 'Swami Yastir', title: 'Swami' }
    const before: AppState = {
      people: [never],
      slots: [{ index: 0, personId: '1', confirmedAt: null, kitAckAt: null, doneAt: null }],
      templates: [],
      version: 1,
    }
    const after = applyWrite(before, { action: 'setAck', slot: 0, field: 'doneAt', value: true })
    expect(after.people[0].neverDone).toBe(true)
    expect(after.people[0].lastDone).not.toBeNull()
  })
})
