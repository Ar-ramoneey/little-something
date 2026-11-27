import { requireAdmin } from '../../server/lib/adminAuth.js'
import { getProposalId } from '../../server/lib/env.js'
import { generateInvitationCode } from '../../server/lib/invitationCode.js'
import { ApiError, errorResponse, jsonResponse, readJsonBody } from '../../server/lib/http.js'
import { callRpc, statusOf } from '../../server/lib/supabase.js'

export const config = {
  runtime: 'nodejs',
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// Counts only, so the dashboard can show exactly what a reset would delete.
export async function GET(request: Request): Promise<Response> {
  try {
    await requireAdmin(request, { requireOrigin: false })
    const counts = await callRpc('api_get_reset_preview', { p_proposal_id: getProposalId() })
    return jsonResponse({ counts })
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
    if (body.confirmation !== 'RESET') {
      throw new ApiError(
        400,
        'confirmation_required',
        'Type RESET to confirm the proposal reset.',
      )
    }
    if (body.rotateCode !== undefined && typeof body.rotateCode !== 'boolean') {
      throw new ApiError(400, 'invalid_request', 'Rotate code must be true or false.')
    }

    // Rotation is opt-in only; a plain reset leaves invitation settings alone.
    let code: string | undefined
    let codeHash: string | undefined
    if (body.rotateCode === true) {
      const generated = generateInvitationCode()
      code = generated.code
      codeHash = generated.codeHash
    }

    const result = await callRpc('api_reset_proposal_data', {
      p_admin_user_id: admin.id,
      p_proposal_id: getProposalId(),
      p_new_code_hash: codeHash ?? null,
    })

    if (statusOf(result) !== 'reset') {
      throw new Error(`Unexpected api_reset_proposal_data status: ${statusOf(result)}`)
    }

    return jsonResponse({ ...result, ...(code ? { code } : {}) })
  } catch (error) {
    return errorResponse(error)
  }
}
