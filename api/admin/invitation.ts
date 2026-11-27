import { requireAdmin } from '../../server/lib/adminAuth.js'
import { generateInvitationCode } from '../../server/lib/invitationCode.js'
import { ApiError, errorResponse, jsonResponse, readJsonBody } from '../../server/lib/http.js'
import { callRpc, statusOf } from '../../server/lib/supabase.js'

export const config = {
  runtime: 'nodejs',
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// Read-only status. Never includes the stored hash or the plaintext code.
export async function GET(request: Request): Promise<Response> {
  try {
    await requireAdmin(request, { requireOrigin: false })
    const status = await callRpc('api_get_invitation_status', {})
    return jsonResponse(status)
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const admin = await requireAdmin(request)
    const body = await readJsonBody(request)

    if (!isRecord(body)) {
      throw new ApiError(400, 'invalid_request', 'Request body must be a JSON object.')
    }

    switch (body.action) {
      case 'generate': {
        const { code, codeHash } = generateInvitationCode()
        const result = await callRpc('api_rotate_invitation_code', {
          p_code_hash: codeHash,
          p_admin_user_id: admin.id,
        })
        if (statusOf(result) !== 'updated') {
          throw new Error(`Unexpected api_rotate_invitation_code status: ${statusOf(result)}`)
        }
        // The plaintext code is returned exactly once, only to the administrator.
        return jsonResponse({ ...result, code })
      }

      case 'revoke': {
        const result = await callRpc('api_revoke_invitation_code', {
          p_admin_user_id: admin.id,
        })
        if (statusOf(result) !== 'revoked') {
          throw new Error(`Unexpected api_revoke_invitation_code status: ${statusOf(result)}`)
        }
        return jsonResponse(result)
      }

      case 'set_access': {
        if (typeof body.enabled !== 'boolean') {
          throw new ApiError(400, 'invalid_request', 'Enabled must be true or false.')
        }

        const result = await callRpc('api_set_invitation_access', {
          p_enabled: body.enabled,
          p_admin_user_id: admin.id,
        })

        if (statusOf(result) === 'code_required') {
          throw new ApiError(
            400,
            'code_required',
            'Generate an invitation code before enabling access.',
          )
        }
        if (statusOf(result) !== 'updated') {
          throw new Error(`Unexpected api_set_invitation_access status: ${statusOf(result)}`)
        }
        return jsonResponse(result)
      }

      default:
        throw new ApiError(400, 'invalid_action', 'Unknown invitation action.')
    }
  } catch (error) {
    return errorResponse(error)
  }
}
