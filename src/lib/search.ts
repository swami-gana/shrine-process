/** Case- and accent-insensitive, so "pranaka" finds Swami Prāṇaka. */
export function searchKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}
