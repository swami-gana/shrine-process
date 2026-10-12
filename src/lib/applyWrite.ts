import type { AppState, Slot, SlotSnapshot, WriteAction } from '../types'
import { NOTE_MAX_LENGTH } from '../config'
import { recomputeAllLastDone } from './derived'
import { openRequestFor, resolveOnFill } from './requests'
import { emptySlot, isPastSlot } from './slots'

const CLEARED = {
  personId: null,
  confirmedAt: null,
  kitAckAt: null,
  doneAt: null,
  note: null,
  noteUpdatedAt: null,
}

function slotIdx(slots: Slot[], index: number): number {
  const idx = slots.findIndex((s) => s.index === index)
  if (idx !== -1) return idx
  slots.push(emptySlot(index))
  return slots.length - 1
}

export function normalizeNote(note: string | null | undefined): string | null {
  const trimmed = (note ?? '').trim().slice(0, NOTE_MAX_LENGTH)
  return trimmed ? trimmed : null
}

export function slotSnapshot(slot: Slot): SlotSnapshot {
  return {
    personId: slot.personId,
    confirmedAt: slot.confirmedAt,
    kitAckAt: slot.kitAckAt,
    doneAt: slot.doneAt,
    note: slot.note ?? null,
    noteUpdatedAt: slot.noteUpdatedAt ?? null,
  }
}

export function applyWrite(state: AppState, action: WriteAction): AppState {
  const slots = [...state.slots]
  const people = [...state.people]
  let requests = state.requests ?? []
  const now = new Date().toISOString()

  switch (action.action) {
    case 'setAck': {
      const idx = slotIdx(slots, action.slot)
      slots[idx] = { ...slots[idx], [action.field]: action.value ? now : null }
      break
    }
    case 'assign': {
      const idx = slotIdx(slots, action.slot)
      slots[idx] = { ...slots[idx], ...CLEARED, personId: action.personId }
      requests = resolveOnFill(requests, action.slot, action.personId, now, false)
      break
    }
    case 'setAvailability': {
      const pIdx = people.findIndex((p) => p.id === action.personId)
      if (pIdx === -1) break
      people[pIdx] = { ...people[pIdx], available: action.available }
      if (!action.available) {
        for (let i = 0; i < slots.length; i++) {
          const s = slots[i]
          if (s.personId === action.personId && !isPastSlot(s.index)) {
            slots[i] = { ...s, ...CLEARED }
          }
        }
      }
      break
    }
    case 'setBackup': {
      const pIdx = people.findIndex((p) => p.id === action.personId)
      if (pIdx === -1) break
      people[pIdx] = { ...people[pIdx], backup: action.backup }
      break
    }
    case 'book': {
      const idx = slots.findIndex((s) => s.index === action.slot)
      if (idx === -1) break
      if (slots[idx].personId) break
      slots[idx] = { ...slots[idx], ...CLEARED, personId: action.personId }
      requests = resolveOnFill(requests, action.slot, action.personId, now, true)
      break
    }
    case 'unbook': {
      const idx = slots.findIndex((s) => s.index === action.slot)
      if (idx === -1) break
      const s = slots[idx]
      if (s.personId !== action.personId || s.confirmedAt || s.kitAckAt || s.doneAt) break
      slots[idx] = { ...s, ...CLEARED }
      break
    }
    case 'removePerson': {
      const idx = slots.findIndex((s) => s.index === action.slot)
      if (idx === -1) break
      slots[idx] = { ...slots[idx], ...CLEARED }
      break
    }
    case 'restoreSlot': {
      const idx = slotIdx(slots, action.slot)
      slots[idx] = { ...slots[idx], ...action.snapshot }
      if (action.snapshot.personId) {
        requests = resolveOnFill(requests, action.slot, action.snapshot.personId, now, false)
      }
      break
    }
    case 'setNote': {
      const idx = slotIdx(slots, action.slot)
      const note = normalizeNote(action.note)
      slots[idx] = { ...slots[idx], note, noteUpdatedAt: note ? now : null }
      break
    }
    case 'createRequest': {
      if (requests.some((r) => r.id === action.requestId)) break
      if (openRequestFor(requests, action.personId)) break
      requests = [
        ...requests,
        {
          id: action.requestId,
          personId: action.personId,
          slotIndex: action.slot,
          status: 'open',
          createdAt: action.createdAt,
          closedAt: null,
        },
      ]
      break
    }
    case 'confirmRequest': {
      const req = requests.find((r) => r.id === action.requestId)
      if (!req || req.status !== 'open') break
      const idx = slotIdx(slots, req.slotIndex)
      const held = slots[idx].personId
      if (held && held !== req.personId) break
      slots[idx] = { ...slots[idx], ...CLEARED, personId: req.personId, confirmedAt: now }
      requests = resolveOnFill(requests, req.slotIndex, req.personId, now, false)
      break
    }
    case 'cancelRequest': {
      requests = requests.map((r) =>
        r.id === action.requestId && r.status === 'open' ? { ...r, status: 'cancelled', closedAt: now } : r,
      )
      break
    }
    case 'reopenRequest': {
      const req = requests.find((r) => r.id === action.requestId)
      if (!req || req.status !== 'cancelled') break
      if (openRequestFor(requests, req.personId)) break
      requests = requests.map((r) => (r.id === action.requestId ? { ...r, status: 'open', closedAt: null } : r))
      break
    }
  }

  return { ...state, people: recomputeAllLastDone(people, slots), slots, requests }
}

export function applyQueuedWrites(state: AppState, queue: WriteAction[]): AppState {
  return queue.reduce((next, action) => applyWrite(next, action), state)
}

export function futureSlotsHeld(slots: AppState['slots'], personId: string): AppState['slots'] {
  return slots.filter((s) => s.personId === personId && !isPastSlot(s.index))
}

export function countFutureSlotsCleared(slots: AppState['slots'], personId: string): number {
  return futureSlotsHeld(slots, personId).length
}

export function mergeNeverDone(remote: AppState['people'], local: AppState['people']): AppState['people'] {
  const localById = new Map(local.map((p) => [p.id, p]))
  return remote.map((p) => {
    const incoming = (p as { neverDone?: boolean }).neverDone
    return {
      ...p,
      neverDone: typeof incoming === 'boolean' ? incoming : (localById.get(p.id)?.neverDone ?? false),
    }
  })
}
