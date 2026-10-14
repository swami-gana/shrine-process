import { useCallback, useMemo, useState } from 'react'
import clsx from 'clsx'
import { Search, X } from 'lucide-react'
import { useStore } from '../store'
import { nextSlotByPerson, sortNextUp, sortBackup } from '../lib/derived'
import { openRequestFor, requestCount } from '../lib/requests'
import { searchKey } from '../lib/search'
import type { Person } from '../types'
import { PersonRow } from './PersonRow'
import { RequestSlotSheet } from './RequestSlotSheet'

type Filter = 'az' | 'next' | 'backup'

export function ListTab() {
  const people = useStore((s) => s.people)
  const setAvailability = useStore((s) => s.setAvailability)
  const setBackup = useStore((s) => s.setBackup)
  const showSnackbar = useStore((s) => s.showSnackbar)
  const openPanelId = useStore((s) => s.openPanelId)
  const setOpenPanel = useStore((s) => s.setOpenPanel)
  const requests = useStore((s) => s.requests)
  const slots = useStore((s) => s.slots)
  const nextSlots = useMemo(() => nextSlotByPerson(slots), [slots])
  const createRequest = useStore((s) => s.createRequest)
  const confirmRequest = useStore((s) => s.confirmRequest)
  const cancelRequest = useStore((s) => s.cancelRequest)

  const [filter, setFilter] = useState<Filter>('az')
  const [requesting, setRequesting] = useState<Person | null>(null)
  const [query, setQuery] = useState('')

  const requestInfo = useMemo(() => {
    const map = new Map<string, { open: ReturnType<typeof openRequestFor>; count: number }>()
    for (const id of new Set(requests.map((r) => r.personId))) {
      map.set(id, { open: openRequestFor(requests, id), count: requestCount(requests, id) })
    }
    return map
  }, [requests])

  const togglePanel = useCallback(
    (personId: string) => {
      const panelId = `person-${personId}`
      setOpenPanel(useStore.getState().openPanelId === panelId ? null : panelId)
    },
    [setOpenPanel],
  )

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

  const visible = useMemo(() => {
    const q = searchKey(query)
    if (!q) return sorted
    return sorted.filter((p) => searchKey(p.fullName).includes(q))
  }, [sorted, query])

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

      <div className="px-4 pb-2">
        <div className="relative">
          <Search
            size={18}
            strokeWidth={1.75}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-3 pointer-events-none"
            aria-hidden
          />
          <input
            id="list-search"
            type="search"
            inputMode="search"
            autoComplete="off"
            placeholder="Search name"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setOpenPanel(null)
            }}
            className="w-full pl-10 pr-10 py-2 rounded-[11px] border border-hairline bg-surface-1 text-[15px] text-text-1 placeholder:text-text-3 [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setQuery('')}
              className="absolute right-0 top-0 h-full w-10 flex items-center justify-center text-text-3"
            >
              <X size={18} strokeWidth={1.75} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-4">
        {visible.length === 0 && (
          <p className="px-4 py-3 text-[15px] text-text-2">No name matches that.</p>
        )}
        {visible.map((person) => {
          const info = requestInfo.get(person.id)
          return (
            <PersonRow
              key={person.id}
              person={person}
              openRequest={info?.open}
              nextSlot={nextSlots.get(person.id)}
              requestCount={info?.count ?? 0}
              isOpen={openPanelId === `person-${person.id}`}
              onTogglePanel={togglePanel}
              onSetAvailability={setAvailability}
              onSetBackup={setBackup}
              onRequest={setRequesting}
              onConfirmRequest={confirmRequest}
              onCancelRequest={cancelRequest}
              onCopyContact={showSnackbar}
            />
          )
        })}
      </div>

      <RequestSlotSheet
        key={requesting?.id ?? 'closed'}
        person={requesting}
        onCancel={() => setRequesting(null)}
        onConfirm={(slotIndex) => {
          if (requesting) createRequest(requesting.id, slotIndex)
          setRequesting(null)
        }}
      />
    </div>
  )
}
