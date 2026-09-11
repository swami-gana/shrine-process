import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { useStore } from '../store'
import { sortNextUp, sortBackup } from '../lib/derived'
import { PersonRow } from './PersonRow'

type Filter = 'az' | 'next' | 'backup'

export function ListTab() {
  const people = useStore((s) => s.people)
  const setAvailability = useStore((s) => s.setAvailability)
  const setBackup = useStore((s) => s.setBackup)
  const showSnackbar = useStore((s) => s.showSnackbar)
  const openPanelId = useStore((s) => s.openPanelId)
  const setOpenPanel = useStore((s) => s.setOpenPanel)

  const [filter, setFilter] = useState<Filter>('az')

  const sorted = useMemo(() => {
    switch (filter) {
      case 'next':
        return sortNextUp(people)
      case 'backup':
        return sortBackup(people)
      default:
        return [...people].sort((a, b) => a.fullName.localeCompare(b.fullName))
    }
  }, [people, filter])

  if (people.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center px-6 h-full">
        <p className="text-[13px] text-text-2 text-center">
          No one on the roster yet. Import the sheet to get started.
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 h-full">
      <div className="px-4 pt-2 pb-2 flex gap-2">
        {(['az', 'next', 'backup'] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => {
              setFilter(f)
              setOpenPanel(null)
            }}
            className={clsx(
              'px-3 py-1.5 rounded-full text-[14px] leading-none font-medium border',
              filter === f
                ? 'bg-ember text-bg border-ember'
                : 'bg-surface-2 text-text-2 border-hairline',
            )}
          >
            {f === 'az' ? 'A–Z' : f === 'next' ? 'Next up' : 'Backup'}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto pb-4">
        {sorted.map((person) => {
          const panelId = `person-${person.id}`
          const isOpen = openPanelId === panelId

          return (
            <PersonRow
              key={person.id}
              person={person}
              isOpen={isOpen}
              onTogglePanel={() => setOpenPanel(isOpen ? null : panelId)}
              onSetAvailability={(available) => setAvailability(person.id, available)}
              onSetBackup={(backup) => setBackup(person.id, backup)}
              onCopyContact={showSnackbar}
            />
          )
        })}
      </div>
    </div>
  )
}
