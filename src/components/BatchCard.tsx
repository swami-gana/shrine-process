import clsx from 'clsx'
import type { Person, Slot } from '../types'
import { isBatchComplete } from '../lib/derived'
import { formatBatchRange, batchSlots } from '../lib/slots'
import { SlotCard } from './SlotCard'
import { useLongPress } from '../hooks/useLongPress'
import { InlinePanel } from './InlinePanel'
import { useStore } from '../store'
import { copyPlainText, copyRichText } from '../lib/clipboard'
import { resolveTokens, countTbdInBatch } from '../lib/templates'

type Props = {
  batch: number
  slots: Slot[]
  people: Person[]
  onAssignSlot: (index: number) => void
  onReplaceSlot: (index: number) => void
}

export function BatchCard({ batch, slots, people, onAssignSlot, onReplaceSlot }: Props) {
  const templates = useStore((s) => s.templates)
  const showSnackbar = useStore((s) => s.showSnackbar)
  const openPanelId = useStore((s) => s.openPanelId)
  const setOpenPanel = useStore((s) => s.setOpenPanel)

  const panelId = `batch-${batch}`
  const isOpen = openPanelId === panelId
  const complete = isBatchComplete(slots, batch)
  const batchSlotIndices = batchSlots(batch)
  const batchSlotData = batchSlotIndices.map((i) => slots.find((s) => s.index === i)!)

  const longPress = useLongPress({
    onLongPress: () => setOpenPanel(isOpen ? null : panelId),
  })

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
    const firstSlot = batch * 4
    const { html, plain } = resolveTokens(headsUpTemplate, {
      slotIndex: firstSlot,
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
    <div className={clsx('mb-3', complete && 'opacity-45')}>
      <div
        {...longPress}
        className="pressable bg-card rounded-t-lg px-4 py-3 flex items-center justify-between border border-hairline border-b-0"
      >
        <span className="text-[15px] font-[550]">{formatBatchRange(batch)}</span>
        {complete && <span className="text-active-stroke text-lg">✓</span>}
      </div>

      {isOpen && (
        <InlinePanel
          items={[
            { label: 'Copy email IDs', onClick: handleCopyEmails },
            { label: 'Copy heads-up message', onClick: handleCopyHeadsUp },
          ]}
          onClose={() => setOpenPanel(null)}
        />
      )}

      <div className="border border-hairline border-t-0 rounded-b-lg overflow-hidden">
        {batchSlotData.map((slot) => (
          <SlotCard
            key={slot.index}
            slot={slot}
            people={people}
            panelId={`slot-${slot.index}`}
            onAssign={() => onAssignSlot(slot.index)}
            onReplace={() => onReplaceSlot(slot.index)}
          />
        ))}
      </div>
    </div>
  )
}
