import type { Session, User } from '@supabase/supabase-js'

export const ADMIN_ROLE = 'admin'

// Authorization must come from the signed JWT app_metadata claim.
// user_metadata is editable by the user and is never consulted.
export function isAdminUser(user: User | null | undefined): boolean {
  return user?.app_metadata?.role === ADMIN_ROLE
}

export function isAdminSession(session: Session | null | undefined): boolean {
  return isAdminUser(session?.user)
}

export function friendlyAuthError(message: string): string {
  const normalized = message.toLowerCase()

  if (
    normalized.includes('invalid login credentials') ||
    normalized.includes('invalid email or password')
  ) {
    return 'Invalid email or password.'
  }
  if (normalized.includes('email not confirmed')) {
    return 'Please confirm this email address in Supabase before signing in.'
  }
  if (normalized.includes('too many requests')) {
    return 'Too many sign-in attempts. Please try again later.'
  }

  return 'Unable to sign in. Please try again.'
}
