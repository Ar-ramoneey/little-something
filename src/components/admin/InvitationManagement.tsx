import { useCallback, useEffect, useState } from 'react'
import {
  adminErrorMessage,
  getInvitationStatus,
  updateInvitation,
  type InvitationStatus,
} from '../../api/admin'
import { formatExactTimestamp, formatShortTimestamp } from '../../lib/adminFormat'
import {
  DangerButton,
  ErrorMessage,
  PrimaryButton,
  SecondaryButton,
  SectionHeading,
  SuccessMessage,
} from './adminUi'

function statusLabel(status: InvitationStatus['status']): string {
  switch (status) {
    case 'active':
      return 'Active'
    case 'disabled':
      return 'Disabled'
    default:
      return 'Not initialized'
  }
}

function statusClasses(status: InvitationStatus['status']): string {
  switch (status) {
    case 'active':
      return 'border-[#4E7A62]/30 bg-[#F1F7F2] text-[#3F654F]'
    case 'disabled':
      return 'border-[#B08446]/30 bg-[#FCF7ED] text-[#8A622B]'
    default:
      return 'border-[#EFE0DA] bg-white text-[#756360]'
  }
}

interface Props {
  onChanged?: () => void
}

export default function InvitationManagement({ onChanged }: Props = {}) {
  const [status, setStatus] = useState<InvitationStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [code, setCode] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [confirmingRevoke, setConfirmingRevoke] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const next = await getInvitationStatus()
      setStatus(next)
      setError(null)
    } catch (loadError) {
      setError(adminErrorMessage(loadError))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    getInvitationStatus()
      .then((next) => {
        if (!active) return
        setStatus(next)
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

  async function run(action: 'generate' | 'revoke' | 'set_access', enabled?: boolean) {
    setBusy(action)
    setSuccess(null)
    setError(null)
    try {
      const result = await updateInvitation(action, enabled)
      setCode(result.code ?? null)
      setCopied(false)
      setConfirmingRevoke(false)
      const message =
        action === 'generate'
          ? 'A new invitation code is ready. Copy it now — it is shown only once.'
          : action === 'revoke'
            ? 'The invitation code has been revoked. Existing invitation sessions were invalidated.'
            : enabled
              ? 'Invitation access has been enabled.'
              : 'Invitation access has been disabled and existing sessions were invalidated.'
      setSuccess(message)
      await load()
      onChanged?.()
    } catch (actionError) {
      setError(adminErrorMessage(actionError))
    } finally {
      setBusy(null)
    }
  }

  async function copyCode() {
    if (!code) return
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
    } catch {
      setError('Copying is unavailable in this browser. Select and copy the code manually.')
    }
  }

  const canDisable = status?.status === 'active'

  return (
    <section className="rounded-3xl border border-[#EFE0DA] bg-[#FFFCF8] p-6 sm:p-8">
      <SectionHeading>Invitation management</SectionHeading>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-[#756360]">
        Manage the private access code. Only a secure hash is stored; the full code is shown once
        when it is generated.
      </p>

      {loading && !status && (
        <p className="mt-6 text-sm text-[#756360]">Loading invitation status…</p>
      )}

      {status && (
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-[#EFE0DA] bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#756360]">
              Status
            </p>
            <span
              className={`mt-3 inline-block rounded-full border px-3 py-1 text-xs font-semibold ${statusClasses(status.status)}`}
            >
              {statusLabel(status.status)}
            </span>
          </div>
          <div className="rounded-2xl border border-[#EFE0DA] bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#756360]">
              Last updated
            </p>
            <p className="mt-3 text-sm font-semibold text-[#29201F]">
              {formatShortTimestamp(status.updated_at)}
            </p>
            <p className="mt-1 break-all text-[11px] text-[#756360]">
              {formatExactTimestamp(status.updated_at)}
            </p>
          </div>
          <div className="rounded-2xl border border-[#EFE0DA] bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#756360]">
              Code created
            </p>
            <p className="mt-3 text-sm font-semibold text-[#29201F]">
              {status.revoked_at ? 'Revoked' : formatShortTimestamp(status.created_at)}
            </p>
            {status.revoked_at && (
              <p className="mt-1 text-[11px] text-[#756360]">
                Revoked {formatShortTimestamp(status.revoked_at)}
              </p>
            )}
          </div>
        </div>
      )}

      {code && (
        <div className="mt-6 rounded-2xl border border-[#E8C5C5] bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#873F50]">
            New invitation code — shown once
          </p>
          <p className="mt-3 break-all rounded-xl bg-[#F9F1EC] px-4 py-3 font-mono text-sm text-[#29201F]">
            {code}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <SecondaryButton onClick={() => void copyCode()}>
              {copied ? 'Copied ✓' : 'Copy code'}
            </SecondaryButton>
            <button
              type="button"
              onClick={() => {
                setCode(null)
                setCopied(false)
              }}
              className="rounded-full px-4 py-2.5 text-sm font-semibold text-[#756360] transition hover:text-[#29201F]"
            >
              Clear from screen
            </button>
          </div>
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <PrimaryButton
          onClick={() => void run('generate')}
          disabled={busy !== null}
        >
          {busy === 'generate' ? 'Generating…' : status?.initialized ? 'Replace code' : 'Generate code'}
        </PrimaryButton>
        {canDisable && (
          <SecondaryButton
            onClick={() => void run('set_access', false)}
            disabled={busy !== null}
          >
            {busy === 'set_access' ? 'Updating…' : 'Disable access'}
          </SecondaryButton>
        )}
        {status?.status === 'disabled' && (
          <SecondaryButton
            onClick={() => void run('set_access', true)}
            disabled={busy !== null}
          >
            {busy === 'set_access' ? 'Updating…' : 'Enable access'}
          </SecondaryButton>
        )}
      </div>

      <div className="mt-6 border-t border-[#EFE0DA] pt-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#873F50]">
          Danger zone
        </p>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[#756360]">
          Revoking permanently invalidates the current code and every invitation session. Existing
          visitors will need a new code to continue.
        </p>
        <div className="mt-4">
          {!confirmingRevoke ? (
            <DangerButton
              onClick={() => setConfirmingRevoke(true)}
              disabled={busy !== null || !status?.initialized}
            >
              Revoke current code
            </DangerButton>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <DangerButton
                onClick={() => void run('revoke')}
                disabled={busy !== null}
              >
                {busy === 'revoke' ? 'Revoking…' : 'Yes, revoke the current code'}
              </DangerButton>
              <button
                type="button"
                onClick={() => setConfirmingRevoke(false)}
                className="rounded-full px-4 py-2.5 text-sm font-semibold text-[#756360] transition hover:text-[#29201F]"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {success && <SuccessMessage>{success}</SuccessMessage>}
      {error && <ErrorMessage>{error}</ErrorMessage>}
    </section>
  )
}
