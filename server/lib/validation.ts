import { ApiError } from './http.js'

export const RESPONSE_VALUES = ['yes', 'thinking', 'no'] as const

export type ResponseValue = (typeof RESPONSE_VALUES)[number]

export interface ResponseRequestBody {
  response: ResponseValue
  invitationCode?: string
}

export interface InvitationCodeBody {
  invitationCode: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isResponseValue(value: unknown): value is ResponseValue {
  return typeof value === 'string' && RESPONSE_VALUES.includes(value as ResponseValue)
}

export function parseResponseRequestBody(raw: unknown): ResponseRequestBody {
  if (!isRecord(raw)) {
    throw new ApiError(400, 'invalid_request', 'Request body must be a JSON object.')
  }

  if (!isResponseValue(raw.response)) {
    throw new ApiError(
      400,
      'invalid_response',
      'Response must be one of: yes, thinking, no.',
    )
  }

  let invitationCode: string | undefined

  if (raw.invitationCode !== undefined) {
    if (typeof raw.invitationCode !== 'string') {
      throw new ApiError(400, 'invalid_request', 'Invitation code must be a string.')
    }

    const normalized = raw.invitationCode.trim()
    if (!normalized || normalized.length > 256) {
      throw new ApiError(400, 'invalid_request', 'Invitation code is invalid.')
    }

    invitationCode = normalized
  }

  return { response: raw.response, invitationCode }
}

export function parseInvitationCodeBody(raw: unknown): InvitationCodeBody {
  if (!isRecord(raw)) {
    throw new ApiError(400, 'invalid_request', 'Request body must be a JSON object.')
  }

  if (typeof raw.invitationCode !== 'string') {
    throw new ApiError(400, 'invitation_code_required', 'An invitation code is required.')
  }

  const normalized = raw.invitationCode.trim()
  if (!normalized || normalized.length > 256) {
    throw new ApiError(400, 'invalid_request', 'Invitation code is invalid.')
  }

  return { invitationCode: normalized }
}
