import { useMemo, useState } from 'react'
import {
  AtSign,
  Bell,
  Calendar,
  CalendarClock,
  NotebookPen,
  Phone,
  UserRoundMinus,
  UserRoundPen,
  UserRoundPlus,
} from 'lucide-react'
import clsx from 'clsx'
import type { Person, Slot } from '../types'
import { getSlotCardState, SLOT_FILL, getPersonById, prevPersonId } from '../lib/derived'
import { formatSlotRange, isTodayInSlot } from '../lib/slots'
import { AckToggle } from './AckToggle'
import { InlinePanel, type PanelRow, type PanelSection } from './InlinePanel'
import { NoteSheet } from './NoteSheet'
import { RequestedLine } from './RequestedLine'
import { openRequestsForSlot } from '../lib/requests'
import { useStore } from '../store'
import { copyPlainText } from '../lib/clipboard'
import { resolveTokens } from '../lib/templates'
import { ExpandChevron, AppIcon } from '../icons/AppIcon'
import { BadgeIcon } from '../icons/BadgeIcon'
import { WhatsAppIcon } from '../icons/WhatsApp'

type Props = {
  slot: Slot
  people: Person[]
  panelId: string
  onSelectPerson: () => void
}

export function SlotCard({ slot, people, panelId, onSelectPerson }: Props) {
  const templates = useStore((s) => s.templates)
  const slots = useStore((s) => s.slots)
  const toggleAck = useStore((s) => s.toggleAck)
  const showSnackbar = useStore((s) => s.showSnackbar)
  const openPanelId = useStore((s) => s.openPanelId)
  const setOpenPanel = useStore((s) => s.setOpenPanel)
  const requests = useStore((s) => s.requests)
  const removePerson = useStore((s) => s.removePerson)
  const setNote = useStore((s) => s.setNote)
  const [noteOpen, setNoteOpen] = useState(false)

  const person = getPersonById(people, slot.personId)
  const state = getSlotCardState(slot)
  const isOpen = openPanelId === panelId
  const isToday = isTodayInSlot(slot.index)

  const togglePanel = () => setOpenPanel(isOpen ? null : panelId)
  const note = person ? (slot.note ?? null) : null

  const requestedNames = useMemo(() => {
    if (slot.personId) return []
    return openRequestsForSlot(requests, slot.index)
      .map((r) => getPersonById(people, r.personId)?.fullName)
      .filter((n): n is string => !!n)
  }, [requests, people, slot.index, slot.personId])

  const assignedSections = (): PanelSection[] => {
    if (!person) return []
    const availTemplate = templates.find((t) => t.id === 'availability_check')
    const kitTemplate = templates.find((t) => t.id === 'kit_reminder')
    const contactRows: PanelRow[] = []
    if (person.email) {
      contactRows.push({
        icon: <AppIcon icon={AtSign} />,
        label: 'Email',
        copy: true,
        onClick: () => {
          copyPlainText(person.email!)
          showSnackbar('Email copied')
        },
      })
    }
    if (person.phone) {
      contactRows.push({
        icon: <AppIcon icon={Phone} />,
        label: 'Phone number',
        copy: true,
        onClick: () => {
          copyPlainText(person.phone!)
          showSnackbar('Phone number copied')
        },
      })
    }
    if (person.whatsapp) {
      contactRows.push({
        icon: <WhatsAppIcon className="text-text-2" />,
        label: 'WhatsApp number',
        copy: true,
        onClick: () => {
          copyPlainText(person.whatsapp!)
          showSnackbar('WhatsApp number copied')
        },
      })
    }

    const messageRows: PanelRow[] = []
    if (availTemplate) {
      messageRows.push({
        icon: <BadgeIcon icon={CalendarClock} badge="exclaim" className="text-text-2" />,
        label: 'Availability follow-up',
        copy: true,
        onClick: () => {
          const { plain } = resolveTokens(availTemplate, { person, slotIndex: slot.index, people, slots })
          copyPlainText(plain)
          showSnackbar('Availability follow-up copied')
        },
      })
    }
    if (kitTemplate) {
      messageRows.push({
        icon: <AppIcon icon={Bell} />,
        label: 'Day before reminder',
        copy: true,
        onClick: () => {
          const { plain } = resolveTokens(kitTemplate, { person, slotIndex: slot.index, people, slots })
          copyPlainText(plain)
          const prev = prevPersonId(slots, slot.index)
          if (!prev) showSnackbar('Previous person not scheduled')
          else showSnackbar('Day before reminder copied')
        },
      })
    }

    const changeRows: PanelRow[] = [
      {
        icon: <AppIcon icon={UserRoundPen} />,
        label: 'Replace person',
        onClick: onSelectPerson,
      },
    ]
    // CR-154: a completed slot is history; untick the lamp before removing.
    if (!slot.doneAt) {
      changeRows.push({
        icon: <AppIcon icon={UserRoundMinus} />,
        label: 'Remove person',
        onClick: () => {
          setOpenPanel(null)
          removePerson(slot.index)
        },
      })
    }
    changeRows.push({
      icon: <AppIcon icon={NotebookPen} />,
      label: note ? 'Edit note' : 'Add note',
      onClick: () => setNoteOpen(true),
    })

    const sections: PanelSection[] = []
    if (contactRows.length) sections.push({ heading: 'Contact details', rows: contactRows })
    if (messageRows.length) sections.push({ heading: 'Messages', rows: messageRows })
    sections.push({ heading: 'Schedule change', rows: changeRows })
    return sections
  }

  const tbdSections = (): PanelSection[] => {
    const rows: PanelRow[] = [
      {
        icon: <AppIcon icon={UserRoundPlus} />,
        label: 'Add person',
        onClick: onSelectPerson,
      },
    ]
    const requestTemplate = templates.find((t) => t.id === 'availability_request')
    if (requestTemplate) {
      rows.push({
        icon: <BadgeIcon icon={Calendar} badge="question" className="text-text-2" />,
        label: 'Availability request',
        copy: true,
        onClick: () => {
          const { plain } = resolveTokens(requestTemplate, { slotIndex: slot.index, people, slots })
          copyPlainText(plain)
          showSnackbar('Availability request copied')
        },
      })
    }
    return [{ rows }]
  }

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={togglePanel}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            togglePanel()
          }
        }}
        className={clsx(
          'pressable flex items-center gap-3 px-4 py-[14px] border-t border-hairline',
          SLOT_FILL[state],
          isToday && 'slot-active',
        )}
      >
        <ExpandChevron open={isOpen} />
        <div className="flex-1 min-w-0">
          <div className="text-[16px] leading-[1.3] font-medium">{person?.fullName ?? 'TBD'}</div>
          <div className="text-[13px] leading-[1.35] mt-0.5 tabular opacity-90">{formatSlotRange(slot.index)}</div>
          {note && (
            <div className="flex items-center gap-1.5 mt-1 text-[13px] leading-[1.35] text-text-2 min-w-0">
              <NotebookPen size={14} strokeWidth={1.75} className="shrink-0" aria-hidden />
              <span className="truncate">{note}</span>
            </div>
          )}
          {requestedNames.length > 0 && <RequestedLine names={requestedNames} />}
        </div>
        {slot.personId && (
          <div className="flex gap-3 shrink-0" onClick={(e) => e.stopPropagation()}>
            <AckToggle
              kind="confirm"
              checked={!!slot.confirmedAt}
              onToggle={() => toggleAck(slot.index, 'confirmedAt')}
            />
            <AckToggle
              kind="kit"
              checked={!!slot.kitAckAt}
              onToggle={() => toggleAck(slot.index, 'kitAckAt')}
            />
            <AckToggle
              kind="done"
              checked={!!slot.doneAt}
              onToggle={() => toggleAck(slot.index, 'doneAt')}
            />
          </div>
        )}
      </div>
      {isOpen && <InlinePanel sections={person ? assignedSections() : tbdSections()} />}
      {person && noteOpen && (
        <NoteSheet
          personName={person.fullName}
          slotIndex={slot.index}
          note={note}
          onCancel={() => setNoteOpen(false)}
          onSave={(text) => {
            setNoteOpen(false)
            setNote(slot.index, text)
          }}
        />
      )}
    </div>
  )
}
