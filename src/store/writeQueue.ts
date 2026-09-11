import type { WriteAction } from '../types'
import {
  coalesceEnqueue,
  mutationKey,
  type QueuedMutation,
} from '../lib/mutations'

const QUEUE_KEY = 'shrine-write-queue'
const CLIENT_ID_KEY = 'shrine-client-id'
const SEQ_KEY = 'shrine-seq'

let inflightKey: string | null = null

function storageGet(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function storageSet(key: string, value: string): void {
  localStorage.setItem(key, value)
}

export function getClientId(): string {
  let id = storageGet(CLIENT_ID_KEY)
  if (!id) {
    id = crypto.randomUUID()
    storageSet(CLIENT_ID_KEY, id)
  }
  return id
}

export function nextSeq(): number {
  const n = Number(storageGet(SEQ_KEY) || '0') + 1
  storageSet(SEQ_KEY, String(n))
  return n
}

function isQueuedMutation(item: unknown): item is QueuedMutation {
  return (
    !!item &&
    typeof item === 'object' &&
    'payload' in item &&
    typeof (item as QueuedMutation).seq === 'number'
  )
}

function normalizeItem(item: unknown, index: number): QueuedMutation | null {
  if (isQueuedMutation(item)) {
    return {
      clientId: item.clientId || getClientId(),
      seq: item.seq,
      attempts: item.attempts ?? 0,
      payload: item.payload,
      ackMessage: item.ackMessage,
    }
  }
  if (item && typeof item === 'object' && 'action' in item) {
    return {
      clientId: getClientId(),
      seq: index + 1,
      attempts: 0,
      payload: item as WriteAction,
    }
  }
  return null
}

export function loadQueue(): QueuedMutation[] {
  try {
    const raw = storageGet(QUEUE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.map(normalizeItem).filter((m): m is QueuedMutation => m !== null)
  } catch {
    return []
  }
}

export function saveQueue(queue: QueuedMutation[]): void {
  storageSet(QUEUE_KEY, JSON.stringify(queue))
}

export function beginInflight(key: string): void {
  inflightKey = key
}

export function endInflight(): void {
  inflightKey = null
}

export function enqueueAction(action: WriteAction, ackMessage?: string): QueuedMutation[] {
  const next: QueuedMutation = {
    clientId: getClientId(),
    seq: nextSeq(),
    attempts: 0,
    payload: action,
    ackMessage,
  }
  const queue = coalesceEnqueue(loadQueue(), next, inflightKey ?? undefined)
  saveQueue(queue)
  return queue
}

export function removeSeq(seq: number): QueuedMutation[] {
  const queue = loadQueue().filter((m) => m.seq !== seq)
  saveQueue(queue)
  return queue
}

export function recordAttempt(seq: number): QueuedMutation | undefined {
  const queue = loadQueue()
  const idx = queue.findIndex((m) => m.seq === seq)
  if (idx === -1) return undefined
  queue[idx] = { ...queue[idx], attempts: queue[idx].attempts + 1 }
  saveQueue(queue)
  return queue[idx]
}

export function resetQueueAttempts(): QueuedMutation[] {
  const queue = loadQueue().map((m) => ({ ...m, attempts: 0 }))
  saveQueue(queue)
  return queue
}

export function clearQueue(): void {
  try {
    localStorage.removeItem(QUEUE_KEY)
  } catch {
    /* ignore */
  }
}

export function inflightMutationKey(action: WriteAction): string {
  return mutationKey(action)
}
