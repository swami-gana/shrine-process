type Props = {
  lit?: boolean
  className?: string
}

export function Diya({ lit = true, className }: Props) {
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
      className={className}
      aria-hidden
    >
      {lit && (
        <path
          fill="currentColor"
          stroke="none"
          d="M12 13.2c1.35-2.1 2.45-3.55 2.45-5.35 0-1.55-1.05-2.75-2.45-3.25-1.4.5-2.45 1.7-2.45 3.25 0 1.8 1.1 3.25 2.45 5.35Z"
        />
      )}
      <path d="M4.75 14.75h14.5" />
      <path d="M4.75 14.75c.45 1.15 2.35 3.85 7.25 3.85s6.8-2.7 7.25-3.85" />
      <path d="M9.25 18.4v1.35h5.5V18.4" />
    </svg>
  )
}

export function DiyaUnlit({ className }: { className?: string }) {
  return <Diya lit={false} className={className} />
}
