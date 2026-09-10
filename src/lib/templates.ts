import type { Person, Slot, Template } from '../types'
import { batchOf, formatBatchRange, formatSlotRangeTemplate, slotEnd, slotStart } from './slots'
import { getPersonById, nextPersonId, prevPersonId } from './derived'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function fmtTemplateDay(d: Date): string {
  return String(d.getDate())
}

function fmtTemplateMonth(d: Date): string {
  return MONTHS[d.getMonth()]
}

function formatRangeTemplate(start: Date, end: Date): string {
  if (start.getMonth() === end.getMonth()) {
    return `${fmtTemplateMonth(start)} ${fmtTemplateDay(start)} - ${fmtTemplateDay(end)}`
  }
  return `${fmtTemplateMonth(start)} ${fmtTemplateDay(start)} - ${fmtTemplateMonth(end)} ${fmtTemplateDay(end)}`
}

function personName(people: Person[], id: string | null): string {
  if (!id) return 'TBD'
  return getPersonById(people, id)?.fullName ?? 'TBD'
}

function buildSchedule6(people: Person[], slots: Slot[], batch: number): string {
  const firstSlot = batch * 4
  const lines: string[] = []
  for (let i = firstSlot - 1; i <= firstSlot + 4; i++) {
    const slot = slots.find((s) => s.index === i)
    const range = formatRangeTemplate(slotStart(i), slotEnd(i))
    const name = personName(people, slot?.personId ?? null)
    lines.push(`${range}: ${name}`)
  }
  return lines.join('\n')
}

export type TokenContext = {
  person?: Person
  slotIndex: number
  people: Person[]
  slots: Slot[]
}

export function resolveTokens(template: Template, ctx: TokenContext): { html: string; plain: string } {
  const { person, slotIndex, people, slots } = ctx
  const batch = batchOf(slotIndex)

  const tokens: Record<string, string> = {
    title: person?.title ?? '',
    name: person?.fullName ?? '',
    slot_dates: formatSlotRangeTemplate(slotIndex),
    batch_dates: formatBatchRange(batch),
    prev_person: personName(people, prevPersonId(slots, slotIndex)),
    next_person: personName(people, nextPersonId(slots, slotIndex)),
    schedule_6: buildSchedule6(people, slots, batch),
  }

  let html = template.body.en
  let plain = template.body.en

  for (const [key, value] of Object.entries(tokens)) {
    const re = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
    html = html.replace(re, value)
    plain = plain.replace(re, value.replace(/<[^>]+>/g, ''))
  }

  // Strip remaining HTML tags for plain from html body
  plain = html.replace(/<b>/g, '').replace(/<\/b>/g, '').replace(/<br\s*\/?>/g, '\n')

  return { html, plain }
}

export function countTbdInBatch(slots: Slot[], batch: number): number {
  const indices = [batch * 4, batch * 4 + 1, batch * 4 + 2, batch * 4 + 3]
  return indices.filter((i) => {
    const s = slots.find((sl) => sl.index === i)
    return !s?.personId
  }).length
}

export const DEFAULT_TEMPLATES: Template[] = [
  {
    id: 'heads_up',
    label: 'Copy heads-up message',
    scope: 'batch',
    channel: 'email',
    subject: { en: null, ta: null },
    body: {
      en: `Namaskaram,

This is a gentle reminder and request for confirmation for <b>your upcoming Shrine Process</b>.

Please find the schedule and guidelines below:

<b>Schedule:</b>

{{schedule_6}}

<b>Guidelines:</b>

• Ensure to complete the process before 12 PM
• Maintain silence (no need to wear tag)
• Best to walk and not use cycle or e-bike

Collect the kit from the previous person the day before. After your 3 days, pls refill and hand over to the next person.

<b>Please respond to confirm your availability on those dates</b> 🙏

If you are unavailable on those dates, please find a replacement and let me know at the earliest.

Pranam`,
      ta: '',
    },
  },
  {
    id: 'availability_check',
    label: 'Copy availability check',
    scope: 'person',
    channel: 'message',
    subject: { en: null, ta: null },
    body: {
      en: 'Namaskaram {{title}},\n\nJust confirming you are available for Shrine process from {{slot_dates}} 🙏',
      ta: '',
    },
  },
  {
    id: 'kit_reminder',
    label: 'Copy kit reminder',
    scope: 'person',
    channel: 'message',
    subject: { en: null, ta: null },
    body: {
      en: `Namaskaram {{title}} 🙏

Gentle reminder that your Shrine Process starts tomorrow. Pls confirm once you collected the kit from {{prev_person}}.
After your 3 days, pls refill and hand over to {{next_person}} 🙏`,
      ta: '',
    },
  },
]
