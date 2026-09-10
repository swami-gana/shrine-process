import { useState } from 'react'
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

  const sorted = (() => {
    switch (filter) {
      case 'next':
        return sortNextUp(people)
      case 'backup':
        return sortBackup(people)
      default:
        return [...people].sort((a, b) => a.fullName.localeCompare(b.fullName))
    }
  })()

  if (people.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center px-6">
        <p className="text-[13px] text-secondary text-center">
          No one on the roster yet. Import the sheet to get started.
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
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
              'px-3 py-1.5 rounded-full text-[13px] font-[550] border',
              filter === f
                ? 'bg-active-stroke text-white border-active-stroke'
                : 'bg-card text-secondary border-hairline',
            )}
          >
            {f === 'az' ? 'A–Z' : f === 'next' ? 'Next up' : 'Backup'}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto pb-24">
        {sorted.map((person) => {
          const panelId = `person-${person.id}`
          const isOpen = openPanelId === panelId

          return (
            <PersonRow
              key={person.id}
              person={person}
              isOpen={isOpen}
              onTogglePanel={() => setOpenPanel(isOpen ? null : panelId)}
              onClosePanel={() => setOpenPanel(null)}
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
