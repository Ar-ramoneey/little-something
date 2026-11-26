import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { getAllowedOrigins, getSessionSecret, SESSION_COOKIE_NAME } from './env.js'
import { ApiError } from './http.js'

const HEX_SHA256 = /^[0-9a-f]{64}$/

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function safeEqualHex(a: string, b: string): boolean {
  if (!HEX_SHA256.test(a) || !HEX_SHA256.test(b)) {
    return false
  }

  return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'))
}

export function verifyInvitationCode(provided: string, expected: string): boolean {
  return safeEqualHex(sha256(provided), sha256(expected))
}

export function sessionTokenHash(token: string): string {
  return createHmac('sha256', getSessionSecret()).update(token).digest('hex')
}

export function createSessionToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString('base64url')
  return { token, tokenHash: sessionTokenHash(token) }
}

export function getClientIpHash(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const firstForwarded = forwarded?.split(',')[0]?.trim()
  const ip = firstForwarded || request.headers.get('x-real-ip')?.trim() || 'unknown'
  return sha256(`roqeebah-invitation:${ip}`)
}

export function assertAllowedOrigin(request: Request): void {
  const origin = request.headers.get('origin')
  if (!origin) {
    throw new ApiError(403, 'origin_required', 'Request origin is required.')
  }

  let normalized: string
  try {
    normalized = new URL(origin).origin
  } catch {
    throw new ApiError(403, 'origin_not_allowed', 'Request origin is not allowed.')
  }

  if (!getAllowedOrigins().includes(normalized)) {
    throw new ApiError(403, 'origin_not_allowed', 'Request origin is not allowed.')
  }
}

export function readSessionToken(request: Request): string | null {
  const cookieHeader = request.headers.get('cookie')
  if (!cookieHeader) {
    return null
  }

  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=')
    if (separator === -1) continue

    const name = part.slice(0, separator).trim()
    if (name !== SESSION_COOKIE_NAME) continue

    try {
      return decodeURIComponent(part.slice(separator + 1).trim())
    } catch {
      return null
    }
  }

  return null
}

export function sessionCookie(token: string, maxAgeSeconds: number): string {
  return [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    `Max-Age=${maxAgeSeconds}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Strict',
  ].join('; ')
}

export function clearSessionCookie(): string {
  return [
    `${SESSION_COOKIE_NAME}=`,
    'Max-Age=0',
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Strict',
  ].join('; ')
}
