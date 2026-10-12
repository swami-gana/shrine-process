import { useEffect, useState, useCallback } from 'react'
import clsx from 'clsx'
import { Link2 } from 'lucide-react'
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

  const [linkFlash, setLinkFlash] = useState(false)

  const copySchedulingLink = () => {
    copyPlainText(`${window.location.origin}/book`)
    showSnackbar('Scheduling link copied')
    setLinkFlash(true)
    setTimeout(() => setLinkFlash(false), 200)
  }

  const headerTitle = () => {
    switch (tab) {
      case 'list':
        return 'Brahmachari List'
      case 'schedule':
        return 'Schedule'
      case 'book':
        return 'Schedule Yourself'
    }
  }

  return (
    <div className="h-dvh flex flex-col bg-bg overflow-hidden">
      <StatusBar />
      <header className="px-4 pt-4 pb-2 bg-bg flex items-center gap-2 shrink-0 min-h-[60px]">
        <h1 className="flex-1 min-w-0 flex items-baseline gap-2 whitespace-nowrap">
          <span className="shrink-0 font-serif text-[28px] leading-[1.15] font-normal text-text-1">{headerTitle()}</span>
          {tab === 'list' && (
            <span className="min-w-0 truncate text-[14px] text-text-3 tabular">{people.length}</span>
          )}
        </h1>
        {tab === 'list' && (
          <button
            type="button"
            onClick={copySchedulingLink}
            aria-label="Copy scheduling link"
            className={clsx(
              'shrink-0 -mr-2 w-11 h-11 flex items-center justify-center rounded-full text-ember pressable transition-colors duration-200',
              linkFlash && 'bg-ember/20',
            )}
          >
            <Link2 size={24} strokeWidth={1.75} absoluteStrokeWidth />
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
