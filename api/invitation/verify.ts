import { handleInvitationVerification } from '../../server/lib/invitationEndpoint.js'

export const config = {
  runtime: 'nodejs',
}

// Canonical invitation verification endpoint: POST /api/invitation/verify.
// Vercel Functions must use named method exports (or a default object with a
// fetch method); a bare default function is not invoked by the Node runtime.
export async function POST(request: Request): Promise<Response> {
  return handleInvitationVerification(request)
}
