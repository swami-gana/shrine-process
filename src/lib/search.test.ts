import { expect, it } from 'vitest'
import { searchKey } from './search'

it('matches names regardless of case, accents and extra spaces', () => {
  expect(searchKey('Swami  Prāṇaka')).toBe('swami pranaka')
  expect(searchKey('Swami Prāṇaka').includes(searchKey('PRANA'))).toBe(true)
})
