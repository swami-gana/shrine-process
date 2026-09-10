import { useEffect, useState, useCallback } from 'react'
import { useStore } from '../store'
import { useClickOutside } from '../hooks/useClickOutside'
import { copyPlainText } from '../lib/clipboard'
import { BottomNav, type Tab } from '../components/BottomNav'
import { ScheduleTab } from '../components/ScheduleTab'
import { ListTab } from '../components/ListTab'
import { BookView } from '../components/BookView'
import { Snackbar } from '../components/Snackbar'
import { OfflineBanner } from '../components/OfflineBanner'

export function CoordinatorApp() {
  const [tab, setTab] = useState<Tab>('schedule')
  const init = useStore((s) => s.init)
  const refresh = useStore((s) => s.refresh)
  const setOpenPanel = useStore((s) => s.setOpenPanel)
  const showSnackbar = useStore((s) => s.showSnackbar)
  const people = useStore((s) => s.people)
  const openPanelId = useStore((s) => s.openPanelId)

  const closePanel = useCallback(() => setOpenPanel(null), [setOpenPanel])
  useClickOutside(closePanel, !!openPanelId)

  useEffect(() => {
    init()
  }, [init])

  useEffect(() => {
    const onFocus = () => refresh()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refresh])

  const handleTabChange = (newTab: Tab) => {
    setOpenPanel(null)
    setTab(newTab)
  }

  const headerTitle = () => {
    switch (tab) {
      case 'list':
        return `Brahmachari List (${people.length})`
      case 'schedule':
        return 'Schedule'
      case 'book':
        return 'Schedule Yourself'
    }
  }

  return (
      <div className="min-h-dvh flex flex-col bg-bg">
        <OfflineBanner />
        <header className="px-4 pt-4 pb-2 bg-bg flex items-center justify-between">
          <h1 className="text-[15px] font-[650] text-text">{headerTitle()}</h1>
          {tab === 'list' && (
            <button
              type="button"
              onClick={() => {
                copyPlainText(`${window.location.origin}/book`)
                showSnackbar('Scheduling link copied')
              }}
              className="text-[13px] text-active-stroke font-[550] pressable"
            >
              Copy scheduling link
            </button>
          )}
        </header>

        <main className="flex-1 flex flex-col min-h-0">
          {tab === 'schedule' && <ScheduleTab />}
          {tab === 'list' && <ListTab />}
          {tab === 'book' && <BookView />}
        </main>

        <BottomNav active={tab} onChange={handleTabChange} />
        <Snackbar />
      </div>
  )
}
