import { useCallback, useEffect, useState } from 'react'
import { useAdminAuth } from '../../auth/useAdminAuth'
import {
  fetchAdminDashboardData,
  type AdminDashboardData,
  type HistoryRow,
  type NotificationRow,
  type ResponseRow,
} from '../../lib/adminData'
import {
  displayForResponse,
  formatExactTimestamp,
  formatShortTimestamp,
} from '../../lib/adminFormat'
import { navigate } from '../../lib/router'
import { getBrowserSupabase } from '../../lib/supabaseClient'
import InvitationManagement from './InvitationManagement'
import ProposalReset from './ProposalReset'
import SendInvitation from './SendInvitation'

function SectionHeading({ children }: { children: string }) {
  return (
    <h2 className="font-romantic text-2xl text-[#29201F] sm:text-3xl">{children}</h2>
  )
}

function SummaryCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-[#EFE0DA] bg-white p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#873F50]">{label}</p>
      <p className="mt-3 text-lg font-semibold text-[#29201F]">{value}</p>
      {hint && <p className="mt-1 text-xs leading-5 text-[#756360]">{hint}</p>}
    </div>
  )
}

function StatusStat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-2xl border border-[#EFE0DA] bg-white p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#756360]">{label}</p>
      <p className={`mt-3 font-romantic text-4xl ${tone}`}>{value}</p>
    </div>
  )
}

function Timeline({ history }: { history: HistoryRow[] }) {
  if (history.length === 0) {
    return <p className="mt-4 text-sm text-[#756360]">No answer changes have been recorded yet.</p>
  }

  return (
    <ol className="relative mt-6 space-y-7 border-l border-[#E8C5C5] pl-7">
      {history.map((item) => (
        <li key={item.id} className="relative">
          <span className="absolute -left-[34px] top-1.5 h-3 w-3 rounded-full bg-[#873F50] ring-4 ring-[#FFFCF8]" />
          <p className="text-xs font-semibold uppercase tracking-wider text-[#873F50]">
            {formatShortTimestamp(item.changed_at)}
          </p>
          <p className="mt-2 text-sm leading-7 text-[#756360]">
            {item.previous_response
              ? `${displayForResponse(item.previous_response).label} → `
              : 'First answer recorded: '}
            <span className="font-semibold text-[#29201F]">
              {displayForResponse(item.new_response).badge}
            </span>
          </p>
        </li>
      ))}
    </ol>
  )
}

function NotificationStatus({ notifications }: { notifications: NotificationRow[] }) {
  const delivered = notifications.filter((item) => item.status === 'sent').length
  const failed = notifications.filter((item) => item.status === 'failed').length
  const pending = notifications.filter(
    (item) => item.status === 'pending' || item.status === 'processing',
  ).length

  return (
    <section className="rounded-3xl border border-[#EFE0DA] bg-[#FFFCF8] p-6 sm:p-8">
      <SectionHeading>Notification status</SectionHeading>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatusStat label="Delivered emails" value={delivered} tone="text-[#4E7A62]" />
        <StatusStat label="Failed emails" value={failed} tone="text-[#873F50]" />
        <StatusStat label="Pending emails" value={pending} tone="text-[#B08446]" />
      </div>
      <p className="mt-5 text-xs leading-5 text-[#756360]">
        Based on the private notification outbox. API keys and environment variables are never
        displayed here.
      </p>
    </section>
  )
}

