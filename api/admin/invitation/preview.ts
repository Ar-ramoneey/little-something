import { requireAdmin } from '../../../server/lib/adminAuth.js'
import { getAppOrigin } from '../../../server/lib/env.js'
import { generateInvitationCode } from '../../../server/lib/invitationCode.js'
import { buildInvitationEmail } from '../../../server/lib/invitationEmail.js'
import { ApiError, errorResponse, jsonResponse, readJsonBody } from '../../../server/lib/http.js'
import { callRpc, statusOf } from '../../../server/lib/supabase.js'

export const config = {
  runtime: 'nodejs',
}

const EMAIL_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// Generates a code and returns an exact preview of the email that would be
// sent. This endpoint never sends email; delivery requires a separate explicit
// POST to /api/admin/invitation/send.
export async function POST(request: Request): Promise<Response> {
  try {
    const admin = await requireAdmin(request)
    const body = await readJsonBody(request)

    if (!isRecord(body)) {
      throw new ApiError(400, 'invalid_request', 'Request body must be a JSON object.')
    }
    if (typeof body.email !== 'string' || !EMAIL_PATTERN.test(body.email.trim())) {
      throw new ApiError(400, 'invalid_email', 'Enter a valid recipient email address.')
    }

    const email = body.email.trim()
    const { code, codeHash } = generateInvitationCode()
    const result = await callRpc('api_rotate_invitation_code', {
      p_code_hash: codeHash,
      p_admin_user_id: admin.id,
    })
    if (statusOf(result) !== 'updated') {
      throw new Error(`Unexpected api_rotate_invitation_code status: ${statusOf(result)}`)
    }

    const message = buildInvitationEmail(email, code)
    return jsonResponse({
      status: 'preview',
      code,
      to: message.to,
      subject: message.subject,
      websiteUrl: getAppOrigin(),
      body: message.text,
    })
  } catch (error) {
    return errorResponse(error)
  }
}
