import { getBrowserSupabase } from '../lib/supabaseClient'

export interface InvitationStatus {
  enabled: boolean
  initialized: boolean
  status: 'active' | 'disabled' | 'not_initialized'
  created_at: string
  updated_at: string
  revoked_at: string | null
}

export interface InvitationActionResult {
  status: string
  updated_at?: string
  sessions_revoked?: number
  enabled?: boolean
  code?: string
}

export interface ResetCounts {
  responses: number
  history: number
  notifications: number
  sessions: number
  rate_limits: number
}

export interface ResetResult {
  status: string
  responses_deleted: number
  history_deleted: number
  notifications_deleted: number
  sessions_deleted: number
  rate_limits_deleted: number
  code_rotated: boolean
  code?: string
}

export interface InvitationPreview {
  status: 'preview'
  code: string
  to: string
  subject: string
  websiteUrl: string
  body: string
}

export interface SendInvitationResult {
  status: 'sent'
}

export class AdminApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(message: string, status: number, code: string) {
    super(message)
    this.name = 'AdminApiError'
    this.status = status
    this.code = code
  }
}

export function adminErrorMessage(error: unknown): string {
  if (error instanceof AdminApiError) return error.message
  return 'Something went wrong. Please try again.'
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

const REQUEST_TIMEOUT_MS = 15000

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const client = getBrowserSupabase()
  if (!client) {
    throw new AdminApiError('Supabase browser configuration is missing.', 0, 'not_configured')
  }

  const { data } = await client.auth.getSession()
  const token = data.session?.access_token
  if (!token) {
    throw new AdminApiError('Please sign in again.', 401, 'unauthorized')
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  let response: Response
  try {
    response = await fetch(path, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    })
  } catch {
    throw new AdminApiError(
      'Unable to reach the server. Please check your connection and try again.',
      0,
      'network_error',
    )
  } finally {
    clearTimeout(timer)
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
    throw new AdminApiError(
      detail.message || `The request could not be completed (${response.status}).`,
      response.status,
      detail.code,
    )
  }

  if (!isRecord(payload)) {
    throw new AdminApiError(
      'The server returned an unexpected response. Please try again.',
      response.status,
      'invalid_response_body',
    )
  }

  return payload as T
}

export function getInvitationStatus(): Promise<InvitationStatus> {
  return request<InvitationStatus>('/api/admin/invitation', { method: 'GET' })
}

export function updateInvitation(
  action: 'generate' | 'revoke' | 'set_access',
  enabled?: boolean,
): Promise<InvitationActionResult> {
  return request<InvitationActionResult>('/api/admin/invitation', {
    method: 'POST',
    body: JSON.stringify({ action, ...(enabled === undefined ? {} : { enabled }) }),
  })
}

export function getResetPreview(): Promise<ResetCounts> {
  return request<{ counts: ResetCounts }>('/api/admin/reset', { method: 'GET' }).then(
    (payload) => payload.counts,
  )
}

export function resetProposal(rotateCode: boolean): Promise<ResetResult> {
  return request<ResetResult>('/api/admin/reset', {
    method: 'POST',
    body: JSON.stringify({ confirmation: 'RESET', rotateCode }),
  })
}

export function previewInvitation(email: string): Promise<InvitationPreview> {
  return request<InvitationPreview>('/api/admin/invitation/preview', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export function sendInvitation(email: string, code: string): Promise<SendInvitationResult> {
  return request<SendInvitationResult>('/api/admin/invitation/send', {
    method: 'POST',
    body: JSON.stringify({ email, code }),
  })
}