function CurrentResponse({ response }: { response: ResponseRow | null }) {
  if (!response) {
    return (
      <section className="rounded-3xl border border-[#E8C5C5] bg-white p-8 text-center sm:p-12">
        <SectionHeading>Current response</SectionHeading>
        <p className="mt-6 font-romantic text-3xl text-[#873F50]">Waiting for a response.</p>
        <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-[#756360]">
          Your little surprise is waiting for its answer.
        </p>
      </section>
    )
  }

  const display = displayForResponse(response.response)

  return (
    <section className="rounded-3xl bg-[#873F50] p-8 text-white shadow-sm sm:p-12">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#E8C5C5]">
        Latest answer
      </p>
      <p className="mt-5 font-romantic text-5xl leading-tight sm:text-6xl">{display.badge}</p>
      <p className="mt-3 text-sm text-[#F9F1EC]">{display.label}</p>
      <div className="mt-8 grid gap-3 text-sm sm:grid-cols-2">
        <p>
          <span className="font-semibold text-[#E8C5C5]">First submitted:</span>{' '}
          {formatExactTimestamp(response.created_at)}
        </p>
        <p>
          <span className="font-semibold text-[#E8C5C5]">Last updated:</span>{' '}
          {formatExactTimestamp(response.updated_at)}
        </p>
      </div>
      <p className="mt-4 break-all font-mono text-xs text-[#F9F1EC]/80">
        Exact timestamp: {response.updated_at}
      </p>
    </section>
  )
}

export default function ResponseDashboard() {
  const { signOut } = useAdminAuth()
  const client = getBrowserSupabase()
  const [data, setData] = useState<AdminDashboardData | null>(null)
  const [loading, setLoading] = useState(client !== null)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(
    client ? null : 'Supabase browser configuration is missing.',
  )
  const [signingOut, setSigningOut] = useState(false)

  const load = useCallback(async () => {
    if (!client) return

    try {
      const next = await fetchAdminDashboardData(client)
      setData(next)
      setError(null)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load dashboard data.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [client])

  useEffect(() => {
    if (!client) return

    let active = true

    fetchAdminDashboardData(client)
      .then((next) => {
        if (!active) return
        setData(next)
        setError(null)
        setLoading(false)
      })
      .catch((loadError: unknown) => {
        if (!active) return
        setError(loadError instanceof Error ? loadError.message : 'Unable to load dashboard data.')
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [client])

  function handleRefresh() {
    if (!client) return
    setRefreshing(true)
    void load()
  }

  async function handleSignOut() {
    setSigningOut(true)
    try {
      await signOut()
    } finally {
      navigate('/admin/login', true)
    }
  }

  const response = data?.response ?? null
  const history = data?.history ?? []
  const notifications = data?.notifications ?? []
  const changeCount = history.filter((item) => item.previous_response !== null).length

  const cards = [
    {
      label: 'Current response',
      value: response ? displayForResponse(response.response).badge : '—',
      hint: response ? displayForResponse(response.response).label : 'No answer yet',
    },
    {
      label: 'Initial submission',
      value: response ? formatShortTimestamp(response.created_at) : '—',
      hint: 'First answer recorded',
    },
    {
      label: 'Last update',
      value: response ? formatShortTimestamp(response.updated_at) : '—',
      hint: 'Most recent change',
    },
    {
      label: 'Answer changes',
      value: String(changeCount),
      hint: 'After the first answer',
    },
  ]

  return (
    <main className="min-h-screen bg-[#F9F1EC] px-5 py-10 sm:px-8 sm:py-14">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#873F50]">
              Private
            </p>
            <h1 className="mt-3 font-romantic text-4xl text-[#29201F] sm:text-5xl">
              A Letter to Roqeebah
            </h1>
            <p className="mt-2 text-sm text-[#756360]">Private Response Dashboard</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="rounded-full bg-[#873F50] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#6E3141] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="rounded-full border border-[#873F50] px-6 py-3 text-sm font-semibold text-[#873F50] transition hover:bg-[#873F50] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {signingOut ? 'Logging out…' : 'Log out'}
            </button>
          </div>
        </header>

        {error && data && (
          <div
            role="alert"
            className="mt-8 rounded-2xl border border-[#873F50]/30 bg-white px-5 py-4 text-sm text-[#873F50]"
          >
            {error} <button type="button" onClick={handleRefresh} className="font-semibold underline">Try again</button>
          </div>
        )}

        {!data && loading && (
          <div className="mt-10 rounded-3xl border border-[#EFE0DA] bg-[#FFFCF8] p-10 text-center">
            <p className="font-romantic text-2xl text-[#29201F]">Loading the private dashboard…</p>
          </div>
        )}

        {!data && !loading && error && (
          <div className="mt-10 rounded-3xl border border-[#EFE0DA] bg-[#FFFCF8] p-10 text-center">
            <p className="font-romantic text-2xl text-[#873F50]">Unable to load responses</p>
            <p className="mt-3 text-sm text-[#756360]">{error}</p>
            <button
              type="button"
              onClick={handleRefresh}
              className="mt-6 rounded-full bg-[#873F50] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#6E3141]"
            >
              Try again
            </button>
          </div>
        )}

        {data && (
          <div className="mt-10 space-y-10">
            <section aria-label="Response summary" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {cards.map((card) => (
                <SummaryCard key={card.label} {...card} />
              ))}
            </section>

            <CurrentResponse response={response} />

            <section className="rounded-3xl border border-[#EFE0DA] bg-[#FFFCF8] p-6 sm:p-8">
              <SectionHeading>Response history</SectionHeading>
              <Timeline history={history} />
            </section>

            <NotificationStatus notifications={notifications} />

            <div className="space-y-8 border-t border-[#EFE0DA] pt-10">
              <InvitationManagement />
              <SendInvitation />
              <ProposalReset onReset={() => void load()} />
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
