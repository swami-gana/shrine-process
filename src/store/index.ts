import { create } from 'zustand'
import type { AckField, AppState, WriteAction, WriteFailure } from '../types'
import { UNDO_SNACKBAR_MS } from '../config'
import { mockState } from '../data/mock'
import { applyQueuedWrites, applyWrite, futureSlotsHeld, mergeNeverDone, slotSnapshot } from '../lib/applyWrite'
import { expireRequests, openRequestFor } from '../lib/requests'
import { canAutoRetry, backoffDelayMs, queuePayloads } from '../lib/mutations'
import { recomputeAllLastDone } from '../lib/derived'
import { coerceSlot, formatSlotRange, normalizeSlotsForSchedule } from '../lib/slots'
import { fetchState, postAction, isUsingMock } from '../api/client'
import {
  beginInflight,
  clearQueue,
  endInflight,
  enqueueAction,
  inflightMutationKey,
  loadQueue,
  recordAttempt,
  removeSeq,
  resetQueueAttempts,
} from './writeQueue'

type SnackbarAction = { label: string; onAction: () => void }
type Snackbar = { message: string; id: number; action?: SnackbarAction } | null

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
  showSnackbar: (message: string, action?: SnackbarAction) => void
  dismissSnackbar: () => void
  setOpenPanel: (id: string | null) => void
  setSheetOpen: (open: boolean) => void
  dismissBanner: () => void

  toggleAck: (slotIndex: number, field: AckField) => void
  assignPerson: (slotIndex: number, personId: string) => void
  setAvailability: (personId: string, available: boolean) => void
  setBackup: (personId: string, backup: boolean) => void
  bookSlot: (slotIndex: number, personId: string) => Promise<{ ok: boolean; reason?: string }>
  unbookSlot: (slotIndex: number, personId: string) => Promise<{ ok: boolean; reason?: string }>
  removePerson: (slotIndex: number) => void
  setNote: (slotIndex: number, note: string | null) => void
  createRequest: (personId: string, slotIndex: number) => void
  confirmRequest: (requestId: string) => void
  cancelRequest: (requestId: string) => void

  processQueue: () => Promise<void>
  retryFailed: () => void
}

let snackbarId = 0
let processing = false
let processAgain = false
let retryTimer: ReturnType<typeof setTimeout> | null = null

function cachePayload(state: AppState): string {
  return JSON.stringify({
    people: state.people,
    slots: state.slots,
    templates: state.templates,
    requests: state.requests,
    version: state.version,
  })
}

function persist(state: AppState) {
  localStorage.setItem('shrine-cache', cachePayload(state))
}

function normalizeState(state: AppState): AppState {
  const people = state.people.map((p) => ({ ...p, id: String(p.id) }))
  const slots = normalizeSlotsForSchedule(state.slots.map(coerceSlot))
  const requests = expireRequests(
    (state.requests ?? []).map((r) => ({
      ...r,
      id: String(r.id),
      personId: String(r.personId),
      slotIndex: Number(r.slotIndex),
      createdAt: String(r.createdAt),
      closedAt: r.closedAt ? String(r.closedAt) : null,
    })),
  )
  return {
    ...state,
    requests,
    people: recomputeAllLastDone(people, slots),
    slots,
  }
}

function adoptRemote(remote: AppState, localPeople: AppState['people']): AppState {
  const normalized = normalizeState(remote)
  return {
    ...normalized,
    people: mergeNeverDone(normalized.people, localPeople),
  }
}

function adoptWithQueue(remote: AppState, localPeople: AppState['people']): AppState {
  return applyQueuedWrites(adoptRemote(remote, localPeople), queuePayloads(loadQueue()))
}

function clearRetryTimer() {
  if (retryTimer) {
    clearTimeout(retryTimer)
    retryTimer = null
  }
}

function scheduleRetry(run: () => void, delayMs: number) {
  clearRetryTimer()
  retryTimer = setTimeout(() => {
    retryTimer = null
    run()
  }, delayMs)
}

function ackForToggle(state: AppState, slotIndex: number, field: AckField, value: boolean): string | undefined {
  const slot = state.slots.find((s) => s.index === slotIndex)
  const person = slot?.personId ? state.people.find((p) => p.id === slot.personId) : null
  if (field === 'doneAt' && value && person) return `${person.fullName} marked done`
  if (field === 'doneAt' && !value) return 'Undone'
  return undefined
}

