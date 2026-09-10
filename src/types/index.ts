export type Lang = 'en' | 'ta'

export type Person = {
  id: string
  title: 'Swami' | 'Maa'
  name: string
  fullName: string
  available: boolean
  backup: boolean
  email: string | null
  phone: string | null
  whatsapp: string | null
  language: Lang | null
  lastDone: string | null
}

export type Slot = {
  index: number
  personId: string | null
  confirmedAt: string | null
  kitAckAt: string | null
  doneAt: string | null
}

export type Template = {
  id: string
  label: string
  scope: 'batch' | 'person'
  channel: 'email' | 'message'
  subject: Record<Lang, string | null>
  body: Record<Lang, string>
}

export type AckField = 'confirmedAt' | 'kitAckAt' | 'doneAt'

export type SlotCardState =
  | 'tbd'
  | 'assigned'
  | 'confirmed'
  | 'kit'
  | 'done'
  | 'missed'

export type AppState = {
  people: Person[]
  slots: Slot[]
  templates: Template[]
  version: number
}

export type WriteAction =
  | { action: 'setAck'; slot: number; field: AckField; value: boolean }
  | { action: 'assign'; slot: number; personId: string }
  | { action: 'setAvailability'; personId: string; available: boolean }
  | { action: 'setBackup'; personId: string; backup: boolean }
  | { action: 'book'; slot: number; personId: string }
