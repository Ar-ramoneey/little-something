import { getSessionTtlSeconds } from '../server/lib/env'
import {
  ApiError,
  errorResponse,
  jsonResponse,
  rateLimitedResponse,
  readJsonBody,
  unauthorizedResponse,
} from '../server/lib/http'
import {
  assertAllowedOrigin,
  clearSessionCookie,
  getClientIpHash,
  readSessionToken,
  sessionCookie,
  sessionTokenHash,
} from '../server/lib/security'
import { invitationCodeError, startInvitationSession } from '../server/lib/invitation'
import { sendPendingNotifications } from '../server/lib/notifications'
import { callRpc, statusOf, type RpcResult } from '../server/lib/supabase'
import { parseResponseRequestBody } from '../server/lib/validation'

export const config = {
  runtime: 'nodejs',
}

function withCookie(response: Response, cookie: string): Response {
  response.headers.set('set-cookie', cookie)
  return response
}

function responsePayload(result: RpcResult): Record<string, unknown> {
  return {
    response: result.response,
    created_at: result.created_at,
    updated_at: result.updated_at,
  }
}

async function dispatchNotificationsSafely(): Promise<void> {
  try {
    await sendPendingNotifications()
  } catch (error) {
    console.error('[notifications] dispatch failed', {
      error: error instanceof Error ? error.message.slice(0, 500) : 'Unknown error',
    })
  }
}

async function submitResultResponseWithNotifications(
  result: RpcResult,
  cookie: string,
): Promise<Response> {
  if (statusOf(result) === 'created') {
    await dispatchNotificationsSafely()
  }
  return withCookie(submitResultResponse(result), cookie)
}

function submitResultResponse(result: RpcResult): Response {
  switch (statusOf(result)) {
    case 'created':
      return jsonResponse(responsePayload(result), 201)
    case 'conflict':
      return jsonResponse(
        {
          error: {
            code: 'response_exists',
            message: 'A response has already been submitted for this invitation.',
          },
        },
        409,
      )
    case 'rate_limited':
      return rateLimitedResponse()
    case 'unauthorized':
      return unauthorizedResponse()
    case 'invalid_response':
      return jsonResponse(
        {
          error: {
            code: 'invalid_response',
            message: 'Response must be one of: yes, thinking, no.',
          },
        },
        400,
      )
    default:
      throw new Error(`Unexpected api_submit_response status: ${statusOf(result)}`)
  }
}

async function handleGet(request: Request): Promise<Response> {
  const token = readSessionToken(request)
  if (!token) {
    return unauthorizedResponse()
  }

  const ipHash = getClientIpHash(request)
  const result = await callRpc('api_get_response', {
    p_token_hash: sessionTokenHash(token),
    p_rate_limit_key: `response-read:${ipHash}`,
  })

  switch (statusOf(result)) {
    case 'ok':
      return jsonResponse(responsePayload(result))
    case 'not_found':
      return jsonResponse(
        {
          error: {
            code: 'response_not_found',
            message: 'No response has been submitted yet.',
          },
        },
        404,
      )
    case 'rate_limited':
      return rateLimitedResponse()
    case 'unauthorized':
      return unauthorizedResponse(clearSessionCookie())
    default:
      throw new Error(`Unexpected api_get_response status: ${statusOf(result)}`)
  }
}

async function handlePost(request: Request): Promise<Response> {
  assertAllowedOrigin(request)

  const body = parseResponseRequestBody(await readJsonBody(request))
  const ipHash = getClientIpHash(request)
  const writeRateLimitKey = `response-write:${ipHash}`

  const token = readSessionToken(request)
  let hadInvalidSession = false

  if (token) {
    const existingResult = await callRpc('api_submit_response', {
      p_token_hash: sessionTokenHash(token),
      p_response: body.response,
      p_rate_limit_key: writeRateLimitKey,
    })

    if (statusOf(existingResult) !== 'unauthorized') {
      const ttl = getSessionTtlSeconds()
      return await submitResultResponseWithNotifications(
        existingResult,
        sessionCookie(token, ttl),
      )
    }

    hadInvalidSession = true
  }

  const sessionResult = await startInvitationSession(body.invitationCode, ipHash)

  if (sessionResult.status === 'missing_code') {
    if (hadInvalidSession) {
      return unauthorizedResponse(clearSessionCookie())
    }

    throw new ApiError(
      400,
      'invitation_code_required',
      'An invitation code is required to start a session.',
    )
  }

  if (sessionResult.status === 'rate_limited') {
    return rateLimitedResponse()
  }

  if (sessionResult.status !== 'verified') {
    throw invitationCodeError(sessionResult.status)
  }

  const finalResult = await callRpc('api_submit_response', {
    p_token_hash: sessionResult.tokenHash,
    p_response: body.response,
    p_rate_limit_key: writeRateLimitKey,
  })

  return await submitResultResponseWithNotifications(
    finalResult,
    sessionCookie(sessionResult.token, sessionResult.ttlSeconds),
  )
}

async function handlePatch(request: Request): Promise<Response> {
  assertAllowedOrigin(request)

  const token = readSessionToken(request)
  if (!token) {
    return unauthorizedResponse()
  }

  const body = parseResponseRequestBody(await readJsonBody(request))
  const ipHash = getClientIpHash(request)

  const result = await callRpc('api_update_response', {
    p_token_hash: sessionTokenHash(token),
    p_response: body.response,
    p_rate_limit_key: `response-write:${ipHash}`,
  })

  const ttl = getSessionTtlSeconds()
  const cookie = sessionCookie(token, ttl)

  switch (statusOf(result)) {
    case 'updated':
      await dispatchNotificationsSafely()
      return withCookie(jsonResponse(responsePayload(result)), cookie)
    case 'unchanged':
      return withCookie(jsonResponse(responsePayload(result)), cookie)
    case 'not_found':
      return withCookie(
        jsonResponse(
          {
            error: {
              code: 'response_not_found',
              message: 'Submit an initial response before changing it.',
            },
          },
          409,
        ),
        cookie,
      )
    case 'rate_limited':
      return withCookie(rateLimitedResponse(), cookie)
    case 'unauthorized':
      return unauthorizedResponse(clearSessionCookie())
    case 'invalid_response':
      return jsonResponse(
        {
          error: {
            code: 'invalid_response',
            message: 'Response must be one of: yes, thinking, no.',
          },
        },
        400,
      )
    default:
      throw new Error(`Unexpected api_update_response status: ${statusOf(result)}`)
  }
}

export default async function handler(request: Request): Promise<Response> {
  try {
    switch (request.method) {
      case 'GET':
        return await handleGet(request)
      case 'POST':
        return await handlePost(request)
      case 'PATCH':
        return await handlePatch(request)
      default:
        return jsonResponse(
          {
            error: {
              code: 'method_not_allowed',
              message: 'Method not allowed.',
            },
          },
          405,
          { allow: 'GET, POST, PATCH' },
        )
    }
  } catch (error) {
    return errorResponse(error)
  }
}
