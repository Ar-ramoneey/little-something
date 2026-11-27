export const SESSION_COOKIE_NAME = '__Host-roqeebah_session'

const ADMIN_RESPONSES_PATH = '/admin/responses'

function readOptional(name: string): string | undefined {
  const value = process.env[name]?.trim()
  return value || undefined
}

function readRequired(name: string): string {
  const value = readOptional(name)
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

function normalizeOrigin(value: string): string {
  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error()
    }
    return url.origin
  } catch {
    throw new Error('APP_URL must be a valid http(s) URL.')
  }
}

function getConfiguredAppOrigin(): string {
  const raw =
    readOptional('APP_URL') ??
    readOptional('APP_ORIGIN') ??
    readOptional('ALLOWED_ORIGINS')?.split(',')[0]?.trim()

  if (!raw) {
    throw new Error('Missing required environment variable: APP_URL (or APP_ORIGIN/ALLOWED_ORIGINS).')
  }

  return normalizeOrigin(raw)
}

// Supabase's current secret key format is `sb_secret_…`. The legacy JWT
// service-role key remains a local fallback only; it must never use a VITE_ prefix.
function getSupabaseSecretKey(): string {
  const secretKey = readOptional('SUPABASE_SECRET_KEY')
  if (secretKey) return secretKey

  const legacyKey = readOptional('SUPABASE_SERVICE_ROLE_KEY')
  if (legacyKey) return legacyKey

  throw new Error(
    'Missing required environment variable: SUPABASE_SECRET_KEY (legacy SUPABASE_SERVICE_ROLE_KEY fallback not found).',
  )
}

export function getSupabaseConfig(): { url: string; secretKey: string } {
  return {
    url: readRequired('SUPABASE_URL'),
    secretKey: getSupabaseSecretKey(),
  }
}

// Peels session tokens with a server-only secret before hashing, so a stolen
// database dump alone cannot be used to test guessed cookie values.
export function getSessionSecret(): string {
  const secret = readRequired('SESSION_SECRET')
  if (secret.length < 32) {
    throw new Error('SESSION_SECRET must be at least 32 characters.')
  }
  return secret
}

export function getInvitationCode(): string {
  return readRequired('INVITATION_CODE')
}

export function getProposalId(): string {
  return readOptional('PROPOSAL_ID') ?? 'roqeebah-001'
}

// The public website origin, used in invitation emails and admin previews.
export function getAppOrigin(): string {
  return getConfiguredAppOrigin()
}

export function getSessionTtlSeconds(): number {
  const raw = readOptional('INVITATION_SESSION_TTL_SECONDS')
  const seconds = raw ? Number(raw) : 604800

  if (!Number.isInteger(seconds) || seconds < 60 || seconds > 2592000) {
    throw new Error('INVITATION_SESSION_TTL_SECONDS must be an integer between 60 and 2592000.')
  }

  return seconds
}

export function getAllowedOrigins(): string[] {
  const raw =
    readOptional('APP_URL') ?? readOptional('APP_ORIGIN') ?? readOptional('ALLOWED_ORIGINS')
  if (!raw) {
    throw new Error('Missing required environment variable: APP_URL (or APP_ORIGIN/ALLOWED_ORIGINS).')
  }

  const origins = raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .map(normalizeOrigin)

  if (origins.length === 0) {
    throw new Error('No allowed origins were configured.')
  }

  return [...new Set(origins)]
}

export interface NotificationConfig {
  apiKey: string
  fromEmail: string
  recipientEmail: string
  dashboardUrl: string
  timeoutMs: number
}

function getAdminDashboardUrl(): string {
  const configured = readOptional('ADMIN_DASHBOARD_URL')
  if (configured) {
    try {
      const url = new URL(configured)
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new Error()
      }
      return url.toString()
    } catch {
      throw new Error('ADMIN_DASHBOARD_URL must be a valid http(s) URL.')
    }
  }

  return `${getConfiguredAppOrigin()}${ADMIN_RESPONSES_PATH}`
}

function getNotificationTimeoutMs(): number {
  const raw = readOptional('RESEND_TIMEOUT_MS')
  const timeoutMs = raw ? Number(raw) : 5000

  if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 30000) {
    throw new Error('RESEND_TIMEOUT_MS must be an integer between 1000 and 30000.')
  }

  return timeoutMs
}

export function missingNotificationConfig(): string[] {
  const names = ['RESEND_API_KEY', 'ADMIN_NOTIFICATION_EMAIL', 'RESEND_FROM_EMAIL']

  if (
    !readOptional('ADMIN_DASHBOARD_URL') &&
    !readOptional('APP_URL') &&
    !readOptional('APP_ORIGIN') &&
    !readOptional('ALLOWED_ORIGINS')
  ) {
    names.push('APP_URL')
  }

  return names.filter((name) => !readOptional(name))
}

export function getNotificationConfig(): NotificationConfig {
  return {
    apiKey: readRequired('RESEND_API_KEY'),
    fromEmail: readRequired('RESEND_FROM_EMAIL'),
    recipientEmail: readRequired('ADMIN_NOTIFICATION_EMAIL'),
    dashboardUrl: getAdminDashboardUrl(),
    timeoutMs: getNotificationTimeoutMs(),
  }
}

// Invitation emails do not need the response-notification recipient.
export function getInvitationEmailConfig(): {
  apiKey: string
  fromEmail: string
  timeoutMs: number
} {
  return {
    apiKey: readRequired('RESEND_API_KEY'),
    fromEmail: readRequired('RESEND_FROM_EMAIL'),
    timeoutMs: getNotificationTimeoutMs(),
  }
}
