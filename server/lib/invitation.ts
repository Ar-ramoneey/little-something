import { getInvitationCode, getProposalId, getSessionTtlSeconds } from './env.js'
import { ApiError } from './http.js'
import { createSessionToken, sha256, verifyInvitationCode } from './security.js'
import { callRpc, statusOf } from './supabase.js'

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
  | { status: 'disabled' }
  | { status: 'invalid_request' }

interface SessionContext {
  token: string
  tokenHash: string
  ttlSeconds: number
  expiresAt: string
  rateLimitKey: string
}

function verified(session: SessionContext): InvitationSessionStart {
  return {
    status: 'verified',
    token: session.token,
    tokenHash: session.tokenHash,
    ttlSeconds: session.ttlSeconds,
  }
}

// The database-backed code is the source of truth. The environment code is
// used only while no database-backed code has been generated yet.
export async function startInvitationSession(
  invitationCode: string | undefined,
  ipHash: string,
): Promise<InvitationSessionStart> {
  if (!invitationCode) {
    return { status: 'missing_code' }
  }

  const base = createSessionToken()
  const ttlSeconds = getSessionTtlSeconds()
  const session: SessionContext = {
    token: base.token,
    tokenHash: base.tokenHash,
    ttlSeconds,
    expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
    rateLimitKey: `invite-code:${ipHash}`,
  }

  const result = await callRpc('api_verify_invitation_and_create_session', {
    p_code_hash: sha256(invitationCode),
    p_token_hash: session.tokenHash,
    p_proposal_id: getProposalId(),
    p_expires_at: session.expiresAt,
    p_rate_limit_key: session.rateLimitKey,
  })

  switch (statusOf(result)) {
    case 'created':
      return verified(session)
    case 'rate_limited':
      return { status: 'rate_limited' }
    case 'disabled':
      return { status: 'disabled' }
    case 'invalid_code':
      return { status: 'invalid_code' }
    case 'legacy_required':
      return startLegacySession(invitationCode, session)
    case 'invalid_request':
      return { status: 'invalid_request' }
    default:
      throw new Error(
        `Unexpected api_verify_invitation_and_create_session status: ${statusOf(result)}`,
      )
  }
}

async function startLegacySession(
  invitationCode: string,
  session: SessionContext,
): Promise<InvitationSessionStart> {
  let expectedCode: string
  try {
    expectedCode = getInvitationCode()
  } catch {
    return { status: 'invalid_code' }
  }

  if (!verifyInvitationCode(invitationCode, expectedCode)) {
    const allowed = await callRpc<boolean>('api_check_rate_limit', {
      p_key: session.rateLimitKey,
      p_limit: 5,
      p_window_seconds: 900,
    })
    return allowed ? { status: 'invalid_code' } : { status: 'rate_limited' }
  }

  const created = await callRpc('api_create_invitation_session', {
    p_token_hash: session.tokenHash,
    p_proposal_id: getProposalId(),
    p_expires_at: session.expiresAt,
    p_rate_limit_key: session.rateLimitKey,
  })

  switch (statusOf(created)) {
    case 'created':
      return verified(session)
    case 'rate_limited':
      return { status: 'rate_limited' }
    case 'invalid_request':
      return { status: 'invalid_request' }
    default:
      throw new Error(`Unexpected api_create_invitation_session status: ${statusOf(created)}`)
  }
}

export function invitationCodeError(status: InvitationSessionStart['status']): ApiError {
  switch (status) {
    case 'missing_code':
      return new ApiError(400, 'invitation_code_required', 'An invitation code is required.')
    case 'invalid_code':
      return new ApiError(401, 'invalid_invitation_code', 'That invitation code is not valid.')
    case 'disabled':
      return new ApiError(403, 'invitation_disabled', 'Invitation access is currently disabled.')
    case 'invalid_request':
      return new ApiError(400, 'invalid_request', 'The invitation session could not be created.')
    default:
      return new ApiError(500, 'internal_error', 'Something went wrong. Please try again.')
  }
}
