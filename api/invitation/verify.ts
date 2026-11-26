import { handleInvitationVerification } from '../../server/lib/invitationEndpoint'

export const config = {
  runtime: 'nodejs22.x',
}

// Canonical invitation verification endpoint: POST /api/invitation/verify.
export default handleInvitationVerification
