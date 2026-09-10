import type { WriteAction } from '../types'

const QUEUE_KEY = 'shrine-write-queue'

export function loadQueue(): WriteAction[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveQueue(queue: WriteAction[]): void {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
}

export function enqueue(action: WriteAction): WriteAction[] {
  const queue = loadQueue()
  queue.push(action)
  saveQueue(queue)
  return queue
}

export function dequeue(): WriteAction | undefined {
  const queue = loadQueue()
  const item = queue.shift()
  saveQueue(queue)
  return item
}

export function clearQueue(): void {
  localStorage.removeItem(QUEUE_KEY)
}
