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
  neverDone: boolean
}

export type Slot = {
  index: number
  personId: string | null
  confirmedAt: string | null
  kitAckAt: string | null
  doneAt: string | null
  note?: string | null
  noteUpdatedAt?: string | null
}

export type RequestStatus = 'open' | 'confirmed' | 'cancelled' | 'released' | 'expired'

export type SlotRequest = {
  id: string
  personId: string
  slotIndex: number
  status: RequestStatus
  createdAt: string
  closedAt: string | null
}

export type Template = {
  id: string
  label: string
  scope: 'batch' | 'person' | 'empty_slot'
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
  requests: SlotRequest[]
  version: number
}

export type SlotSnapshot = {
  personId: string | null
  confirmedAt: string | null
  kitAckAt: string | null
  doneAt: string | null
  note: string | null
  noteUpdatedAt: string | null
}

export type WriteAction =
  | { action: 'setAck'; slot: number; field: AckField; value: boolean }
  | { action: 'assign'; slot: number; personId: string }
  | { action: 'setAvailability'; personId: string; available: boolean }
  | { action: 'setBackup'; personId: string; backup: boolean }
  | { action: 'book'; slot: number; personId: string }
  | { action: 'unbook'; slot: number; personId: string }
  | { action: 'removePerson'; slot: number }
  | { action: 'restoreSlot'; slot: number; snapshot: SlotSnapshot }
  | { action: 'setNote'; slot: number; note: string | null }
  | { action: 'createRequest'; requestId: string; personId: string; slot: number; createdAt: string }
  | { action: 'confirmRequest'; requestId: string }
  | { action: 'cancelRequest'; requestId: string }
  | { action: 'reopenRequest'; requestId: string }

export type WriteFailure = {
  at: string
  action: WriteAction
  reachedServer: boolean
  status?: number
  body?: string
  error?: string
}
