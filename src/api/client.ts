import type { AppState, WriteAction } from '../types'

const API_URL = import.meta.env.VITE_API_URL as string | undefined
const USE_MOCK = !API_URL

export async function fetchState(): Promise<AppState | null> {
  if (USE_MOCK) return null
  try {
    const res = await fetch(`${API_URL}?action=state`)
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

export async function postAction(action: WriteAction): Promise<{ ok: boolean; reason?: string; state?: AppState }> {
  if (USE_MOCK) return { ok: true }
  try {
    const res = await fetch(API_URL!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(action),
    })
    return res.json()
  } catch {
    return { ok: false, reason: 'network' }
  }
}

export function isUsingMock(): boolean {
  return USE_MOCK
}
