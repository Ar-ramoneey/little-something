import { ApiError } from './http.js'
import { assertAllowedOrigin } from './security.js'
import { getAdminClient } from './supabase.js'

export interface VerifiedAdmin {
  id: string
  email: string
}

// Verifies the browser's Supabase access token with Supabase Auth on every
// admin request. RLS and the mutating RPCs re-check the trusted role claim.
export async function requireAdmin(
  request: Request,
  { requireOrigin = true }: { requireOrigin?: boolean } = {},
): Promise<VerifiedAdmin> {
  // GET requests are read-only; mutations also require a same-origin Origin.
  if (requireOrigin) assertAllowedOrigin(request)

  const authorization = request.headers.get('authorization') ?? ''
  const match = /^Bearer\s+(.+)$/i.exec(authorization.trim())
  if (!match) {
    throw new ApiError(401, 'unauthorized', 'Admin sign-in is required.')
  }

  const token = match[1].trim()
  const { data, error } = await getAdminClient().auth.getUser(token)
  if (error || !data?.user) {
    throw new ApiError(401, 'unauthorized', 'Your admin session has expired. Please sign in again.')
  }

  const user = data.user
  if (user.app_metadata?.role !== 'admin') {
    throw new ApiError(403, 'forbidden', 'Administrator access is required.')
  }

  return { id: user.id, email: typeof user.email === 'string' ? user.email : '' }
}
