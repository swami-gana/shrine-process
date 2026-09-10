import clsx from 'clsx'
import type { Person, Slot } from '../types'
import { getSlotCardState, SLOT_FILL, getPersonById } from '../lib/derived'
import { formatSlotRange, isTodayInSlot } from '../lib/slots'
import { IconToggle } from './IconToggle'
import { useLongPress } from '../hooks/useLongPress'
import { InlinePanel } from './InlinePanel'
import { useStore } from '../store'
import { copyPlainText } from '../lib/clipboard'
import { resolveTokens } from '../lib/templates'
import { prevPersonId } from '../lib/derived'

type Props = {
  slot: Slot
  people: Person[]
  panelId: string
  onAssign: () => void
  onReplace: () => void
}

export function SlotCard({ slot, people, panelId, onAssign, onReplace }: Props) {
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

  const longPress = useLongPress({
    onLongPress: () => {
      if (slot.personId) {
        setOpenPanel(isOpen ? null : panelId)
      }
    },
    onClick: () => {
      if (!slot.personId) onAssign()
    },
    disabled: false,
  })

  const buildPanelItems = () => {
    if (!person) return []
    const availTemplate = templates.find((t) => t.id === 'availability_check')
    const kitTemplate = templates.find((t) => t.id === 'kit_reminder')

    return [
      {
        label: 'Copy email',
        onClick: () => {
          if (person.email) {
            copyPlainText(person.email)
            showSnackbar('Email copied')
          }
        },
        disabled: !person.email,
      },
      {
        label: person.phone ? 'Copy phone number' : 'No phone number on file',
        onClick: () => {
          if (person.phone) {
            copyPlainText(person.phone)
            showSnackbar('Phone number copied')
          }
        },
        disabled: !person.phone,
      },
      {
        label: person.whatsapp ? 'Copy WhatsApp number' : 'No WhatsApp number on file',
        onClick: () => {
          if (person.whatsapp) {
            copyPlainText(person.whatsapp)
            showSnackbar('WhatsApp number copied')
          }
        },
        disabled: !person.whatsapp,
        dividerBefore: false,
      },
      {
        label: 'Copy availability check',
        dividerBefore: true,
        onClick: () => {
          if (availTemplate) {
            const { plain } = resolveTokens(availTemplate, {
              person,
              slotIndex: slot.index,
              people,
              slots,
            })
            copyPlainText(plain)
            showSnackbar('Availability check copied')
          }
        },
      },
      {
        label: 'Copy kit reminder',
        onClick: () => {
          if (kitTemplate) {
            const { plain } = resolveTokens(kitTemplate, {
              person,
              slotIndex: slot.index,
              people,
              slots,
            })
            copyPlainText(plain)
            const prev = prevPersonId(slots, slot.index)
            if (!prev) showSnackbar('Previous person not scheduled')
            else showSnackbar('Kit reminder copied')
          }
        },
      },
      {
        label: 'Replace person',
        dividerBefore: true,
        onClick: onReplace,
      },
    ]
  }

  return (
    <div>
      <div
        {...longPress}
        className={clsx(
          'pressable flex items-center justify-between px-4 py-3 border-t border-hairline/60',
          SLOT_FILL[state],
          isToday && 'ring-2 ring-inset ring-active-stroke',
        )}
      >
        <div>
          <div className="text-[15px] font-[550]">{person?.fullName ?? 'TBD'}</div>
          <div className="text-[12px] text-secondary mt-0.5">{formatSlotRange(slot.index)}</div>
        </div>
        {slot.personId && (
          <div className="flex gap-0.5">
            <IconToggle
              emoji="👍"
              checked={!!slot.confirmedAt}
              onToggle={() => toggleAck(slot.index, 'confirmedAt')}
            />
            <IconToggle
              emoji="🔔"
              checked={!!slot.kitAckAt}
              onToggle={() => toggleAck(slot.index, 'kitAckAt')}
            />
            <IconToggle
              emoji="🔥"
              checked={!!slot.doneAt}
              onToggle={() => toggleAck(slot.index, 'doneAt')}
            />
          </div>
        )}
      </div>
      {isOpen && (
        <InlinePanel
          items={buildPanelItems()}
          onClose={() => setOpenPanel(null)}
        />
      )}
    </div>
  )
}
