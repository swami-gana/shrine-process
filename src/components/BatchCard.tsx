import clsx from 'clsx'
import { AtSign, Mail } from 'lucide-react'
import type { Person, Slot } from '../types'
import { isBatchComplete } from '../lib/derived'
import { formatBatchRange, batchSlots, getSlot } from '../lib/slots'
import { SlotCard } from './SlotCard'
import { InlinePanel } from './InlinePanel'
import { useStore } from '../store'
import { copyPlainText, copyRichText } from '../lib/clipboard'
import { resolveTokens, countTbdInBatch } from '../lib/templates'
import { ExpandChevron, AppIcon } from '../icons/AppIcon'

type Props = {
  batch: number
  slots: Slot[]
  people: Person[]
  onSelectPerson: (index: number) => void
}

export function BatchCard({ batch, slots, people, onSelectPerson }: Props) {
  const templates = useStore((s) => s.templates)
  const showSnackbar = useStore((s) => s.showSnackbar)
  const openPanelId = useStore((s) => s.openPanelId)
  const setOpenPanel = useStore((s) => s.setOpenPanel)

  const panelId = `batch-${batch}`
  const isOpen = openPanelId === panelId
  const complete = isBatchComplete(slots, batch)
  const batchSlotIndices = batchSlots(batch)
  const batchSlotData = batchSlotIndices.map((i) => getSlot(slots, i))
  const headsUpTemplate = templates.find((t) => t.id === 'heads_up')

  const handleCopyEmails = () => {
    const emails = batchSlotData
      .map((s) => people.find((p) => p.id === s.personId)?.email)
      .filter(Boolean) as string[]
    copyPlainText(emails.join(', '))
    showSnackbar(`${emails.length} email ID${emails.length !== 1 ? 's' : ''} copied`)
  }

  const handleCopyHeadsUp = () => {
    if (!headsUpTemplate) return
    const { html, plain } = resolveTokens(headsUpTemplate, {
      slotIndex: batch * 4,
      people,
      slots,
    })
    copyRichText(html, plain)
    const tbd = countTbdInBatch(slots, batch)
    if (tbd > 0) {
      showSnackbar(`Heads-up message copied · ${tbd} slot${tbd > 1 ? 's' : ''} still TBD`)
    } else {
      showSnackbar('Heads-up message copied')
    }
  }

  return (
    <div
      className={clsx(
        'mb-4 rounded-[14px] overflow-hidden bg-surface-1',
        complete && 'opacity-40',
      )}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpenPanel(isOpen ? null : panelId)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setOpenPanel(isOpen ? null : panelId)
          }
        }}
        className="pressable px-4 py-[14px] flex items-center gap-3"
      >
        <ExpandChevron open={isOpen} />
        <span className="flex-1 font-serif text-[22px] leading-[1.2] text-text-1 tabular">
          {formatBatchRange(batch)}
        </span>
        {complete && <span className="text-text-3 text-lg">✓</span>}
      </div>

      {isOpen && (
        <InlinePanel
          sections={[
            {
              rows: [
                {
                  icon: <AppIcon icon={AtSign} />,
                  label: 'Email IDs',
                  copy: true,
                  onClick: handleCopyEmails,
                },
                {
                  icon: <AppIcon icon={Mail} />,
                  label: 'Heads-up message',
                  copy: true,
                  onClick: handleCopyHeadsUp,
                },
              ],
            },
          ]}
        />
      )}

      {batchSlotData.map((slot) => (
        <SlotCard
          key={slot.index}
          slot={slot}
          people={people}
          panelId={`slot-${slot.index}`}
          onSelectPerson={() => onSelectPerson(slot.index)}
        />
      ))}
    </div>
  )
}
