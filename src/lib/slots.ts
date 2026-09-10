import { addDays, differenceInCalendarDays, format, isBefore, startOfDay } from 'date-fns'

/** Slot index 0 begins 12 September 2026 */
export const ANCHOR = new Date(2026, 8, 12)

export function slotStart(index: number): Date {
  return addDays(ANCHOR, index * 3)
}

export function slotEnd(index: number): Date {
  return addDays(slotStart(index), 2)
}

export function batchOf(index: number): number {
  return Math.floor(index / 4)
}

export function batchSlots(batch: number): number[] {
  const start = batch * 4
  return [start, start + 1, start + 2, start + 3]
}

export function batchStartDate(batch: number): Date {
  return slotStart(batch * 4)
}

export function batchEndDate(batch: number): Date {
  return slotEnd(batch * 4 + 3)
}

export function slotIndexFromStart(start: Date): number {
  const days = differenceInCalendarDays(startOfDay(start), startOfDay(ANCHOR))
  return Math.round(days / 3)
}

export function today(): Date {
  return startOfDay(new Date())
}

export function isPastSlot(index: number): boolean {
  return isBefore(slotEnd(index), today())
}

export function isTodayInSlot(index: number): boolean {
  const t = today()
  const start = startOfDay(slotStart(index))
  const end = startOfDay(slotEnd(index))
  return !isBefore(t, start) && !isBefore(end, t)
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function fmtDay(d: Date): string {
  return String(d.getDate())
}

function fmtMonth(d: Date): string {
  return MONTHS[d.getMonth()]
}

/** UI display: "12–14 Sep" or "30 Sep – 2 Oct" */
export function formatSlotRange(index: number): string {
  const start = slotStart(index)
  const end = slotEnd(index)
  if (start.getMonth() === end.getMonth()) {
    return `${fmtDay(start)}–${fmtDay(end)} ${fmtMonth(end)}`
  }
  return `${fmtDay(start)} ${fmtMonth(start)} – ${fmtDay(end)} ${fmtMonth(end)}`
}

/** Template display: "Sep 12 - 14" or "Sep 30 - Oct 2" */
export function formatSlotRangeTemplate(index: number): string {
  const start = slotStart(index)
  const end = slotEnd(index)
  if (start.getMonth() === end.getMonth()) {
    return `${fmtMonth(start)} ${fmtDay(start)} - ${fmtDay(end)}`
  }
  return `${fmtMonth(start)} ${fmtDay(start)} - ${fmtMonth(end)} ${fmtDay(end)}`
}

/** Batch header: "12–23 Sep" */
export function formatBatchRange(batch: number): string {
  const start = batchStartDate(batch)
  const end = batchEndDate(batch)
  if (start.getMonth() === end.getMonth()) {
    return `${fmtDay(start)}–${fmtDay(end)} ${fmtMonth(end)}`
  }
  return `${fmtDay(start)} ${fmtMonth(start)} – ${fmtDay(end)} ${fmtMonth(end)}`
}

export function formatMonthYear(d: Date): string {
  return format(d, 'MMMM yyyy')
}

export function scheduleBatchRange(): { min: number; max: number } {
  const t = today()
  const monthsAhead = addDays(t, 365)
  const minBatch = -1
  const daysFromAnchor = differenceInCalendarDays(monthsAhead, ANCHOR)
  const maxIndex = Math.ceil(daysFromAnchor / 3)
  const maxBatch = Math.floor(maxIndex / 4)
  return { min: minBatch, max: maxBatch }
}

export function bookableSlotIndices(): number[] {
  const t = today()
  const end = addDays(t, 365)
  const indices: number[] = []
  let i = slotIndexFromStart(t)
  while (slotStart(i) <= end) {
    if (!isBefore(slotEnd(i), t)) {
      indices.push(i)
    }
    i++
  }
  return indices
}
