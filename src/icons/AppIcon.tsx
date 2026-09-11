import type { LucideIcon } from 'lucide-react'
import clsx from 'clsx'

export function AppIcon({
  icon: Icon,
  className,
}: {
  icon: LucideIcon
  className?: string
}) {
  return <Icon size={24} strokeWidth={1.75} absoluteStrokeWidth className={className} />
}

export function ExpandChevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={24}
      height={24}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={clsx('text-ember shrink-0 transition-transform duration-[140ms] ease-out', open && 'rotate-180')}
      aria-hidden
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}
