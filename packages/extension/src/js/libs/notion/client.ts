// Low-level Notion REST client for the MV3 service worker.
// Only the service worker may import this (spec: notion-connection — all
// Notion network I/O originates in the SW; the popup never calls the API).
//
// Serializes requests with ~350 ms spacing (≈3 rps), honors Retry-After on
// HTTP 429 (≤2 retries), and returns typed Results instead of throwing.

import { err, ok, Result } from './types'

export const NOTION_VERSION = '2025-09-03'
export const NOTION_API_BASE = 'https://api.notion.com/v1'

const REQUEST_SPACING_MS = 350
const MAX_RATE_LIMIT_RETRIES = 2
const DEFAULT_RETRY_AFTER_S = 1

const delay = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms))

// Serialized queue: each request starts only after the previous one finished
// plus the spacing gap. MV3-safe — plain promise chaining, no timers persisted.
let queueTail: Promise<void> = Promise.resolve()

const enqueue = <T>(task: () => Promise<T>): Promise<T> => {
  const run = queueTail.then(task)
  queueTail = run.then(
    () => delay(REQUEST_SPACING_MS),
    () => delay(REQUEST_SPACING_MS),
  )
  return run
}

const typedError = (status: number, message: string): Result<never> => {
  if (status === 401) {
    return err('invalid-token', 'Invalid or revoked Notion token', status)
  }
  if (status === 404) {
    return err(
      'not-shared',
      'Not found — is it shared with the integration?',
      status,
    )
  }
  return err('api', message || `Notion API error (HTTP ${status})`, status)
}

/**
 * Perform one Notion API request through the serialized queue.
 * `path` is relative to /v1, e.g. `/users/me`, `/search`, `/pages`.
 */
export const notionRequest = <T = unknown>(
  token: string,
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  body?: unknown,
): Promise<Result<T>> =>
  enqueue(async () => {
    for (let attempt = 0; ; attempt++) {
      let response: Response
      try {
        response = await fetch(`${NOTION_API_BASE}${path}`, {
          method,
          headers: {
            Authorization: `Bearer ${token}`,
            'Notion-Version': NOTION_VERSION,
            ...(body !== undefined
              ? { 'Content-Type': 'application/json' }
              : {}),
          },
          body: body !== undefined ? JSON.stringify(body) : undefined,
        })
      } catch (e) {
        return err(
          'network',
          `Network error: ${e instanceof Error ? e.message : String(e)}`,
        )
      }
      if (response.status === 429) {
        if (attempt >= MAX_RATE_LIMIT_RETRIES) {
          return err(
            'rate-limited',
            'Notion rate limit exceeded (retries exhausted)',
            429,
          )
        }
        const retryAfterS =
          Number(response.headers.get('Retry-After')) || DEFAULT_RETRY_AFTER_S
        await delay(retryAfterS * 1000)
        continue
      }
      let payload: unknown = null
      try {
        payload = await response.json()
      } catch {
        // Non-JSON body — fall through with null payload.
      }
      if (!response.ok) {
        const message =
          (payload as { message?: string } | null)?.message ||
          `Notion API error (HTTP ${response.status})`
        return typedError(response.status, message)
      }
      return ok(payload as T)
    }
  })
