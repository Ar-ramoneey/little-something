import {
  getNotificationConfig,
  missingNotificationConfig,
  type NotificationConfig,
} from './env'
import { callRpc } from './supabase'

interface NotificationRecord {
  id: string
  event_type: string
  previous_response: string | null
  new_response: string
  occurred_at: string
  idempotency_key: string
  attempts: number
}

interface EmailMessage {
  subject: string
  html: string
  text: string
}

const RESPONSE_LABELS: Record<string, string> = {
  yes: 'Yes — she would love to.',
  thinking: 'Thinking about it.',
  no: 'No, thank you.',
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

function labelForResponse(value: string | null): string {
  if (!value) return 'Not applicable — this was the first response.'
  return RESPONSE_LABELS[value] ?? value
}

function formatTimestamp(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return `${new Intl.DateTimeFormat('en-US', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(date)} UTC`
}

function buildEmail(record: NotificationRecord, config: NotificationConfig): EmailMessage {
  const isInitial = record.event_type === 'initial'
  const subject = isInitial
    ? 'A new response has arrived ❤️'
    : 'Roqeebah updated her response ❤️'
  const heading = isInitial ? 'A new response has arrived' : 'Roqeebah updated her response'
  const intro = isInitial
    ? 'Roqeebah has submitted her first answer to A Letter to Roqeebah.'
    : 'Roqeebah has changed her answer to A Letter to Roqeebah.'
  const latest = labelForResponse(record.new_response)
  const previous = labelForResponse(record.previous_response)
  const timestamp = formatTimestamp(record.occurred_at)
  const dashboardUrl = escapeHtml(config.dashboardUrl)

  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#F9F1EC;font-family:Arial,Helvetica,sans-serif;color:#29201F;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F9F1EC;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#FFFCF8;border:1px solid #EFE0DA;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="background:#873F50;padding:28px 32px;text-align:center;">
                <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:500;color:#FFFFFF;">${escapeHtml(heading)}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 24px;font-size:16px;line-height:1.7;color:#756360;">${escapeHtml(intro)}</p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                  <tr>
                    <td style="padding:12px 0;border-bottom:1px solid #EFE0DA;font-size:14px;color:#756360;">Proposal</td>
                    <td style="padding:12px 0;border-bottom:1px solid #EFE0DA;font-size:15px;font-weight:bold;color:#29201F;text-align:right;">A Letter to Roqeebah</td>
                  </tr>
                  <tr>
                    <td style="padding:12px 0;border-bottom:1px solid #EFE0DA;font-size:14px;color:#756360;">Latest response</td>
                    <td style="padding:12px 0;border-bottom:1px solid #EFE0DA;font-size:15px;font-weight:bold;color:#873F50;text-align:right;">${escapeHtml(latest)}</td>
                  </tr>
                  <tr>
                    <td style="padding:12px 0;border-bottom:1px solid #EFE0DA;font-size:14px;color:#756360;">Previous response</td>
                    <td style="padding:12px 0;border-bottom:1px solid #EFE0DA;font-size:15px;color:#29201F;text-align:right;">${escapeHtml(previous)}</td>
                  </tr>
                  <tr>
                    <td style="padding:12px 0;font-size:14px;color:#756360;">Recorded at:</td>
                    <td style="padding:12px 0;font-size:15px;color:#29201F;text-align:right;">${escapeHtml(timestamp)}</td>
                  </tr>
                </table>
                <p style="margin:32px 0 20px;text-align:center;">
                  <a href="${dashboardUrl}" style="display:inline-block;background:#873F50;color:#FFFFFF;text-decoration:none;border-radius:999px;padding:14px 28px;font-size:15px;">Open private admin dashboard</a>
                </p>
                <p style="margin:0;text-align:center;font-family:Georgia,'Times New Roman',serif;font-size:15px;font-style:italic;color:#873F50;">With love and care</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`

  const text = [
    heading,
    '',
    intro,
    '',
    'Proposal: A Letter to Roqeebah',
    `Latest response: ${latest}`,
    `Previous response: ${previous}`,
    `Recorded at: ${timestamp}`,
    '',
    `Private admin dashboard: ${config.dashboardUrl}`,
  ].join('\n')

  return { subject, html, text }
}

function safeErrorMessage(error: unknown): string {
  if (typeof error === 'string' && error) {
    return error.slice(0, 500)
  }
  if (error instanceof Error && error.message) {
    return error.message.slice(0, 500)
  }
  return 'Unknown notification error.'
}

async function sendResendEmail(
  config: NotificationConfig,
  record: NotificationRecord,
  message: EmailMessage,
): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), config.timeoutMs)

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${config.apiKey}`,
        'content-type': 'application/json',
        'Idempotency-Key': record.idempotency_key,
      },
      body: JSON.stringify({
        from: config.fromEmail,
        to: [config.recipientEmail],
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

    return payload.id
  } finally {
    clearTimeout(timer)
  }
}

async function markSent(id: string, providerMessageId: string): Promise<void> {
  try {
    await callRpc('api_mark_notification_sent', {
      p_id: id,
      p_provider_message_id: providerMessageId,
    })
  } catch (error) {
    console.error('[notifications] failed to record sent status', {
      notificationId: id,
      error: safeErrorMessage(error),
    })
  }
}

async function markFailed(id: string, error: unknown): Promise<void> {
  try {
    await callRpc('api_mark_notification_failed', {
      p_id: id,
      p_error: safeErrorMessage(error),
      p_retry_delay_seconds: 300,
    })
  } catch (markError) {
    console.error('[notifications] failed to record failure status', {
      notificationId: id,
      error: safeErrorMessage(markError),
    })
  }
}

export async function sendPendingNotifications(): Promise<void> {
  const records = await callRpc<NotificationRecord[]>('api_claim_notifications', {
    p_limit: 10,
    p_lock_seconds: 60,
  })

  if (!Array.isArray(records) || records.length === 0) {
    return
  }

  const missing = missingNotificationConfig()
  if (missing.length > 0) {
    console.error('[notifications] missing configuration', { missing })
    for (const record of records) {
      await markFailed(record.id, `Missing notification configuration: ${missing.join(', ')}.`)
    }
    return
  }

  let config: NotificationConfig
  try {
    config = getNotificationConfig()
  } catch (error) {
    console.error('[notifications] invalid configuration', {
      error: safeErrorMessage(error),
    })
    for (const record of records) {
      await markFailed(record.id, error)
    }
    return
  }

  for (const record of records) {
    if (record.event_type !== 'initial' && record.event_type !== 'changed') {
      await markFailed(record.id, `Unknown notification event type: ${record.event_type}`)
      continue
    }

    try {
      const message = buildEmail(record, config)
      const messageId = await sendResendEmail(config, record, message)
      await markSent(record.id, messageId)
    } catch (error) {
      console.error('[notifications] delivery failed', {
        notificationId: record.id,
        error: safeErrorMessage(error),
      })
      await markFailed(record.id, error)
    }
  }
}
