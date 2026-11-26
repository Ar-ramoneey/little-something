import { getInvitationCode, getProposalId, getSessionTtlSeconds } from './env'
import { ApiError } from './http'
import { createSessionToken, verifyInvitationCode } from './security'
import { callRpc, statusOf } from './supabase'

export type InvitationSessionStart =
  | {
      status: 'verified'
      token: string
      tokenHash: string
      ttlSeconds: number
    }
  | { status: 'missing_code' }
  | { status: 'invalid_code' }
  | { status: 'rate_limited' }
  | { status: 'invalid_request' }

// Verifies the code without ever returning it or persisting it. The browser
// receives only the opaque session token in an HTTP-only cookie.
export async function startInvitationSession(
  invitationCode: string | undefined,
  ipHash: string,
): Promise<InvitationSessionStart> {
  if (!invitationCode) {
    return { status: 'missing_code' }
  }

  const expectedCode = getInvitationCode()
  if (!verifyInvitationCode(invitationCode, expectedCode)) {
    const allowed = await callRpc<boolean>('api_check_rate_limit', {
      p_key: `invite-code:${ipHash}`,
      p_limit: 5,
      p_window_seconds: 900,
    })

    if (!allowed) {
      return { status: 'rate_limited' }
    }

    return { status: 'invalid_code' }
  }

  const session = createSessionToken()
  const ttlSeconds = getSessionTtlSeconds()
  const created = await callRpc('api_create_invitation_session', {
    p_token_hash: session.tokenHash,
    p_proposal_id: getProposalId(),
    p_expires_at: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
    p_rate_limit_key: `invite-code:${ipHash}`,
  })

  if (statusOf(created) === 'rate_limited') {
    return { status: 'rate_limited' }
  }

  if (statusOf(created) === 'invalid_request') {
    return { status: 'invalid_request' }
  }

  if (statusOf(created) !== 'created') {
    throw new Error(`Unexpected api_create_invitation_session status: ${statusOf(created)}`)
  }

  return {
    status: 'verified',
    token: session.token,
    tokenHash: session.tokenHash,
    ttlSeconds,
  }
}

export function invitationCodeError(status: InvitationSessionStart['status']): ApiError {
  switch (status) {
    case 'missing_code':
      return new ApiError(400, 'invitation_code_required', 'An invitation code is required.')
    case 'invalid_code':
      return new ApiError(401, 'invalid_invitation_code', 'That invitation code is not valid.')
    case 'invalid_request':
      return new ApiError(400, 'invalid_request', 'The invitation session could not be created.')
    default:
      return new ApiError(500, 'internal_error', 'Something went wrong. Please try again.')
  }
}
