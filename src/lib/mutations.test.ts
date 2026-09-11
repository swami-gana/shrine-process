import { describe, expect, it } from 'vitest'
import type { AppState, Person, Slot } from '../types'
import { applyQueuedWrites } from './applyWrite'
import {
  backoffDelayMs,
  canAutoRetry,
  coalesceEnqueue,
  mutationKey,
  shouldApplySeq,
  type QueuedMutation,
} from './mutations'
import { mergeSlotAssignments } from './mergeSlots'

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

function emptySlot(index: number, extra: Partial<Slot> = {}): Slot {
  return { index, personId: null, confirmedAt: null, kitAckAt: null, doneAt: null, ...extra }
}

function state(slots: Slot[]): AppState {
  return { people: [person], slots, templates: [], version: 2 }
}

function mut(partial: Omit<QueuedMutation, 'clientId' | 'attempts'> & { clientId?: string; attempts?: number }): QueuedMutation {
  return { clientId: 'c1', attempts: 0, ...partial }
}

describe('mutationKey', () => {
  it('keys setAck by slot and field', () => {
    expect(mutationKey({ action: 'setAck', slot: 3, field: 'confirmedAt', value: true })).toBe(
      'slot:3:confirmedAt',
    )
  })
})

describe('coalesceEnqueue', () => {
  it('replaces a second tap on the same toggle instead of appending', () => {
    const first = mut({
      seq: 1,
      payload: { action: 'setAck', slot: 0, field: 'confirmedAt', value: true },
    })
    const second = mut({
      seq: 2,
      payload: { action: 'setAck', slot: 0, field: 'confirmedAt', value: false },
    })
    const queue = coalesceEnqueue(coalesceEnqueue([], first), second)
    expect(queue).toHaveLength(1)
    expect(queue[0].payload).toEqual(second.payload)
    expect(queue[0].seq).toBe(2)
  })

  it('does not coalesce different fields', () => {
    const a = mut({ seq: 1, payload: { action: 'setAck', slot: 0, field: 'confirmedAt', value: true } })
    const b = mut({ seq: 2, payload: { action: 'setAck', slot: 0, field: 'kitAckAt', value: true } })
    expect(coalesceEnqueue(coalesceEnqueue([], a), b)).toHaveLength(2)
  })

  it('does not replace an in-flight mutation at the head', () => {
    const first = mut({ seq: 1, payload: { action: 'setAck', slot: 0, field: 'confirmedAt', value: true } })
    const second = mut({ seq: 2, payload: { action: 'setAck', slot: 0, field: 'confirmedAt', value: false } })
    const queue = coalesceEnqueue([first], second, mutationKey(first.payload))
    expect(queue).toHaveLength(2)
    expect(queue[0].seq).toBe(1)
    expect(queue[1].seq).toBe(2)
  })
})

describe('adopt server snapshot under a pending queue', () => {
  it('does not let a stale snapshot unmark a queued ack', () => {
    const remote = state([emptySlot(0, { personId: '1' })])
    const queue: QueuedMutation[] = [
      mut({ seq: 1, payload: { action: 'setAck', slot: 0, field: 'confirmedAt', value: true } }),
    ]
    const merged = applyQueuedWrites(remote, queue.map((m) => m.payload))
    expect(merged.slots[0].confirmedAt).not.toBeNull()
  })
})

describe('sequence', () => {
  it('ignores a seq older than the last applied', () => {
    expect(shouldApplySeq(5, 4)).toBe(false)
    expect(shouldApplySeq(5, 5)).toBe(false)
    expect(shouldApplySeq(5, 6)).toBe(true)
    expect(shouldApplySeq(0, 1)).toBe(true)
  })
})

describe('backoff', () => {
  it('uses 1s, 2s, 4s, 8s then caps at 30s, and stops auto-retry after 6 attempts', () => {
    expect([0, 1, 2, 3, 4, 5].map(backoffDelayMs)).toEqual([1000, 2000, 4000, 8000, 16000, 30000])
    expect(canAutoRetry(5)).toBe(true)
    expect(canAutoRetry(6)).toBe(false)
  })
})

describe('mergeSlotAssignments', () => {
  it('fills an empty slot and may correct a name when there are no acks', () => {
    const existing = [emptySlot(1, { personId: 'old' }), emptySlot(2)]
    const { slots, conflicts } = mergeSlotAssignments(existing, new Map([[1, '1'], [2, '1']]))
    expect(slots.find((s) => s.index === 1)?.personId).toBe('1')
    expect(slots.find((s) => s.index === 2)?.personId).toBe('1')
    expect(conflicts).toHaveLength(0)
  })

  it('does not overwrite a slot that already has an acknowledgement', () => {
    const existing = [emptySlot(1, { personId: 'old', confirmedAt: '2026-09-11T00:00:00.000Z' })]
    const { slots, conflicts } = mergeSlotAssignments(existing, new Map([[1, '1']]))
    expect(slots[0].personId).toBe('old')
    expect(slots[0].confirmedAt).toBe('2026-09-11T00:00:00.000Z')
    expect(conflicts).toHaveLength(1)
  })
})
