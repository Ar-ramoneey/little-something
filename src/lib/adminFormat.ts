export type ResponseValue = 'yes' | 'thinking' | 'no'

export interface ResponseDisplay {
  badge: string
  label: string
}

const RESPONSE_DISPLAY: Record<ResponseValue, ResponseDisplay> = {
  yes: { badge: 'YES ❤️', label: 'Yes — she would love to.' },
  thinking: { badge: 'NEEDS TIME 💗', label: 'Thinking about it.' },
  no: { badge: 'NO', label: 'No, thank you.' },
}

const UNKNOWN_DISPLAY: ResponseDisplay = { badge: '—', label: 'Not recorded' }

export function displayForResponse(value: string | null | undefined): ResponseDisplay {
  if (value === 'yes' || value === 'thinking' || value === 'no') {
    return RESPONSE_DISPLAY[value]
  }
  return UNKNOWN_DISPLAY
}

export function formatExactTimestamp(value: string | null | undefined): string {
  if (!value) return '—'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return `${new Intl.DateTimeFormat('en-US', {
    dateStyle: 'long',
    timeStyle: 'long',
    timeZone: 'UTC',
  }).format(date)} UTC`
}

export function formatShortTimestamp(value: string | null | undefined): string {
  if (!value) return '—'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return `${new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
  }).format(date)} UTC`
}