export const useStore = create<Store>((set, get) => {
  /** Optimistic write: apply locally, persist, queue for the server (CR-14, CR-100). */
  const commit = (action: WriteAction, ackMessage?: string) => {
    const next = applyWrite(get(), action)
    set({ ...next })
    persist(next)
    clearRetryTimer()
    const queue = enqueueAction(action, ackMessage)
    set({ queueCount: queue.length, bannerDismissed: false })
    get().processQueue()
  }

  return {
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
    const queue = loadQueue()
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as AppState
        if ((parsed.version ?? 0) >= 2) {
          const fromCache = normalizeState({
            ...parsed,
            people: mergeNeverDone(parsed.people, mockState.people),
          })
          const merged = applyQueuedWrites(fromCache, queuePayloads(queue))
          set({ ...merged, loading: false, queueCount: queue.length })
        } else {
          set({ loading: false, queueCount: queue.length })
        }
      } catch {
        set({ loading: false, queueCount: queue.length })
      }
    } else {
      set({ loading: false, queueCount: queue.length })
    }

    if (!isUsingMock()) {
      const remote = await fetchState()
      if (remote) {
        const merged = adoptWithQueue(remote, get().people)
        set({ ...merged, loading: false, offline: false, queueCount: loadQueue().length })
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
      const merged = adoptWithQueue(remote, get().people)
      set({ ...merged, offline: false, queueCount: loadQueue().length })
      persist(merged)
    }
  },

  showSnackbar: (message, action) => {
    const id = ++snackbarId
    set({ snackbar: { message, id, action } })
    setTimeout(
      () => {
        const current = get().snackbar
        if (current?.id === id) set({ snackbar: null })
      },
      action ? UNDO_SNACKBAR_MS : 2100,
    )
  },

  dismissSnackbar: () => set({ snackbar: null }),

  setOpenPanel: (id) => set({ openPanelId: id }),
  setSheetOpen: (open) => set({ sheetOpen: open }),
  dismissBanner: () => set({ bannerDismissed: true }),

  toggleAck: (slotIndex, field) => {
    const state = get()
    const slot = state.slots.find((s) => s.index === slotIndex)
    if (!slot) return
    const value = !slot[field]
    const action: WriteAction = { action: 'setAck', slot: slotIndex, field, value }
    const next = applyWrite(state, action)
    set({ ...next })
    persist(next)
    clearRetryTimer()
    const queue = enqueueAction(action, ackForToggle(state, slotIndex, field, value))
    set({ queueCount: queue.length, bannerDismissed: false })
    get().processQueue()
  },

  assignPerson: (slotIndex, personId) => {
    const action: WriteAction = { action: 'assign', slot: slotIndex, personId }
    const next = applyWrite(get(), action)
    set({ ...next })
    persist(next)
    clearRetryTimer()
    const queue = enqueueAction(action, 'Slot updated')
    set({ queueCount: queue.length, bannerDismissed: false })
    get().processQueue()
  },

  setAvailability: (personId, available) => {
    const state = get()
    const cleared = !available ? futureSlotsHeld(state.slots, personId).length : 0
    const action: WriteAction = { action: 'setAvailability', personId, available }
    const next = applyWrite(state, action)
    set({ ...next })
    persist(next)
    const person = state.people.find((p) => p.id === personId)
    const ackMessage =
      person && !available && cleared > 0
        ? `${person.fullName} marked not available · ${cleared} future slot${cleared > 1 ? 's' : ''} back to TBD`
        : undefined
    clearRetryTimer()
    const queue = enqueueAction(action, ackMessage)
    set({ queueCount: queue.length, bannerDismissed: false })
    get().processQueue()
  },

  setBackup: (personId, backup) => {
    const action: WriteAction = { action: 'setBackup', personId, backup }
    const next = applyWrite(get(), action)
    set({ ...next })
    persist(next)
    clearRetryTimer()
    const queue = enqueueAction(action)
    set({ queueCount: queue.length, bannerDismissed: false })
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
      return { ok: true }
    }

    const result = await postAction({ action: 'book', slot: slotIndex, personId })
    if (result.ok && result.state) {
      const adopted = adoptWithQueue(result.state, get().people)
      set({ ...adopted, queueCount: loadQueue().length })
      persist(adopted)
      return { ok: true }
    }
    if (result.state) {
      const adopted = adoptWithQueue(result.state, get().people)
      set({ ...adopted, queueCount: loadQueue().length })
    }
    return { ok: false, reason: result.reason }
  },

  unbookSlot: async (slotIndex, personId) => {
    const action: WriteAction = { action: 'unbook', slot: slotIndex, personId }
    if (isUsingMock()) {
      const next = applyWrite(get(), action)
      set({ ...next })
      persist(next)
      return { ok: true }
    }
    const result = await postAction(action)
    if (result.state) {
      const adopted = adoptWithQueue(result.state, get().people)
      set({ ...adopted, queueCount: loadQueue().length })
      persist(adopted)
    }
    return { ok: result.ok, reason: result.reason }
  },

  removePerson: (slotIndex) => {
    const slot = get().slots.find((s) => s.index === slotIndex)
    if (!slot?.personId || slot.doneAt) return
    const snapshot = slotSnapshot(slot)
    commit({ action: 'removePerson', slot: slotIndex })
    get().showSnackbar(`Removed — ${formatSlotRange(slotIndex)} is open`, {
      label: 'Undo',
      onAction: () => commit({ action: 'restoreSlot', slot: slotIndex, snapshot }),
    })
  },

  setNote: (slotIndex, note) => {
    const cleared = !note || !note.trim()
    commit({ action: 'setNote', slot: slotIndex, note: cleared ? null : note }, cleared ? 'Note cleared' : 'Note saved')
  },

  createRequest: (personId, slotIndex) => {
    const state = get()
    const person = state.people.find((p) => p.id === personId)
    if (!person?.available || openRequestFor(state.requests, personId)) return
    commit(
      {
        action: 'createRequest',
        requestId: crypto.randomUUID(),
        personId,
        slot: slotIndex,
        createdAt: new Date().toISOString(),
      },
      `Requested for ${formatSlotRange(slotIndex)}`,
    )
  },

  confirmRequest: (requestId) => {
    const state = get()
    const req = state.requests.find((r) => r.id === requestId)
    if (!req || req.status !== 'open') return
    const slot = state.slots.find((s) => s.index === req.slotIndex)
    const range = formatSlotRange(req.slotIndex)
    if (slot?.personId && slot.personId !== req.personId) {
      const holder = state.people.find((p) => p.id === slot.personId)?.fullName ?? 'someone else'
      get().showSnackbar(`${range} is already filled by ${holder}`)
      return
    }
    const person = state.people.find((p) => p.id === req.personId)
    commit({ action: 'confirmRequest', requestId }, `Confirmed — ${person?.fullName ?? 'person'} added to ${range}`)
  },

  cancelRequest: (requestId) => {
    commit({ action: 'cancelRequest', requestId })
    get().showSnackbar('Request cancelled', {
      label: 'Undo',
      onAction: () => commit({ action: 'reopenRequest', requestId }),
    })
  },

  processQueue: async () => {
    if (processing) {
      processAgain = true
      return
    }
    processing = true
    processAgain = false

    try {
      if (isUsingMock()) {
        const queue = loadQueue()
        const last = queue[queue.length - 1]
        clearQueue()
        endInflight()
        set({ queueCount: 0, offline: false, lastFailure: null })
        if (last?.ackMessage) get().showSnackbar(last.ackMessage)
        return
      }

      while (true) {
        const queue = loadQueue()
        set({ queueCount: queue.length })
        if (queue.length === 0) {
          endInflight()
          set({ lastFailure: null, offline: false })
          break
        }

        const item = queue[0]
        if (!canAutoRetry(item.attempts)) {
          endInflight()
          break
        }

        beginInflight(inflightMutationKey(item.payload))
        const result = await postAction(item.payload, {
          clientId: item.clientId,
          seq: item.seq,
        })

        if (result.ok) {
          const remaining = removeSeq(item.seq)
          endInflight()
          if (result.state) {
            const merged = adoptWithQueue(result.state, get().people)
            set({ ...merged })
            persist(merged)
          }
          set({ queueCount: remaining.length, lastFailure: null, offline: false })
          if (remaining.length === 0 && item.ackMessage) {
            get().showSnackbar(item.ackMessage)
          }
          continue
        }

        if (item.payload.action === 'confirmRequest' && result.reason === 'filled') {
          // CR-183: the one permitted rollback — the server knows the slot is taken.
          const remaining = removeSeq(item.seq)
          endInflight()
          if (result.state) {
            const merged = adoptWithQueue(result.state, get().people)
            set({ ...merged })
            persist(merged)
          }
          set({ queueCount: remaining.length, lastFailure: null, offline: false })
          const requestId = item.payload.requestId
          const req = get().requests.find((r) => r.id === requestId)
          const range = req ? formatSlotRange(req.slotIndex) : 'That slot'
          get().showSnackbar(`${range} is already filled by ${result.holder ?? 'someone else'}`)
          continue
        }

        const updated = recordAttempt(item.seq)
        const attempts = updated?.attempts ?? item.attempts + 1
        endInflight()
        set({
          offline: true,
          lastFailure: result.failure ?? null,
          queueCount: loadQueue().length,
        })
        if (canAutoRetry(attempts)) {
          processAgain = false
          scheduleRetry(() => get().processQueue(), backoffDelayMs(attempts - 1))
        }
        break
      }
    } finally {
      processing = false
      if (processAgain) {
        processAgain = false
        get().processQueue()
      }
    }
  },

  retryFailed: () => {
    resetQueueAttempts()
    clearRetryTimer()
    get().processQueue()
  },
  }
})
