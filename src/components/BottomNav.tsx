import clsx from 'clsx'
import { CalendarPlus, List } from 'lucide-react'
import { Diya } from '../icons/Diya'

export type Tab = 'list' | 'schedule' | 'book'

type Props = {
  active: Tab
  onChange: (tab: Tab) => void
}

export function BottomNav({ active, onChange }: Props) {
  const tabs: { id: Tab; label: string; icon: 'list' | 'diya' | 'plus' }[] = [
    { id: 'list', label: 'List', icon: 'list' },
    { id: 'schedule', label: 'Schedule', icon: 'diya' },
    { id: 'book', label: 'Schedule Yourself', icon: 'plus' },
  ]

  return (
    <nav className="bg-surface-1 border-t border-hairline flex z-40 shrink-0 pb-[env(safe-area-inset-bottom)]">
      {tabs.map((tab) => {
        const on = active === tab.id
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className="flex-1 py-2 flex flex-col items-center gap-0.5 pressable"
          >
            <span className={on ? 'text-ember' : 'text-text-3'}>
              {tab.icon === 'list' && <List size={24} strokeWidth={1.75} absoluteStrokeWidth />}
              {tab.icon === 'diya' && <Diya lit={on} />}
              {tab.icon === 'plus' && <CalendarPlus size={24} strokeWidth={1.75} absoluteStrokeWidth />}
            </span>
            <span
              className={clsx(
                'text-[11px] leading-[1.2] font-medium',
                on ? 'text-text-1' : 'text-text-3',
              )}
            >
              {tab.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
