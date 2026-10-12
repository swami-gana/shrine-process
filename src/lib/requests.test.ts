import { describe, expect, it } from 'vitest'
import type { AppState, Person, Slot, SlotRequest } from '../types'
import { applyWrite } from './applyWrite'
import { coalesceEnqueue, mutationKey } from './mutations'
import { expireRequests, openRequestsForSlot, requestCount } from './requests'
import { emptySlot, slotIndexFromStart, today } from './slots'

function person(id: string, fullName: string): Person {
  const [title, name] = fullName.split(' ') as ['Swami' | 'Maa', string]
  return {
    id, title, name, fullName, available: true, backup: false, email: null, phone: null,
    whatsapp: null, language: null, lastDone: null, neverDone: false,
  }
}

const FUTURE = slotIndexFromStart(today()) + 10
const LATER = FUTURE + 2

function req(id: string, personId: string, status: SlotRequest['status'], createdAt: string, slotIndex = FUTURE): SlotRequest {
  return { id, personId, slotIndex, status, createdAt, closedAt: null }
}

function state(slots: Slot[] = [emptySlot(FUTURE), emptySlot(LATER)], requests: SlotRequest[] = []): AppState {
  return {
    people: [person('1', 'Swami Yastir'), person('2', 'Maa Gnana'), person('3', 'Swami Phaalguna')],
    slots,
    templates: [],
    requests,
    version: 2,
  }
}

const slotOf = (s: AppState, i: number) => s.slots.find((x) => x.index === i)!

describe('requestCount (CR-170)', () => {
  it('counts open, cancelled and expired since the last confirmation, never released', () => {
    const rs = [
      req('a', '1', 'cancelled', '2026-01-01'),
      req('b', '1', 'confirmed', '2026-02-01'),
      req('c', '1', 'expired', '2026-03-01'),
      req('d', '1', 'released', '2026-04-01'),
      req('e', '1', 'cancelled', '2026-05-01'),
      req('f', '1', 'open', '2026-06-01'),
    ]
    expect(requestCount(rs, '1')).toBe(3)
  })

  it('a confirmation resets the count to zero', () => {
    expect(requestCount([req('a', '1', 'cancelled', '1'), req('b', '1', 'confirmed', '2')], '1')).toBe(0)
  })
})

