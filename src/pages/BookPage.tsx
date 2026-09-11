import { useEffect } from 'react'
import { useStore } from '../store'
import { BookView } from '../components/BookView'
import { Snackbar } from '../components/Snackbar'

export function BookPage() {
  const init = useStore((s) => s.init)
  const refresh = useStore((s) => s.refresh)

  useEffect(() => {
    init()
  }, [init])

  useEffect(() => {
    const onFocus = () => refresh()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refresh])

  return (
    <div className="min-h-dvh flex flex-col bg-bg">
      <header className="px-4 pt-4 pb-2">
        <h1 className="font-serif text-[28px] leading-[1.15] font-normal text-text-1">Schedule Yourself</h1>
      </header>
      <BookView />
      <Snackbar />
    </div>
  )
}
