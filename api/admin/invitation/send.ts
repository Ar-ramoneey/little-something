import { requireAdmin } from '../../../server/lib/adminAuth.js'
import { isActiveInvitationCode } from '../../../server/lib/invitationCode.js'
import { buildInvitationEmail, sendInvitationEmail } from '../../../server/lib/invitationEmail.js'
import {
  ApiError,
  errorResponse,
  jsonResponse,
  rateLimitedResponse,
  readJsonBody,
} from '../../../server/lib/http.js'
import { callRpc } from '../../../server/lib/supabase.js'

export const config = {
  runtime: 'nodejs',
}

const EMAIL_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function recipientDomain(email: string): string {
  const at = email.lastIndexOf('@')
  return at === -1 ? '' : email.slice(at + 1).toLowerCase()
}

export async function POST(request: Request): Promise<Response> {
  try {
    const admin = await requireAdmin(request)

    const allowed = await callRpc<boolean>('api_check_rate_limit', {
      p_key: `admin-invite-send:${admin.id}`,
      p_limit: 10,
      p_window_seconds: 900,
    })
    if (!allowed) return rateLimitedResponse()

    const body = await readJsonBody(request)
    if (!isRecord(body)) {
      throw new ApiError(400, 'invalid_request', 'Request body must be a JSON object.')
    }

    if (typeof body.email !== 'string' || !EMAIL_PATTERN.test(body.email.trim())) {
      throw new ApiError(400, 'invalid_email', 'Enter a valid recipient email address.')
    }
    if (typeof body.code !== 'string' || !body.code.trim() || body.code.trim().length > 256) {
      throw new ApiError(400, 'invalid_code', 'Generate a valid invitation code before sending.')
    }

    const email = body.email.trim()
    const code = body.code.trim()

    // Never email a code that can no longer be used to enter the site.
    if (!(await isActiveInvitationCode(code))) {
      throw new ApiError(
        400,
        'code_not_active',
        'That code is no longer active. Generate a new code before sending.',
      )
    }

    const message = buildInvitationEmail(email, code)

    try {
      await sendInvitationEmail(message)
    } catch (error) {
      await callRpc('api_log_admin_event', {
        p_event_type: 'invitation_email_failed',
        p_admin_user_id: admin.id,
        p_details: { recipient_domain: recipientDomain(email) },
      }).catch(() => undefined)
      throw error
    }

    await callRpc('api_log_admin_event', {
      p_event_type: 'invitation_email_sent',
      p_admin_user_id: admin.id,
      p_details: { recipient_domain: recipientDomain(email) },
    })

    return jsonResponse({ status: 'sent' })
  } catch (error) {
    return errorResponse(error)
  }
}
