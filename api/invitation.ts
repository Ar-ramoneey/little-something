import { handleInvitationVerification } from '../server/lib/invitationEndpoint'

export const config = {
  runtime: 'nodejs22.x',
}

// Backward-compatible alias. New clients should use /api/invitation/verify.
export default handleInvitationVerification
