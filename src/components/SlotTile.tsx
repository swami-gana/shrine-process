import { Check, Plus, X } from 'lucide-react'
import clsx from 'clsx'
import { formatSlotRange } from '../lib/slots'

export type SlotTileState = 'open' | 'scheduled' | 'selected'

type Props = {
  index: number
  state: SlotTileState
  subtitle?: string
  glyph?: 'plus' | 'x' | 'check' | null
  onClick?: () => void
}

/** CR-126: open and scheduled slots are boxes of identical size and shape. */
export function SlotTile({ index, state, subtitle, glyph, onClick }: Props) {
  const scheduled = state === 'scheduled'
  return (
    <button
      type="button"
      disabled={!onClick}
      onClick={onClick}
      className={clsx(
        'relative text-left h-[64px] px-3 py-2.5 rounded-[14px] border transition-colors duration-200',
        onClick && 'pressable',
        scheduled ? 'bg-bg border-hairline' : 'bg-surface-1',
        state === 'open' && 'border-ember-dim',
        state === 'selected' && 'border-2 border-ember',
      )}
    >
      <div className={clsx('text-[13px] font-medium tabular pr-5', scheduled ? 'text-text-2' : 'text-text-1')}>
        {formatSlotRange(index)}
      </div>
      {subtitle && (
        <div className={clsx('text-[13px] mt-1 truncate', scheduled ? 'text-text-3' : 'text-text-2')}>{subtitle}</div>
      )}
      {glyph && (
        <span
          className={clsx(
            'absolute top-2.5 right-2.5',
            glyph === 'x' ? 'text-text-3' : 'text-ember',
          )}
        >
          {glyph === 'plus' && <Plus size={16} strokeWidth={2} />}
          {glyph === 'x' && <X size={16} strokeWidth={2} />}
          {glyph === 'check' && <Check size={16} strokeWidth={2.25} />}
        </span>
      )}
    </button>
  )
}
