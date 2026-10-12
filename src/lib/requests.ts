import { isBefore } from 'date-fns'
import type { SlotRequest } from '../types'
import { slotStart, today } from './slots'

function byCreated(a: SlotRequest, b: SlotRequest): number {
  return a.createdAt.localeCompare(b.createdAt)
}

/** CR-169: at most one open request per person. */
export function openRequestFor(requests: SlotRequest[], personId: string): SlotRequest | undefined {
  return requests.find((r) => r.personId === personId && r.status === 'open')
}

/** Open requests for one slot, oldest first (CR-192). */
export function openRequestsForSlot(requests: SlotRequest[], slotIndex: number): SlotRequest[] {
  return requests.filter((r) => r.slotIndex === slotIndex && r.status === 'open').sort(byCreated)
}

/**
 * CR-170: requests that are open, cancelled or expired, created since the person's
 * most recent confirmed request. Released requests never count (CR-170a).
 */
export function requestCount(requests: SlotRequest[], personId: string): number {
  const mine = requests.filter((r) => r.personId === personId).sort(byCreated)
  let count = 0
  for (const r of mine) {
    if (r.status === 'confirmed') count = 0
    else if (r.status === 'open' || r.status === 'cancelled' || r.status === 'expired') count++
  }
  return count
}

export function hasSlotStarted(slotIndex: number): boolean {
  return isBefore(slotStart(slotIndex), today())
}

/** CR-186: open requests whose slot has started close as expired. */
export function expireRequests(requests: SlotRequest[], now = new Date().toISOString()): SlotRequest[] {
  let changed = false
  const next = requests.map((r) => {
    if (r.status !== 'open' || !hasSlotStarted(r.slotIndex)) return r
    changed = true
    return { ...r, status: 'expired' as const, closedAt: now }
  })
  return changed ? next : requests
}

/**
 * CR-185: when a slot gets a person, that person's open request for the slot is
 * confirmed and every other open request for it is released. CR-185a: a self-booking
 * also confirms the booker's open request for a different slot.
 */
export function resolveOnFill(
  requests: SlotRequest[],
  slotIndex: number,
  personId: string,
  now: string,
  selfBooking: boolean,
): SlotRequest[] {
  return requests.map((r) => {
    if (r.status !== 'open') return r
    if (r.slotIndex === slotIndex) {
      const status = r.personId === personId ? 'confirmed' : 'released'
      return { ...r, status, closedAt: now }
    }
    if (selfBooking && r.personId === personId) {
      return { ...r, status: 'confirmed', closedAt: now }
    }
    return r
  })
}
