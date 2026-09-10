import type { Person } from '../types'
import { personStatusLine, bestContact } from '../lib/derived'
import { useLongPress } from '../hooks/useLongPress'
import { InlinePanel } from './InlinePanel'
import { copyPlainText } from '../lib/clipboard'

type Props = {
  person: Person
  isOpen: boolean
  onTogglePanel: () => void
  onClosePanel: () => void
  onSetAvailability: (available: boolean) => void
  onSetBackup: (backup: boolean) => void
  onCopyContact: (message: string) => void
}

export function PersonRow({
  person,
  isOpen,
  onTogglePanel,
  onClosePanel,
  onSetAvailability,
  onSetBackup,
  onCopyContact,
}: Props) {
  const contact = bestContact(person)

  const longPress = useLongPress({
    onLongPress: onTogglePanel,
  })

  const channelLabel = contact?.channel === 'whatsapp' ? 'WA' : contact?.channel === 'phone' ? 'SMS' : 'Email'

  return (
    <div>
      <div
        {...longPress}
        className="pressable flex items-center justify-between px-4 py-3 border-b border-hairline bg-card"
      >
        <div className="flex-1 min-w-0">
          <div className="text-[15px]">{person.fullName}</div>
          <div className="text-[13px] text-secondary mt-0.5">{personStatusLine(person)}</div>
        </div>
        {contact && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              copyPlainText(contact.value)
              const labels = { email: 'Email copied', phone: 'Phone number copied', whatsapp: 'WhatsApp number copied' }
              onCopyContact(labels[contact.channel])
            }}
            className="ml-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-hairline text-[13px] text-secondary pressable"
          >
            <span className="text-[11px] bg-bg px-1.5 py-0.5 rounded font-[650]">{channelLabel}</span>
            <span>⎘</span>
          </button>
        )}
      </div>
      {isOpen && (
        <InlinePanel
          items={[
            {
              label: person.available ? 'Mark not available' : 'Mark available',
              onClick: () => onSetAvailability(!person.available),
            },
            {
              label: person.backup ? 'Remove from backup' : 'Add to backup',
              onClick: () => onSetBackup(!person.backup),
            },
          ]}
          onClose={onClosePanel}
        />
      )}
    </div>
  )
}
