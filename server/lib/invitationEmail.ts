import { randomUUID } from 'node:crypto'
import { getAppOrigin, getInvitationEmailConfig } from './env.js'
import { ApiError } from './http.js'

// Invitation delivery needs Resend and the public origin, but not the admin
// notification recipient used by response emails.
function missingInvitationEmailConfig(): string[] {
  return ['RESEND_API_KEY', 'RESEND_FROM_EMAIL', 'APP_URL'].filter(
    (name) => !process.env[name]?.trim(),
  )
}

export interface InvitationEmail {
  to: string
  subject: string
  websiteUrl: string
  code: string
  html: string
  text: string
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case '&':
        return '&amp;'
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '"':
        return '&quot;'
      default:
        return '&#39;'
    }
  })
}

// Built on the server for preview and delivery. The plaintext code is supplied
// by the administrator's current generated code; it is never read from storage.
export function buildInvitationEmail(to: string, code: string): InvitationEmail {
  const websiteUrl = getAppOrigin()
  const subject = 'Your invitation to A Letter to Roqeebah ❤️'
  const safeUrl = escapeHtml(websiteUrl)
  const safeCode = escapeHtml(code)

  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#F9F1EC;font-family:Arial,Helvetica,sans-serif;color:#29201F;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F9F1EC;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#FFFCF8;border:1px solid #EFE0DA;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="background:#873F50;padding:28px 32px;text-align:center;">
                <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:500;color:#FFFFFF;">A Letter to Roqeebah</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 20px;font-size:16px;line-height:1.7;color:#756360;">I have something I would really love to share with you. Your invitation code is below.</p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:24px;">
                  <tr>
                    <td style="padding:16px;border:1px solid #E8C5C5;border-radius:10px;background:#FFFFFF;text-align:center;">
                      <span style="display:block;margin-bottom:8px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#873F50;">Your invitation code</span>
                      <span style="font-family:Georgia,'Times New Roman',serif;font-size:24px;letter-spacing:0.06em;color:#29201F;">${safeCode}</span>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 24px;text-align:center;font-size:15px;line-height:1.7;color:#756360;">Open the website, continue through the letter, and enter this code when asked.</p>
                <p style="margin:0;text-align:center;">
                  <a href="${safeUrl}" style="display:inline-block;background:#873F50;color:#FFFFFF;text-decoration:none;border-radius:999px;padding:14px 28px;font-size:15px;">Open A Letter to Roqeebah</a>
                </p>
                <p style="margin:24px 0 0;text-align:center;font-size:12px;line-height:1.6;color:#756360;">Website: ${safeUrl}</p>
                <p style="margin:20px 0 0;text-align:center;font-family:Georgia,'Times New Roman',serif;font-size:15px;font-style:italic;color:#873F50;">With love and care</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`

  const text = [
    'A Letter to Roqeebah',
    '',
    'I have something I would really love to share with you. Your invitation code is below.',
    '',
    `Invitation code: ${code}`,
    `Website: ${websiteUrl}`,
    '',
    'Open the website, continue through the letter, and enter this code when asked.',
    '',
    'With love and care',
  ].join('\n')

  return { to, subject, websiteUrl, code, html, text }
}

// Sends through the same Resend integration used by response notifications.
// Provider details are logged server-side only; the browser gets a safe message.
export async function sendInvitationEmail(message: InvitationEmail): Promise<void> {
  const missing = missingInvitationEmailConfig()
  if (missing.length > 0) {
    throw new ApiError(
      500,
      'email_not_configured',
      `Email delivery is not configured: ${missing.join(', ')}.`,
    )
  }

  const config = getInvitationEmailConfig()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), config.timeoutMs)

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${config.apiKey}`,
        'content-type': 'application/json',
        'Idempotency-Key': randomUUID(),
      },
      body: JSON.stringify({
        from: config.fromEmail,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`Resend request failed with status ${response.status}.`)
    }

    const payload = (await response.json().catch(() => null)) as { id?: unknown } | null
    if (!payload || typeof payload.id !== 'string') {
      throw new Error('Resend did not return a message id.')
    }
  } catch (error) {
    console.error('[invitation-email] delivery failed', {
      error: error instanceof Error ? error.message.slice(0, 300) : 'Unknown error',
    })
    throw new ApiError(
      502,
      'email_send_failed',
      'The invitation email could not be sent. Please check the email settings and try again.',
    )
  } finally {
    clearTimeout(timer)
  }
}
