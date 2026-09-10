import clsx from 'clsx'

export type Tab = 'list' | 'schedule' | 'book'

type Props = {
  active: Tab
  onChange: (tab: Tab) => void
}

export function BottomNav({ active, onChange }: Props) {
  const tabs: { id: Tab; label: string }[] = [
    { id: 'list', label: 'List' },
    { id: 'schedule', label: 'Schedule' },
    { id: 'book', label: 'Schedule Yourself' },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-hairline flex z-40">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={clsx(
            'flex-1 py-3 text-[13px] font-[550] transition-colors',
            active === tab.id ? 'text-active-stroke' : 'text-secondary',
          )}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  )
}
