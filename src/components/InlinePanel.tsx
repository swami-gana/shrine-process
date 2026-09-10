import clsx from 'clsx'

type PanelItem = {
  label: string
  onClick?: () => void
  disabled?: boolean
  dividerBefore?: boolean
}

type Props = {
  items: PanelItem[]
  onClose: () => void
}

export function InlinePanel({ items, onClose }: Props) {
  return (
    <div className="panel-enter overflow-hidden border-t border-hairline bg-card">
      {items.map((item, i) => (
        <div key={i}>
          {item.dividerBefore && <div className="border-t-2 border-hairline" />}
          <button
            type="button"
            disabled={item.disabled}
            onClick={() => {
              if (!item.disabled && item.onClick) {
                item.onClick()
                onClose()
              }
            }}
            className={clsx(
              'w-full text-left px-4 py-3 text-[15px] pressable',
              item.disabled ? 'text-secondary opacity-50' : 'text-text active:bg-bg',
            )}
          >
            {item.label}
          </button>
        </div>
      ))}
    </div>
  )
}
