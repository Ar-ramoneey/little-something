import { randomBytes } from 'node:crypto'
import { getInvitationCode } from './env.js'
import { sha256, verifyInvitationCode } from './security.js'
import { callRpc } from './supabase.js'

// 192 bits of randomness. The prefix only makes the code easy to recognise;
// it is not a secret. The plaintext is returned once and never stored.
export function generateInvitationCode(): { code: string; codeHash: string } {
  const code = `ROQ-${randomBytes(24).toString('base64url')}`
  return { code, codeHash: sha256(code) }
}

// A code may only be emailed if it is currently usable. During the temporary
// bootstrap period (no database-backed code yet) the environment code is the
// only valid code. After a database-backed code exists, the environment code
// is never accepted, so rotation reliably invalidates it.
export async function isActiveInvitationCode(code: string): Promise<boolean> {
  const codeHash = sha256(code)

  const active = await callRpc<boolean>('api_is_active_invitation_code', {
    p_code_hash: codeHash,
  })
  if (active === true) return true

  const status = await callRpc<{ initialized?: unknown }>('api_get_invitation_status', {})
  if (status.initialized === true) return false

  try {
    return verifyInvitationCode(code, getInvitationCode())
  } catch {
    return false
  }
}
