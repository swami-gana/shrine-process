export const BACKUP_NAMES = ['Maa Mukulita']

export function isBackupSeed(fullName: string): boolean {
  const key = fullName.trim().toLowerCase()
  return BACKUP_NAMES.some((name) => name.toLowerCase() === key)
}
