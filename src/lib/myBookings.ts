/** CR-130: slots booked from this device, so only those can be undone here. */
const KEY = 'shrine-my-bookings'

export type MyBooking = { slot: number; personId: string }

export function loadMyBookings(): MyBooking[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || '[]') as unknown
    return Array.isArray(parsed)
      ? parsed.filter((b): b is MyBooking => typeof b?.slot === 'number' && typeof b?.personId === 'string')
      : []
  } catch {
    return []
  }
}

function save(list: MyBooking[]): MyBooking[] {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    /* ignore */
  }
  return list
}

export function addMyBooking(slot: number, personId: string): MyBooking[] {
  return save([...loadMyBookings().filter((b) => b.slot !== slot), { slot, personId }])
}

export function removeMyBooking(slot: number): MyBooking[] {
  return save(loadMyBookings().filter((b) => b.slot !== slot))
}
