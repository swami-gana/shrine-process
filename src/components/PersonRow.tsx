import { Calendar, Copy, Users } from 'lucide-react'
import type { Person } from '../types'
import { personStatusLine, bestContact } from '../lib/derived'
import { InlinePanel } from './InlinePanel'
import { copyPlainText } from '../lib/clipboard'
import { ExpandChevron, AppIcon } from '../icons/AppIcon'
import { BadgeIcon } from '../icons/BadgeIcon'

type Props = {
  person: Person
  isOpen: boolean
  onTogglePanel: () => void
  onSetAvailability: (available: boolean) => void
  onSetBackup: (backup: boolean) => void
  onCopyContact: (message: string) => void
}

export function PersonRow({
  person,
  isOpen,
  onTogglePanel,
  onSetAvailability,
  onSetBackup,
  onCopyContact,
}: Props) {
  const contact = bestContact(person)
  const channelLabel = contact?.channel === 'whatsapp' ? 'WA' : contact?.channel === 'phone' ? 'SMS' : 'Email'

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={onTogglePanel}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onTogglePanel()
          }
        }}
        className="pressable flex items-center gap-3 px-4 py-[14px] border-b border-hairline bg-surface-1"
      >
        <ExpandChevron open={isOpen} />
        <div className="flex-1 min-w-0">
          <div className="text-[16px] leading-[1.3] font-medium text-text-1">{person.fullName}</div>
          <div className="text-[13px] leading-[1.35] text-text-2 mt-0.5">{personStatusLine(person)}</div>
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
            onPointerDown={(e) => e.stopPropagation()}
            className="ml-1 flex items-center gap-1.5 px-2.5 py-1.5 rounded-[11px] border border-hairline text-[13px] text-text-2 pressable"
          >
            <span className="text-[11px] bg-bg px-1.5 py-0.5 rounded font-semibold">{channelLabel}</span>
            <Copy size={16} strokeWidth={1.75} />
          </button>
        )}
      </div>
      {isOpen && (
        <InlinePanel
          sections={[
            {
              rows: [
                {
                  icon: <BadgeIcon icon={Calendar} badge="x" className="text-text-2" />,
                  label: person.available ? 'Not available' : 'Available',
                  onClick: () => onSetAvailability(!person.available),
                },
                {
                  icon: <AppIcon icon={Users} />,
                  label: person.backup ? 'Remove from backup' : 'Add to backup',
                  onClick: () => onSetBackup(!person.backup),
                },
              ],
            },
          ]}
        />
      )}
    </div>
  )
}
