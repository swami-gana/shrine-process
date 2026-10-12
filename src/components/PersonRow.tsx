import { memo } from 'react'
import { Calendar, CircleAlert, Copy } from 'lucide-react'
import type { Person, SlotRequest } from '../types'
import { REQUEST_FLAG_AT } from '../config'
import { personStatusLine, bestContact } from '../lib/derived'
import { formatSlotRange } from '../lib/slots'
import { InlinePanel, type PanelSection } from './InlinePanel'
import { copyPlainText } from '../lib/clipboard'
import { ExpandChevron } from '../icons/AppIcon'
import { BadgeIcon } from '../icons/BadgeIcon'
import { AratiStick } from '../icons/AratiStick'

type Props = {
  person: Person
  openRequest: SlotRequest | undefined
  requestCount: number
  isOpen: boolean
  onTogglePanel: (personId: string) => void
  onSetAvailability: (personId: string, available: boolean) => void
  onSetBackup: (personId: string, backup: boolean) => void
  onRequest: (person: Person) => void
  onConfirmRequest: (requestId: string) => void
  onCancelRequest: (requestId: string) => void
  onCopyContact: (message: string) => void
}

/** CR-172 to CR-175: request information appended to the status line. */
function RequestSegment({ count, openRequest }: { count: number; openRequest: SlotRequest | undefined }) {
  if (count === 0 && !openRequest) return null
  const flagged = count >= REQUEST_FLAG_AT
  return (
    <>
      {count > 0 && (
        <>
          {' · '}
          <span className={flagged ? 'text-ember whitespace-nowrap' : 'whitespace-nowrap'}>
            {flagged && <CircleAlert size={12} strokeWidth={2} className="inline -mt-0.5 mr-1" aria-hidden />}
            Requested {count}x
          </span>
        </>
      )}
      {openRequest && (
        <>
          {' · '}
          <span className="whitespace-nowrap tabular">{formatSlotRange(openRequest.slotIndex)}</span>
        </>
      )}
    </>
  )
}

export const PersonRow = memo(function PersonRow({
  person,
  openRequest,
  requestCount,
  isOpen,
  onTogglePanel,
  onSetAvailability,
  onSetBackup,
  onRequest,
  onConfirmRequest,
  onCancelRequest,
  onCopyContact,
}: Props) {
  const contact = bestContact(person)
  const channelLabel = contact?.channel === 'whatsapp' ? 'WA' : contact?.channel === 'phone' ? 'SMS' : 'Email'
  const toggle = () => onTogglePanel(person.id)

  const sections: PanelSection[] = []
  if (person.available) {
    sections.push(
      openRequest
        ? {
            heading: `Request · ${formatSlotRange(openRequest.slotIndex)}`,
            rows: [
              {
                icon: <BadgeIcon icon={Calendar} badge="check" className="text-text-2" />,
                label: 'Mark confirmed',
                onClick: () => onConfirmRequest(openRequest.id),
              },
              {
                icon: <BadgeIcon icon={Calendar} badge="x" className="text-text-2" />,
                label: 'Cancel request',
                onClick: () => onCancelRequest(openRequest.id),
              },
            ],
          }
        : {
            heading: 'Request',
            rows: [
              {
                icon: <BadgeIcon icon={Calendar} badge="arrow" className="text-text-2" />,
                label: 'Request for a slot',
                onClick: () => onRequest(person),
              },
            ],
          },
    )
  }
  sections.push({
    heading: 'Status',
    rows: [
      person.available
        ? {
            icon: <BadgeIcon icon={Calendar} badge="x" className="text-text-2" />,
            label: 'Mark not available',
            onClick: () => onSetAvailability(person.id, false),
          }
        : {
            icon: <BadgeIcon icon={Calendar} badge="check" className="text-text-2" />,
            label: 'Mark available',
            onClick: () => onSetAvailability(person.id, true),
          },
      {
        icon: <AratiStick lit={person.backup} className="text-text-2" />,
        label: person.backup ? 'Remove from backup' : 'Add to backup',
        onClick: () => onSetBackup(person.id, !person.backup),
      },
    ],
  })

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            toggle()
          }
        }}
        className="pressable flex items-center gap-3 px-4 py-[14px] border-b border-hairline bg-surface-1"
      >
        <ExpandChevron open={isOpen} />
        <div className="flex-1 min-w-0">
          <div className="text-[16px] leading-[1.3] font-medium text-text-1">{person.fullName}</div>
          <div className="text-[13px] leading-[1.35] text-text-2 mt-0.5">
            {personStatusLine(person)}
            {person.available && <RequestSegment count={requestCount} openRequest={openRequest} />}
          </div>
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
      {isOpen && <InlinePanel sections={sections} />}
    </div>
  )
})
