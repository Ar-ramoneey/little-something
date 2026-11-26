import { handleInvitationVerification } from '../../server/lib/invitationEndpoint.js'

export const config = {
  runtime: 'nodejs',
}

// Canonical invitation verification endpoint: POST /api/invitation/verify.
export default handleInvitationVerification
