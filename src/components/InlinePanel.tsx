import type { ReactNode } from 'react'
import { Copy } from 'lucide-react'
import clsx from 'clsx'

export type PanelRow = {
  icon: ReactNode
  label: string
  copy?: boolean
  onClick: () => void
}

export type PanelSection = {
  heading?: string
  rows: PanelRow[]
}

type Props = {
  sections: PanelSection[]
}

export function InlinePanel({ sections }: Props) {
  return (
    <div data-panel className="panel-enter mx-3 mb-3 rounded-[12px] bg-surface-2 border-l-2 border-ember overflow-hidden">
      {sections.map((section, si) => (
        <div key={si} className={clsx(si > 0 && 'border-t-2 border-hairline-2')}>
          {section.heading && (
            <div className="px-4 pt-3 pb-1 text-[11px] leading-[1.2] font-semibold tracking-[0.06em] text-text-3">
              {section.heading}
            </div>
          )}
          {section.rows.map((row) => (
            <button
              key={row.label}
              type="button"
              onClick={row.onClick}
              className="w-full flex items-center gap-3 px-4 py-3 text-left text-[15px] leading-[1.3] text-text-1 pressable active:bg-surface-3"
            >
              <span className="text-text-2 shrink-0 w-6 h-6 flex items-center justify-center">{row.icon}</span>
              <span className="flex-1 min-w-0">{row.label}</span>
              {row.copy && (
                <Copy size={24} strokeWidth={1.75} absoluteStrokeWidth className="text-text-2 shrink-0" />
              )}
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}
