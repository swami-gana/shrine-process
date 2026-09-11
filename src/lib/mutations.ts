import type { WriteAction } from '../types'

export type QueuedMutation = {
  clientId: string
  seq: number
  attempts: number
  payload: WriteAction
  ackMessage?: string
}

export function mutationKey(action: WriteAction): string {
  switch (action.action) {
    case 'setAck':
      return `slot:${action.slot}:${action.field}`
    case 'assign':
    case 'book':
      return `slot:${action.slot}:personId`
    case 'setAvailability':
      return `person:${action.personId}:available`
    case 'setBackup':
      return `person:${action.personId}:backup`
  }
}

export function coalesceEnqueue(
  queue: QueuedMutation[],
  next: QueuedMutation,
  inflightKey?: string,
): QueuedMutation[] {
  const key = mutationKey(next.payload)
  const start = inflightKey && inflightKey === key ? 1 : 0
  const idx = queue.findIndex((m, i) => i >= start && mutationKey(m.payload) === key)
  if (idx === -1) return [...queue, next]
  const copy = queue.slice()
  copy[idx] = next
  return copy
}

export function shouldApplySeq(lastApplied: number, incoming: number): boolean {
  return incoming > lastApplied
}

export function backoffDelayMs(failedAttemptsZeroBased: number): number {
  return Math.min(1000 * 2 ** failedAttemptsZeroBased, 30000)
}

export function canAutoRetry(attempts: number): boolean {
  return attempts < 6
}

export function queuePayloads(queue: QueuedMutation[]): WriteAction[] {
  return queue.map((m) => m.payload)
}
