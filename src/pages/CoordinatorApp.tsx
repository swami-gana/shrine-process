import { useEffect, useState, useCallback } from 'react'
import { useStore } from '../store'
import { useClickOutside } from '../hooks/useClickOutside'
import { copyPlainText } from '../lib/clipboard'
import { BottomNav, type Tab } from '../components/BottomNav'
import { ScheduleTab } from '../components/ScheduleTab'
import { ListTab } from '../components/ListTab'
import { BookView } from '../components/BookView'
import { Snackbar } from '../components/Snackbar'
import { StatusBar } from '../components/StatusBar'
import { TabPager } from '../components/TabPager'

export function CoordinatorApp() {
  const [tab, setTab] = useState<Tab>('schedule')
  const init = useStore((s) => s.init)
  const refresh = useStore((s) => s.refresh)
  const processQueue = useStore((s) => s.processQueue)
  const setOpenPanel = useStore((s) => s.setOpenPanel)
  const showSnackbar = useStore((s) => s.showSnackbar)
  const people = useStore((s) => s.people)
  const openPanelId = useStore((s) => s.openPanelId)
  const sheetOpen = useStore((s) => s.sheetOpen)

  const closePanel = useCallback(() => setOpenPanel(null), [setOpenPanel])
  useClickOutside(closePanel, !!openPanelId)

  useEffect(() => {
    init()
  }, [init])

  useEffect(() => {
    const onFocus = () => {
      const queued = useStore.getState().queueCount
      if (queued === 0) refresh()
      else processQueue()
    }
    const onOnline = () => processQueue()
    window.addEventListener('focus', onFocus)
    window.addEventListener('online', onOnline)
    return () => {
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('online', onOnline)
    }
  }, [refresh, processQueue])

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
    <div className="h-dvh flex flex-col bg-bg overflow-hidden">
      <StatusBar />
      <header className="px-4 pt-4 pb-2 bg-bg flex items-center justify-between shrink-0">
        <h1 className="font-serif text-[28px] leading-[1.15] font-normal text-text-1">{headerTitle()}</h1>
        {tab === 'list' && (
          <button
            type="button"
            onClick={() => {
              copyPlainText(`${window.location.origin}/book`)
              showSnackbar('Scheduling link copied')
            }}
            className="text-[13px] text-ember font-medium pressable"
          >
            Copy scheduling link
          </button>
        )}
      </header>

      <TabPager active={tab} onChange={handleTabChange} disabled={sheetOpen}>
        <ListTab />
        <ScheduleTab />
        <div className="h-full min-h-0 flex flex-col">
          <BookView />
        </div>
      </TabPager>

      <BottomNav active={tab} onChange={handleTabChange} />
      <Snackbar />
    </div>
  )
}
