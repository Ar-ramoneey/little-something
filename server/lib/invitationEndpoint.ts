import { errorResponse, jsonResponse, rateLimitedResponse, readJsonBody } from './http'
import { invitationCodeError, startInvitationSession } from './invitation'
import { assertAllowedOrigin, getClientIpHash, sessionCookie } from './security'
import { parseInvitationCodeBody } from './validation'

// Shared handler for the canonical /api/invitation/verify route and its
// backward-compatible /api/invitation alias. It only validates the code and
// creates the server-managed HTTP-only session cookie; it never submits a
// response, sends email, or returns the invitation code.
export async function handleInvitationVerification(request: Request): Promise<Response> {
  try {
    if (request.method !== 'POST') {
      return jsonResponse(
        {
          error: {
            code: 'method_not_allowed',
            message: 'Method not allowed.',
          },
        },
        405,
        { allow: 'POST' },
      )
    }

    assertAllowedOrigin(request)

    const { invitationCode } = parseInvitationCodeBody(await readJsonBody(request))
    const result = await startInvitationSession(invitationCode, getClientIpHash(request))

    if (result.status === 'rate_limited') {
      return rateLimitedResponse()
    }

    if (result.status !== 'verified') {
      throw invitationCodeError(result.status)
    }

    const response = jsonResponse({ status: 'verified' })
    response.headers.set('set-cookie', sessionCookie(result.token, result.ttlSeconds))
    return response
  } catch (error) {
    return errorResponse(error)
  }
}
