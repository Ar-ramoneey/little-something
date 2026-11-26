export type ResponseValue = 'yes' | 'thinking' | 'no'

export interface ResponseRecord {
  response: ResponseValue
  created_at: string
  updated_at: string
}

export class ResponseApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(message: string, status: number, code: string) {
    super(message)
    this.name = 'ResponseApiError'
    this.status = status
    this.code = code
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function detailFromPayload(payload: unknown): { code: string; message: string } {
  if (!isRecord(payload) || !isRecord(payload.error)) {
    return { code: 'request_failed', message: '' }
  }

  const code = typeof payload.error.code === 'string' ? payload.error.code : 'request_failed'
  const message = typeof payload.error.message === 'string' ? payload.error.message : ''
  return { code, message }
}

const REQUEST_TIMEOUT_MS = 12000

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  if (init.signal) {
    if (init.signal.aborted) {
      controller.abort()
    } else {
      init.signal.addEventListener('abort', () => controller.abort(), { once: true })
    }
  }

  try {
    response = await fetch(path, {
      ...init,
      credentials: 'same-origin',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    })
  } catch {
    throw new ResponseApiError(
      'Unable to reach the server. Please check your connection and try again.',
      0,
      'network_error',
    )
  } finally {
    clearTimeout(timeoutId)
  }

  let payload: unknown
  try {
    const text = await response.text()
    payload = text ? JSON.parse(text) : null
  } catch {
    payload = null
  }

  if (!response.ok) {
    const detail = detailFromPayload(payload)
    throw new ResponseApiError(
      detail.message || `The request could not be completed (${response.status}).`,
      response.status,
      detail.code,
    )
  }

  if (!isRecord(payload)) {
    throw new ResponseApiError(
      'The server returned an unexpected response. Please try again.',
      response.status,
      'invalid_response_body',
    )
  }

  return payload as T
}

export function apiErrorMessage(error: unknown): string {
  if (error instanceof ResponseApiError) {
    return error.message
  }
  return 'Something went wrong. Please try again.'
}

// Creates the secure server-managed session. The code is sent only in this
// request body and is cleared from component state as soon as it is submitted.
export async function verifyInvitation(invitationCode: string): Promise<void> {
  const normalized = invitationCode.trim()
  if (!normalized) {
    throw new ResponseApiError('Please enter your invitation code.', 400, 'invitation_code_required')
  }

  await request<{ status: string }>('/api/invitation/verify', {
    method: 'POST',
    body: JSON.stringify({ invitationCode: normalized }),
  })
}

export async function submitResponse(
  response: ResponseValue,
  invitationCode?: string,
): Promise<ResponseRecord> {
  const body: Record<string, string> = { response }
  const normalizedCode = invitationCode?.trim()
  if (normalizedCode) {
    body.invitationCode = normalizedCode
  }

  return request<ResponseRecord>('/api/responses', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

// A 404 means the invitation session is valid but no answer has been recorded.
export async function getCurrentResponse(): Promise<ResponseRecord | null> {
  try {
    return await request<ResponseRecord>('/api/responses', { method: 'GET' })
  } catch (error) {
    if (error instanceof ResponseApiError && error.code === 'response_not_found') {
      return null
    }
    throw error
  }
}

export async function updateResponse(response: ResponseValue): Promise<ResponseRecord> {
  return request<ResponseRecord>('/api/responses', {
    method: 'PATCH',
    body: JSON.stringify({ response }),
  })
}
