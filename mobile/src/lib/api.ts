import { API_URL } from './config'

/** Set by the session provider; every request sends it as a Bearer token. */
let token: string | null = null
let onUnauthorized: (() => void) | null = null
export function setApiToken(t: string | null) { token = t }
export function setOnUnauthorized(fn: (() => void) | null) { onUnauthorized = fn }

export class ApiError extends Error {
  constructor(message: string, public status: number, public data: Record<string, unknown> = {}) { super(message) }
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      Accept: 'application/json',
      ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (res.status === 401 && token) onUnauthorized?.()
  if (!res.ok) throw new ApiError((data as { error?: string; message?: string }).error || (data as { message?: string }).message || `Request failed (${res.status})`, res.status, data as Record<string, unknown>)
  return data as T
}
