import { describe, expect, it } from 'vitest'
import type { Person } from '../types'
import { getPersonById, personStatusLine, sortNextUp } from './derived'

function person(partial: Partial<Person> & Pick<Person, 'name'>): Person {
  return {
    id: partial.id ?? partial.name,
    title: partial.title ?? 'Swami',
    name: partial.name,
    fullName: partial.fullName ?? `Swami ${partial.name}`,
    available: partial.available ?? true,
    backup: partial.backup ?? false,
    email: null,
    phone: null,
    whatsapp: null,
    language: null,
    lastDone: partial.lastDone ?? null,
    neverDone: partial.neverDone ?? false,
  }
}

describe('personStatusLine', () => {
  it('labels not available first, even if never done', () => {
    expect(
      personStatusLine(person({ name: 'Ahi', title: 'Maa', fullName: 'Maa Ahi', available: false, neverDone: true })),
    ).toBe('Not available')
  })

  it('labels last done with a day count when lastDone is set', () => {
    expect(
      personStatusLine(person({ name: 'Yastir', lastDone: '2026-09-01', neverDone: true })),
    ).toMatch(/^Last done \d+ days ago$/)
  })

  it('labels yet to do only when neverDone and no lastDone', () => {
    expect(personStatusLine(person({ name: 'Yastir', neverDone: true }))).toBe('Yet to do')
  })

  it('labels done before with no date', () => {
    expect(personStatusLine(person({ name: 'Mukula', neverDone: false, lastDone: null }))).toBe('Done before')
    expect(personStatusLine(person({ name: 'Mukula' }))).not.toMatch(/\d/)
  })

  it('appends backup to whichever label applies', () => {
    expect(personStatusLine(person({ name: 'A', available: false, backup: true }))).toBe('Not available (backup)')
    expect(personStatusLine(person({ name: 'B', neverDone: true, backup: true }))).toBe('Yet to do (backup)')
    expect(personStatusLine(person({ name: 'C', backup: true }))).toBe('Done before (backup)')
  })
})

describe('sortNextUp', () => {
  it('orders yet to do, then done before, then last done longest ago', () => {
    const sorted = sortNextUp([
      person({ name: 'Zed', lastDone: '2026-09-10' }),
      person({ name: 'Ann', neverDone: false }),
      person({ name: 'Bo', neverDone: true }),
      person({ name: 'Cy', lastDone: '2026-08-01' }),
      person({ name: 'Al', neverDone: true }),
      person({ name: 'Hidden', available: false, neverDone: true }),
    ])
    expect(sorted.map((p) => p.name)).toEqual(['Al', 'Bo', 'Ann', 'Cy', 'Zed'])
  })
})

describe('getPersonById', () => {
  it('matches a numeric sheet personId to a string people id', () => {
    const roster = [person({ id: '113', name: 'Mugdha', title: 'Maa', fullName: 'Maa Mugdha' })]
    expect(getPersonById(roster, 113 as unknown as string)?.fullName).toBe('Maa Mugdha')
    expect(getPersonById(roster, '113')?.fullName).toBe('Maa Mugdha')
  })
})
