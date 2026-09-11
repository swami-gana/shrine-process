/** Spec fills and on-fill text. Text may be lightened if contrast fails 4.5:1. */
export const SLOT_COLORS: Record<
  'tbd' | 'assigned' | 'confirmed' | 'kit' | 'done' | 'missed',
  { fill: string; text: string }
> = {
  tbd: { fill: '#221A18', text: '#A89890' },
  assigned: { fill: '#3E2113', text: '#F0D9CB' },
  confirmed: { fill: '#5E2F0F', text: '#FBE3CE' },
  kit: { fill: '#7E4A10', text: '#FFEFD6' },
  done: { fill: '#2C5B3E', text: '#D8EFDF' },
  missed: { fill: '#8E1B12', text: '#FFDCD6' },
}

function srgbChannel(c: number): number {
  const s = c / 255
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

export function relativeLuminance(hex: string): number {
  const h = hex.replace('#', '')
  const r = srgbChannel(parseInt(h.slice(0, 2), 16))
  const g = srgbChannel(parseInt(h.slice(2, 4), 16))
  const b = srgbChannel(parseInt(h.slice(4, 6), 16))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrastRatio(hexA: string, hexB: string): number {
  const a = relativeLuminance(hexA)
  const b = relativeLuminance(hexB)
  const lighter = Math.max(a, b)
  const darker = Math.min(a, b)
  return (lighter + 0.05) / (darker + 0.05)
}
