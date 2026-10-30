import { describe, expect, it } from 'vitest'
import type { Template } from '../types'
import { DEFAULT_TEMPLATES, withDefaultTemplates } from './templates'

describe('withDefaultTemplates', () => {
  it('keeps the sheet wording and fills in any message the sheet did not send', () => {
    const sheet: Template[] = [{ ...DEFAULT_TEMPLATES[0], body: { en: 'From the sheet', ta: '' } }]
    const merged = withDefaultTemplates(sheet)
    expect(merged.find((t) => t.id === 'heads_up')?.body.en).toBe('From the sheet')
    expect(merged.map((t) => t.id).sort()).toEqual(
      ['availability_check', 'availability_request', 'heads_up', 'kit_reminder'],
    )
  })

  it('falls back to every built-in message when the sheet sends none', () => {
    expect(withDefaultTemplates(undefined)).toHaveLength(DEFAULT_TEMPLATES.length)
    expect(withDefaultTemplates([])).toHaveLength(DEFAULT_TEMPLATES.length)
  })
})