describe('request writes', () => {
  it('creates one open request per person (CR-169)', () => {
    let s = applyWrite(state(), { action: 'createRequest', requestId: 'r1', personId: '1', slot: FUTURE, createdAt: '1' })
    s = applyWrite(s, { action: 'createRequest', requestId: 'r2', personId: '1', slot: LATER, createdAt: '2' })
    expect(s.requests.map((r) => r.id)).toEqual(['r1'])
  })

  it('mark confirmed assigns, ticks confirmed and releases the others (CR-180)', () => {
    const s = applyWrite(state(undefined, [req('r1', '1', 'open', '1'), req('r2', '2', 'open', '2')]), {
      action: 'confirmRequest',
      requestId: 'r1',
    })
    expect(slotOf(s, FUTURE).personId).toBe('1')
    expect(slotOf(s, FUTURE).confirmedAt).not.toBeNull()
    expect(s.requests.map((r) => r.status)).toEqual(['confirmed', 'released'])
  })

  it('mark confirmed never overwrites a filled slot (CR-182)', () => {
    const filled = [{ ...emptySlot(FUTURE), personId: '3' }]
    const s = applyWrite(state(filled, [req('r1', '1', 'open', '1')]), { action: 'confirmRequest', requestId: 'r1' })
    expect(slotOf(s, FUTURE).personId).toBe('3')
    expect(s.requests[0].status).toBe('open')
  })

  it('assigning the slot to someone else releases requests for it (CR-185, test 7a)', () => {
    const s = applyWrite(state(undefined, [req('r1', '1', 'open', '1')]), { action: 'assign', slot: FUTURE, personId: '3' })
    expect(s.requests[0].status).toBe('released')
    expect(requestCount(s.requests, '1')).toBe(0)
  })

  it('a self-booking on other dates confirms the booker’s request (CR-185a, test 7b)', () => {
    const s = applyWrite(state(undefined, [req('r1', '1', 'open', '1'), req('r2', '2', 'open', '2')]), {
      action: 'book',
      slot: LATER,
      personId: '1',
    })
    expect(s.requests.map((r) => r.status)).toEqual(['confirmed', 'open'])
    expect(slotOf(s, FUTURE).personId).toBeNull()
  })

  it('a coordinator assignment to other dates leaves the request open (test 7c)', () => {
    const s = applyWrite(state(undefined, [req('r1', '1', 'open', '1')]), { action: 'assign', slot: LATER, personId: '1' })
    expect(s.requests[0].status).toBe('open')
  })

  it('cancel then reopen restores the request and keeps the count (CR-184)', () => {
    let s = applyWrite(state(undefined, [req('r1', '1', 'open', '1')]), { action: 'cancelRequest', requestId: 'r1' })
    expect(s.requests[0].status).toBe('cancelled')
    expect(requestCount(s.requests, '1')).toBe(1)
    s = applyWrite(s, { action: 'reopenRequest', requestId: 'r1' })
    expect(s.requests[0].status).toBe('open')
    expect(requestCount(s.requests, '1')).toBe(1)
  })

  it('open requests on a started slot expire (CR-186)', () => {
    const rs = expireRequests([req('r1', '1', 'open', '1', slotIndexFromStart(today()) - 2), req('r2', '2', 'open', '2')])
    expect(rs.map((r) => r.status)).toEqual(['expired', 'open'])
  })

  it('lists a slot’s open requests oldest first (CR-192)', () => {
    const rs = [req('b', '2', 'open', '2026-02-01'), req('a', '1', 'open', '2026-01-01'), req('c', '3', 'cancelled', '0')]
    expect(openRequestsForSlot(rs, FUTURE).map((r) => r.id)).toEqual(['a', 'b'])
  })
})

describe('remove person and notes (CR04)', () => {
  const held: Slot = {
    ...emptySlot(FUTURE),
    personId: '1',
    confirmedAt: 'c',
    kitAckAt: 'k',
    note: 'call after 6',
    noteUpdatedAt: 'n',
  }

  it('remove clears the person, acknowledgements and note; restore puts them back exactly', () => {
    const removed = applyWrite(state([held]), { action: 'removePerson', slot: FUTURE })
    expect(slotOf(removed, FUTURE)).toMatchObject({ personId: null, confirmedAt: null, kitAckAt: null, note: null })
    const { index: _index, ...snapshot } = held
    const restored = applyWrite(removed, {
      action: 'restoreSlot',
      slot: FUTURE,
      snapshot: { ...snapshot, note: held.note ?? null, noteUpdatedAt: held.noteUpdatedAt ?? null },
    })
    expect(slotOf(restored, FUTURE)).toEqual(held)
  })

  it('replace person clears the note (CR-158)', () => {
    const s = applyWrite(state([held]), { action: 'assign', slot: FUTURE, personId: '2' })
    expect(slotOf(s, FUTURE).note).toBeNull()
  })

  it('saving an empty note is the same as clearing it (CR-162)', () => {
    const s = applyWrite(state([held]), { action: 'setNote', slot: FUTURE, note: '   ' })
    expect(slotOf(s, FUTURE)).toMatchObject({ note: null, noteUpdatedAt: null })
  })

  it('undo of remove replaces a still-queued remove instead of queueing behind it', () => {
    const base = { clientId: 'c', attempts: 0 }
    const remove = { ...base, seq: 1, payload: { action: 'removePerson' as const, slot: FUTURE } }
    const restore = {
      ...base,
      seq: 2,
      payload: {
        action: 'restoreSlot' as const,
        slot: FUTURE,
        snapshot: { personId: '1', confirmedAt: null, kitAckAt: null, doneAt: null, note: null, noteUpdatedAt: null },
      },
    }
    expect(mutationKey(remove.payload)).toBe(mutationKey(restore.payload))
    expect(coalesceEnqueue([remove], restore).map((m) => m.seq)).toEqual([2])
  })
})
