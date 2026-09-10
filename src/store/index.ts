import { create } from 'zustand'
import type { AckField, AppState, Slot, WriteAction } from '../types'
import { mockState } from '../data/mock'
import { recomputeAllLastDone } from '../lib/derived'
import { isPastSlot } from '../lib/slots'
import { fetchState, postAction, isUsingMock } from '../api/client'
import { enqueue, loadQueue, saveQueue, dequeue } from './writeQueue'

type Snackbar = { message: string; id: number } | null

type Store = AppState & {
  loading: boolean
  offline: boolean
  queueCount: number
  failedCount: number
  snackbar: Snackbar
  openPanelId: string | null

  init: () => Promise<void>
  refresh: () => Promise<void>
  showSnackbar: (message: string) => void
  setOpenPanel: (id: string | null) => void

  toggleAck: (slotIndex: number, field: AckField) => void
  assignPerson: (slotIndex: number, personId: string) => void
  setAvailability: (personId: string, available: boolean) => void
  setBackup: (personId: string, backup: boolean) => void
  bookSlot: (slotIndex: number, personId: string) => Promise<{ ok: boolean; reason?: string }>

  processQueue: () => Promise<void>
  retryFailed: () => void
}

let snackbarId = 0

function applyWrite(state: AppState, action: WriteAction): AppState {
  const slots = [...state.slots]
  const people = [...state.people]

  switch (action.action) {
    case 'setAck': {
      const idx = slots.findIndex((s) => s.index === action.slot)
      if (idx === -1) break
      const slot = { ...slots[idx] }
      const now = action.value ? new Date().toISOString() : null
      slot[action.field] = now
      slots[idx] = slot
      break
    }
    case 'assign': {
      const idx = slots.findIndex((s) => s.index === action.slot)
      if (idx === -1) break
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

  const updatedPeople = recomputeAllLastDone(people, slots)
  return { ...state, people: updatedPeople, slots }
}

function countFutureSlotsCleared(slots: Slot[], personId: string): number {
  return slots.filter((s) => s.personId === personId && !isPastSlot(s.index)).length
}

export const useStore = create<Store>((set, get) => ({
  ...mockState,
  loading: true,
  offline: false,
  queueCount: 0,
  failedCount: 0,
  snackbar: null,
  openPanelId: null,

  init: async () => {
    const cached = localStorage.getItem('shrine-cache')
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as AppState
        set({ ...parsed, loading: false })
      } catch {
        set({ loading: false })
      }
    } else {
      set({ loading: false })
    }

    const queue = loadQueue()
    set({ queueCount: queue.length })

    if (!isUsingMock()) {
      const remote = await fetchState()
      if (remote) {
        set({ ...remote, loading: false, offline: false })
        localStorage.setItem('shrine-cache', JSON.stringify(remote))
      } else if (!cached) {
        set({ offline: true })
      }
    }

    get().processQueue()
  },

  refresh: async () => {
    if (isUsingMock()) return
    const remote = await fetchState()
    if (remote) {
      set({ ...remote, offline: false })
      localStorage.setItem('shrine-cache', JSON.stringify(remote))
    }
  },

  showSnackbar: (message) => {
    const id = ++snackbarId
    set({ snackbar: { message, id } })
    setTimeout(() => {
      const current = get().snackbar
      if (current?.id === id) set({ snackbar: null })
    }, 2100)
  },

  setOpenPanel: (id) => set({ openPanelId: id }),

  toggleAck: (slotIndex, field) => {
    const state = get()
    const slot = state.slots.find((s) => s.index === slotIndex)
    if (!slot) return
    const current = slot[field]
    const value = !current

    const action: WriteAction = { action: 'setAck', slot: slotIndex, field, value }
    const next = applyWrite(state, action)
    set({ ...next })
    localStorage.setItem('shrine-cache', JSON.stringify({ people: next.people, slots: next.slots, templates: next.templates, version: next.version }))

    const person = value && field === 'doneAt' && slot.personId
      ? state.people.find((p) => p.id === slot.personId)
      : null
    if (person && value && field === 'doneAt') {
      get().showSnackbar(`${person.fullName} marked done`)
    } else if (!value && field === 'doneAt') {
      get().showSnackbar('Undone')
    }

    enqueue(action)
    set({ queueCount: loadQueue().length })
    get().processQueue()
  },

  assignPerson: (slotIndex, personId) => {
    const action: WriteAction = { action: 'assign', slot: slotIndex, personId }
    const next = applyWrite(get(), action)
    set({ ...next })
    localStorage.setItem('shrine-cache', JSON.stringify({ people: next.people, slots: next.slots, templates: next.templates, version: next.version }))
    get().showSnackbar('Slot updated')
    enqueue(action)
    set({ queueCount: loadQueue().length })
    get().processQueue()
  },

  setAvailability: (personId, available) => {
    const state = get()
    const cleared = !available ? countFutureSlotsCleared(state.slots, personId) : 0
    const action: WriteAction = { action: 'setAvailability', personId, available }
    const next = applyWrite(state, action)
    set({ ...next })
    localStorage.setItem('shrine-cache', JSON.stringify({ people: next.people, slots: next.slots, templates: next.templates, version: next.version }))
    const person = state.people.find((p) => p.id === personId)
    if (person && !available && cleared > 0) {
      get().showSnackbar(`${person.fullName} marked not available · ${cleared} future slot${cleared > 1 ? 's' : ''} back to TBD`)
    }
    enqueue(action)
    set({ queueCount: loadQueue().length })
    get().processQueue()
  },

  setBackup: (personId, backup) => {
    const action: WriteAction = { action: 'setBackup', personId, backup }
    const next = applyWrite(get(), action)
    set({ ...next })
    localStorage.setItem('shrine-cache', JSON.stringify({ people: next.people, slots: next.slots, templates: next.templates, version: next.version }))
    enqueue(action)
    set({ queueCount: loadQueue().length })
    get().processQueue()
  },

  bookSlot: async (slotIndex, personId) => {
    if (isUsingMock()) {
      const state = get()
      const slot = state.slots.find((s) => s.index === slotIndex)
      if (slot?.personId) {
        return { ok: false, reason: 'taken' }
      }
      const action: WriteAction = { action: 'book', slot: slotIndex, personId }
      const next = applyWrite(state, action)
      set({ ...next })
      get().showSnackbar('Slot booked')
      return { ok: true }
    }

    const result = await postAction({ action: 'book', slot: slotIndex, personId })
    if (result.ok && result.state) {
      set({ ...result.state })
      localStorage.setItem('shrine-cache', JSON.stringify(result.state))
      get().showSnackbar('Slot booked')
      return { ok: true }
    }
    if (result.state) {
      set({ ...result.state })
    }
    return { ok: false, reason: result.reason }
  },

  processQueue: async () => {
    if (isUsingMock()) {
      saveQueue([])
      set({ queueCount: 0 })
      return
    }

    let queue = loadQueue()
    set({ queueCount: queue.length, offline: false })

    while (queue.length > 0) {
      const action = queue[0]
      const result = await postAction(action)
      if (result.ok) {
        dequeue()
        queue = loadQueue()
        if (result.state) {
          set({ ...result.state })
          localStorage.setItem('shrine-cache', JSON.stringify(result.state))
        }
        set({ queueCount: queue.length, failedCount: 0 })
      } else {
        set({ offline: true, failedCount: 1 })
        break
      }
    }
  },

  retryFailed: () => {
    set({ failedCount: 0 })
    get().processQueue()
  },
}))
