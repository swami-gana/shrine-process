type Props = {
  emoji: string
  checked: boolean
  onToggle: () => void
}

export function IconToggle({ emoji, checked, onToggle }: Props) {
  return (
    <button
      type="button"
      onClick={onToggle}
      onPointerDown={(e) => e.stopPropagation()}
      className="relative w-9 h-9 flex items-center justify-center text-lg pressable"
      aria-pressed={checked}
    >
      {emoji}
      {checked && (
        <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-active-stroke text-white text-[9px] rounded-full flex items-center justify-center badge-pop">
          ✓
        </span>
      )}
    </button>
  )
}
