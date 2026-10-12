import clsx from 'clsx'

type Props = {
  /** CR-125: flame filled gold when the person is on the backup list. */
  lit?: boolean
  size?: number
  className?: string
}

/** CR-124: custom glyph 4 — a slender handle, a shallow cup, a teardrop flame. */
export function AratiStick({ lit = false, size = 24, className }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={clsx('shrink-0', className)}
      aria-hidden
    >
      <path d="M12 14.5V22" />
      <path d="M7.5 11.5h9c-.6 1.9-2.4 3-4.5 3s-3.9-1.1-4.5-3Z" />
      <path
        d="M12 2.5c1.7 2 2.6 3.6 2.6 5 0 1.5-1.2 2.5-2.6 2.5s-2.6-1-2.6-2.5c0-1.4.9-3 2.6-5Z"
        className={lit ? 'text-gold' : undefined}
        fill={lit ? 'currentColor' : 'none'}
        stroke="currentColor"
      />
    </svg>
  )
}
