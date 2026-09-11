import {
  AtSign,
  Bell,
  CalendarClock,
  Phone,
  UserRoundPen,
} from 'lucide-react'
import clsx from 'clsx'
import type { Person, Slot } from '../types'
import { getSlotCardState, SLOT_FILL, getPersonById, prevPersonId } from '../lib/derived'
import { formatSlotRange, isTodayInSlot } from '../lib/slots'
import { AckToggle } from './AckToggle'
import { InlinePanel } from './InlinePanel'
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

  const person = getPersonById(people, slot.personId)
  const state = getSlotCardState(slot)
  const isOpen = openPanelId === panelId
  const isToday = isTodayInSlot(slot.index)

  const togglePanel = () => setOpenPanel(isOpen ? null : panelId)

  const assignedSections = () => {
    if (!person) return []
    const availTemplate = templates.find((t) => t.id === 'availability_check')
    const kitTemplate = templates.find((t) => t.id === 'kit_reminder')
    const contactRows = []
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

    const messageRows = []
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

    const sections = []
    if (contactRows.length) sections.push({ heading: 'Contact details', rows: contactRows })
    if (messageRows.length) sections.push({ heading: 'Messages', rows: messageRows })
    sections.push({
      rows: [
        {
          icon: <AppIcon icon={UserRoundPen} />,
          label: 'Replace person',
          onClick: onSelectPerson,
        },
      ],
    })
    return sections
  }

  const tbdSections = [
    {
      rows: [
        {
          icon: <AppIcon icon={UserRoundPen} />,
          label: 'Select person',
          onClick: onSelectPerson,
        },
      ],
    },
  ]

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
      {isOpen && <InlinePanel sections={person ? assignedSections() : tbdSections} />}
    </div>
  )
}
