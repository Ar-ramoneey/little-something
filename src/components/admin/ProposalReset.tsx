import { useCallback, useEffect, useState } from 'react'
import {
  adminErrorMessage,
  getResetPreview,
  resetProposal,
  type ResetCounts,
} from '../../api/admin'
import {
  DangerButton,
  ErrorMessage,
  SecondaryButton,
  SectionHeading,
  SuccessMessage,
  inputClass,
} from './adminUi'

const EMPTY_COUNTS: ResetCounts = {
  responses: 0,
  history: 0,
  notifications: 0,
  sessions: 0,
  rate_limits: 0,
}

interface Props {
  onReset?: () => void
  onCodeRotated?: () => void
}

export default function ProposalReset({ onReset, onCodeRotated }: Props = {}) {
  const [counts, setCounts] = useState<ResetCounts | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [confirmation, setConfirmation] = useState('')
  const [rotateCode, setRotateCode] = useState(false)
  const [code, setCode] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const next = await getResetPreview()
      setCounts(next)
      setError(null)
    } catch (loadError) {
      setError(adminErrorMessage(loadError))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true

    getResetPreview()
      .then((next) => {
        if (!active) return
        setCounts(next)
        setError(null)
      })
      .catch((loadError: unknown) => {
        if (active) setError(adminErrorMessage(loadError))
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  const confirmed = confirmation === 'RESET'
  const display = counts ?? EMPTY_COUNTS

  async function handleReset() {
    if (!confirmed) return
    setBusy(true)
    setSuccess(null)
    setError(null)
    try {
      const result = await resetProposal(rotateCode)
      setSuccess(
        `Proposal data reset. ${result.responses_deleted} response, ${result.history_deleted} history rows, ${result.notifications_deleted} notification rows and ${result.sessions_deleted} invitation sessions were removed.`,
      )
      setCode(result.code ?? null)
      setConfirmation('')
      setRotateCode(false)
      onReset?.()
      if (result.code_rotated) onCodeRotated?.()
      await load()
    } catch (resetError) {
      setError(adminErrorMessage(resetError))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-3xl border border-[#873F50]/30 bg-[#FFFCF8] p-6 sm:p-8">
      <SectionHeading>Reset proposal</SectionHeading>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-[#756360]">
        Clear the current response and return the dashboard to its initial empty state. This
        cannot be undone.
      </p>

      {loading && !counts && (
        <p className="mt-6 text-sm text-[#756360]">Loading reset preview…</p>
      )}

      {counts && (
        <div className="mt-6 rounded-2xl border border-[#EFE0DA] bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#873F50]">
            Exactly what will be deleted
          </p>
          <ul className="mt-4 grid gap-3 text-sm text-[#756360] sm:grid-cols-2">
            <li>
              <span className="font-semibold text-[#29201F]">{display.responses}</span> current
              response{display.responses === 1 ? '' : 's'}
            </li>
            <li>
              <span className="font-semibold text-[#29201F]">{display.history}</span> response
              history entries
            </li>
            <li>
              <span className="font-semibold text-[#29201F]">{display.notifications}</span>{' '}
              notification history / pending test notifications
            </li>
            <li>
              <span className="font-semibold text-[#29201F]">{display.sessions}</span> invitation
              sessions
            </li>
            <li>
              <span className="font-semibold text-[#29201F]">{display.rate_limits}</span> invitation
              and response rate-limit counters
            </li>
          </ul>
          <p className="mt-5 border-t border-[#EFE0DA] pt-4 text-xs leading-6 text-[#756360]">
            Admin accounts, authentication, database schema, website content, Supabase
            configuration, and invitation management settings are preserved. The invitation code is
            not changed unless you explicitly choose to rotate it below.
          </p>
        </div>
      )}

      <div className="mt-6 max-w-md">
        <label htmlFor="reset-confirmation" className="text-sm font-semibold text-[#29201F]">
          Type <span className="font-mono text-[#873F50]">RESET</span> to confirm
        </label>
        <input
          id="reset-confirmation"
          className={inputClass}
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          placeholder="RESET"
          autoComplete="off"
          spellCheck={false}
        />
      </div>

      <label className="mt-5 flex max-w-xl cursor-pointer items-start gap-3 text-sm leading-6 text-[#756360]">
        <input
          type="checkbox"
          checked={rotateCode}
          onChange={(event) => setRotateCode(event.target.checked)}
          className="mt-1 h-4 w-4 accent-[#873F50]"
        />
        <span>
          Also generate a new invitation code and invalidate all existing invitation sessions.
          <span className="block text-xs text-[#873F50]">
            Optional — unchecked keeps the current code.
          </span>
        </span>
      </label>

      <div className="mt-6">
        <DangerButton onClick={() => void handleReset()} disabled={!confirmed || busy || !counts}>
          {busy ? 'Resetting…' : 'Reset proposal data'}
        </DangerButton>
        {!confirmed && (
          <p className="mt-3 text-xs text-[#756360]">Confirmation is required to enable this action.</p>
        )}
      </div>

      {code && (
        <div className="mt-6 rounded-2xl border border-[#E8C5C5] bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#873F50]">
            New invitation code — shown once
          </p>
          <p className="mt-3 break-all rounded-xl bg-[#F9F1EC] px-4 py-3 font-mono text-sm text-[#29201F]">
            {code}
          </p>
        </div>
      )}

      {success && <SuccessMessage>{success}</SuccessMessage>}
      {error && <ErrorMessage>{error}</ErrorMessage>}

      <div className="mt-6 border-t border-[#EFE0DA] pt-5">
        <SecondaryButton onClick={() => void load()} disabled={busy}>
          Refresh preview
        </SecondaryButton>
      </div>
    </section>
  )
}
