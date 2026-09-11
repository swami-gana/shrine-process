import type { AppState, WriteAction } from '../types'
import { recomputeAllLastDone } from './derived'
import { emptySlot, isPastSlot } from './slots'

export function applyWrite(state: AppState, action: WriteAction): AppState {
  const slots = [...state.slots]
  const people = [...state.people]

  switch (action.action) {
    case 'setAck': {
      let idx = slots.findIndex((s) => s.index === action.slot)
      if (idx === -1) {
        slots.push(emptySlot(action.slot))
        idx = slots.length - 1
      }
      const slot = { ...slots[idx] }
      const now = action.value ? new Date().toISOString() : null
      slot[action.field] = now
      slots[idx] = slot
      break
    }
    case 'assign': {
      let idx = slots.findIndex((s) => s.index === action.slot)
      if (idx === -1) {
        slots.push(emptySlot(action.slot))
        idx = slots.length - 1
      }
      slots[idx] = {
        ...slots[idx],
        personId: action.personId,
        confirmedAt: null,
        kitAckAt: null,
        doneAt: null,
      }
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
            slots[i] = { ...s, personId: null, confirmedAt: null, kitAckAt: null, doneAt: null }
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
      slots[idx] = {
        ...slots[idx],
        personId: action.personId,
        confirmedAt: null,
        kitAckAt: null,
        doneAt: null,
      }
      break
    }
  }

  return { ...state, people: recomputeAllLastDone(people, slots), slots }
}

export function applyQueuedWrites(state: AppState, queue: WriteAction[]): AppState {
  return queue.reduce((next, action) => applyWrite(next, action), state)
}

export function countFutureSlotsCleared(slots: AppState['slots'], personId: string): number {
  return slots.filter((s) => s.personId === personId && !isPastSlot(s.index)).length
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
