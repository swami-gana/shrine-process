import { describe, expect, it } from 'vitest'
import { SLOT_COLORS, contrastRatio } from './contrast'

describe('slot state contrast', () => {
  for (const [state, { fill, text }] of Object.entries(SLOT_COLORS)) {
    it(`${state} text clears 4.5:1 against fill`, () => {
      expect(contrastRatio(fill, text)).toBeGreaterThanOrEqual(4.5)
    })
  }
})
