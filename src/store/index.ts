import { create } from 'zustand'
import type { AckField, AppState, WriteAction, WriteFailure } from '../types'
import { mockState } from '../data/mock'
import { applyQueuedWrites, applyWrite, countFutureSlotsCleared, mergeNeverDone } from '../lib/applyWrite'
import { normalizeSlotsForSchedule } from '../lib/slots'
import { fetchState, postAction, isUsingMock } from '../api/client'
import { enqueue, loadQueue, saveQueue, dequeue } from './writeQueue'

type Snackbar = { message: string; id: number } | null

type Store = AppState & {
  loading: boolean
  offline: boolean
  queueCount: number
  bannerDismissed: boolean
  lastFailure: WriteFailure | null
  snackbar: Snackbar
  openPanelId: string | null
  sheetOpen: boolean

  init: () => Promise<void>
  refresh: () => Promise<void>
  showSnackbar: (message: string) => void
  setOpenPanel: (id: string | null) => void
  setSheetOpen: (open: boolean) => void
  dismissBanner: () => void

  toggleAck: (slotIndex: number, field: AckField) => void
  assignPerson: (slotIndex: number, personId: string) => void
  setAvailability: (personId: string, available: boolean) => void
  setBackup: (personId: string, backup: boolean) => void
  bookSlot: (slotIndex: number, personId: string) => Promise<{ ok: boolean; reason?: string }>

  processQueue: () => Promise<void>
  retryFailed: () => void
}

let snackbarId = 0

function cachePayload(state: AppState): string {
  return JSON.stringify({
    people: state.people,
    slots: state.slots,
    templates: state.templates,
    version: state.version,
  })
}

function persist(state: AppState) {
  localStorage.setItem('shrine-cache', cachePayload(state))
}

function normalizeState(state: AppState): AppState {
  return { ...state, slots: normalizeSlotsForSchedule(state.slots) }
}

function adoptRemote(remote: AppState, localPeople: AppState['people']): AppState {
  const normalized = normalizeState(remote)
  return {
    ...normalized,
    people: mergeNeverDone(normalized.people, localPeople),
  }
}

export const useStore = create<Store>((set, get) => ({
  ...normalizeState(mockState),
  loading: true,
  offline: false,
  queueCount: 0,
  bannerDismissed: false,
  lastFailure: null,
  snackbar: null,
  openPanelId: null,
  sheetOpen: false,

  init: async () => {
    const cached = localStorage.getItem('shrine-cache')
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as AppState
        if ((parsed.version ?? 0) >= 2) {
          set({
            ...normalizeState({
              ...parsed,
              people: mergeNeverDone(parsed.people, mockState.people),
            }),
            loading: false,
          })
        } else {
          set({ loading: false })
        }
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
        const adopted = adoptRemote(remote, get().people)
        const merged = applyQueuedWrites(adopted, loadQueue())
        set({ ...merged, loading: false, offline: false })
        persist(merged)
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
      const adopted = adoptRemote(remote, get().people)
      const merged = applyQueuedWrites(adopted, loadQueue())
      set({ ...merged, offline: false })
      persist(merged)
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
  setSheetOpen: (open) => set({ sheetOpen: open }),
  dismissBanner: () => set({ bannerDismissed: true }),

  toggleAck: (slotIndex, field) => {
    const state = get()
    const slot = state.slots.find((s) => s.index === slotIndex)
    if (!slot) return
    const current = slot[field]
    const value = !current

    const action: WriteAction = { action: 'setAck', slot: slotIndex, field, value }
    const next = applyWrite(state, action)
    set({ ...next })
    persist(next)

    const person = value && field === 'doneAt' && slot.personId
      ? state.people.find((p) => p.id === slot.personId)
      : null
    if (person && value && field === 'doneAt') {
      get().showSnackbar(`${person.fullName} marked done`)
    } else if (!value && field === 'doneAt') {
      get().showSnackbar('Undone')
    }

    enqueue(action)
    set({ queueCount: loadQueue().length, bannerDismissed: false })
    get().processQueue()
  },

  assignPerson: (slotIndex, personId) => {
    const action: WriteAction = { action: 'assign', slot: slotIndex, personId }
    const next = applyWrite(get(), action)
    set({ ...next })
    persist(next)
    get().showSnackbar('Slot updated')
    enqueue(action)
    set({ queueCount: loadQueue().length, bannerDismissed: false })
    get().processQueue()
  },

  setAvailability: (personId, available) => {
    const state = get()
    const cleared = !available ? countFutureSlotsCleared(state.slots, personId) : 0
    const action: WriteAction = { action: 'setAvailability', personId, available }
    const next = applyWrite(state, action)
    set({ ...next })
    persist(next)
    const person = state.people.find((p) => p.id === personId)
    if (person && !available && cleared > 0) {
      get().showSnackbar(`${person.fullName} marked not available · ${cleared} future slot${cleared > 1 ? 's' : ''} back to TBD`)
    }
    enqueue(action)
    set({ queueCount: loadQueue().length, bannerDismissed: false })
    get().processQueue()
  },

  setBackup: (personId, backup) => {
    const action: WriteAction = { action: 'setBackup', personId, backup }
    const next = applyWrite(get(), action)
    set({ ...next })
    persist(next)
    enqueue(action)
    set({ queueCount: loadQueue().length, bannerDismissed: false })
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
      persist(next)
      get().showSnackbar('Slot booked')
      return { ok: true }
    }

    const result = await postAction({ action: 'book', slot: slotIndex, personId })
    if (result.ok && result.state) {
      const adopted = adoptRemote(result.state, get().people)
      set({ ...adopted })
      persist(adopted)
      get().showSnackbar('Slot booked')
      return { ok: true }
    }
    if (result.state) {
      set({ ...adoptRemote(result.state, get().people) })
    }
    return { ok: false, reason: result.reason }
  },

  processQueue: async () => {
    if (isUsingMock()) {
      saveQueue([])
      set({ queueCount: 0, offline: false, lastFailure: null })
      return
    }

    let queue = loadQueue()
    set({ queueCount: queue.length })

    while (queue.length > 0) {
      const action = queue[0]
      const result = await postAction(action)
      if (result.ok) {
        dequeue()
        queue = loadQueue()
        if (result.state) {
          const adopted = adoptRemote(result.state, get().people)
          const merged = applyQueuedWrites(adopted, queue)
          set({ ...merged })
          persist(merged)
        }
        set({ queueCount: queue.length, lastFailure: null, offline: false })
      } else {
        set({
          offline: true,
          lastFailure: result.failure ?? null,
          queueCount: queue.length,
        })
        break
      }
    }
  },

  retryFailed: () => {
    get().processQueue()
  },
}))
