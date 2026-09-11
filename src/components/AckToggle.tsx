import clsx from 'clsx'
import { Bell, ThumbsUp } from 'lucide-react'
import { Diya } from '../icons/Diya'

type Kind = 'confirm' | 'kit' | 'done'

type Props = {
  kind: Kind
  checked: boolean
  onToggle: () => void
}

export function AckToggle({ kind, checked, onToggle }: Props) {
  const glyph =
    kind === 'done' ? (
      <Diya lit={checked} className={checked ? 'text-gold' : 'text-text-3'} />
    ) : kind === 'kit' ? (
      <Bell
        size={24}
        strokeWidth={1.75}
        absoluteStrokeWidth
        fill={checked ? 'currentColor' : 'none'}
        className={checked ? 'text-gold' : 'text-text-3'}
      />
    ) : (
      <ThumbsUp
        size={24}
        strokeWidth={1.75}
        absoluteStrokeWidth
        fill={checked ? 'currentColor' : 'none'}
        className={checked ? 'text-gold' : 'text-text-3'}
      />
    )

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      onPointerDown={(e) => e.stopPropagation()}
      className="relative w-11 h-11 flex items-center justify-center rounded-[11px] pressable active:bg-surface-3"
      aria-pressed={checked}
    >
      {kind === 'done' && checked && (
        <span className="ack-glow absolute inset-0 rounded-full pointer-events-none" />
      )}
      <span
        key={checked ? 'lit' : 'unlit'}
        className={clsx('relative flex items-center justify-center', checked && kind === 'done' && 'ack-lit-done')}
      >
        {glyph}
        {checked && (
          <span className="absolute -right-[3px] -bottom-[3px] w-[15px] h-[15px] rounded-full bg-gold flex items-center justify-center badge-pop">
            <svg viewBox="0 0 12 12" width="9" height="9" aria-hidden>
              <path
                d="M2.5 6.2 4.8 8.5 9.5 3.5"
                fill="none"
                stroke="#0E0B0A"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        )}
      </span>
    </button>
  )
}
