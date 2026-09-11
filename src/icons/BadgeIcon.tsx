import type { LucideIcon } from 'lucide-react'
import clsx from 'clsx'

type Props = {
  icon: LucideIcon
  badge: 'exclaim' | 'x' | 'check'
  className?: string
}

export function BadgeIcon({ icon: Icon, badge, className }: Props) {
  return (
    <span className={clsx('relative inline-flex w-6 h-6', className)}>
      <Icon size={24} strokeWidth={1.75} absoluteStrokeWidth />
      {badge === 'exclaim' && (
        <span className="absolute -right-0.5 -bottom-0.5 w-3 h-3 rounded-full bg-surface-2 text-text-2 flex items-center justify-center text-[9px] font-semibold leading-none">
          !
        </span>
      )}
      {badge === 'x' && (
        <span className="absolute -right-0.5 -bottom-0.5 w-3 h-3 rounded-full bg-surface-2 text-text-2 flex items-center justify-center text-[8px] font-semibold leading-none">
          ×
        </span>
      )}
      {badge === 'check' && (
        <span className="absolute -right-[3px] -bottom-[3px] w-[15px] h-[15px] rounded-full bg-gold flex items-center justify-center">
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
  )
}
