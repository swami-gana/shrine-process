import type { AppState, WriteAction, WriteFailure } from '../types'

const API_URL = import.meta.env.VITE_API_URL as string | undefined
const USE_MOCK = !API_URL

export const POST_HEADERS = { 'Content-Type': 'text/plain;charset=utf-8' }

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

function failure(
  action: WriteAction,
  extras: Omit<WriteFailure, 'at' | 'action'>,
): WriteFailure {
  return { at: new Date().toISOString(), action, ...extras }
}

export async function postAction(
  action: WriteAction,
  meta?: { clientId: string; seq: number },
): Promise<{ ok: boolean; reason?: string; state?: AppState; failure?: WriteFailure }> {
  if (USE_MOCK) return { ok: true }
  const payload = meta ? { ...action, clientId: meta.clientId, seq: meta.seq } : action
  try {
    const res = await fetch(API_URL!, {
      method: 'POST',
      headers: POST_HEADERS,
      body: JSON.stringify(payload),
      redirect: 'follow',
    })
    const body = await res.text()
    if (!res.ok) {
      const f = failure(action, { reachedServer: true, status: res.status, body })
      console.error('Write failed', f)
      return { ok: false, reason: 'http', failure: f }
    }
    try {
      const parsed = JSON.parse(body) as { ok: boolean; reason?: string; state?: AppState }
      if (!parsed.ok) {
        const f = failure(action, { reachedServer: true, status: res.status, body })
        console.error('Write rejected', f)
        return { ...parsed, failure: f }
      }
      return parsed
    } catch {
      const f = failure(action, { reachedServer: true, status: res.status, body })
      console.error('Write response was not JSON', f)
      return { ok: false, reason: 'parse', failure: f }
    }
  } catch (err) {
    const f = failure(action, {
      reachedServer: false,
      error: err instanceof Error ? err.message : String(err),
    })
    console.error('Write did not reach server', f)
    return { ok: false, reason: 'network', failure: f }
  }
}

export function isUsingMock(): boolean {
  return USE_MOCK
}
