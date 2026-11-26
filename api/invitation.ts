import { handleInvitationVerification } from '../server/lib/invitationEndpoint.js'

export const config = {
  runtime: 'nodejs',
}

// Backward-compatible alias. New clients should use /api/invitation/verify.
export async function POST(request: Request): Promise<Response> {
  return handleInvitationVerification(request)
}
