import { useEffect, useState, type FormEvent } from 'react'
import {
  adminErrorMessage,
  getInvitationStatus,
  previewInvitation,
  sendInvitation,
  type InvitationPreview,
  type InvitationStatus,
} from '../../api/admin'
import {
  ErrorMessage,
  PrimaryButton,
  SecondaryButton,
  SectionHeading,
  SuccessMessage,
  inputClass,
} from './adminUi'

const EMAIL_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/

export default function SendInvitation() {
  const [email, setEmail] = useState('')
  const [preview, setPreview] = useState<InvitationPreview | null>(null)
  const [status, setStatus] = useState<InvitationStatus | null>(null)
  const [busy, setBusy] = useState<'generate' | 'send' | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getInvitationStatus()
      .then(setStatus)
      .catch(() => undefined)
  }, [])

  function handleGenerate(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSuccess(null)
    setConfirming(false)

    const address = email.trim()
    if (!EMAIL_PATTERN.test(address)) {
      setError('Enter a valid recipient email address before generating a code.')
      return
    }

    setBusy('generate')
    void (async () => {
      try {
        const result = await previewInvitation(address)
        if (!result.code) throw new Error('The server did not return a new invitation code.')
        setPreview(result)
        setSuccess('A new code was generated and the email preview is ready. Nothing has been sent.')
      } catch (generateError) {
        setError(adminErrorMessage(generateError))
      } finally {
        setBusy(null)
      }
    })()
  }

  async function handleSend() {
    if (!preview || !confirming) return
    setBusy('send')
    setSuccess(null)
    setError(null)
    try {
      const result = await sendInvitation(preview.to, preview.code)
      if (result.status === 'sent') {
        setSuccess(`Invitation sent to ${preview.to}.`)
        setConfirming(false)
        setStatus(await getInvitationStatus().catch(() => status))
      }
    } catch (sendError) {
      setError(adminErrorMessage(sendError))
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="rounded-3xl border border-[#EFE0DA] bg-[#FFFCF8] p-6 sm:p-8">
      <SectionHeading>Send invitation</SectionHeading>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-[#756360]">
        Generate a fresh code, review the exact email, then send it with the existing email
        integration. Generating a code never sends an email by itself.
      </p>

      <form onSubmit={handleGenerate} className="mt-6 max-w-md">
        <label htmlFor="invitation-email" className="text-sm font-semibold text-[#29201F]">
          Recipient email
        </label>
        <input
          id="invitation-email"
          type="email"
          className={inputClass}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="roqeebah@example.com"
          autoComplete="email"
          required
        />
        <div className="mt-4">
          <PrimaryButton type="submit" disabled={busy !== null}>
            {busy === 'generate' ? 'Generating code…' : 'Generate code & preview email'}
          </PrimaryButton>
        </div>
      </form>

      {status && status.status !== 'active' && (
        <p className="mt-5 rounded-xl border border-[#B08446]/30 bg-[#FCF7ED] px-4 py-3 text-sm text-[#8A622B]">
          Invitation access is currently {status.status === 'disabled' ? 'disabled' : 'not set up'}.
          Generating a new code will activate it.
        </p>
      )}

      {preview && (
        <div className="mt-6 rounded-2xl border border-[#E8C5C5] bg-white p-5 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#873F50]">
            Email preview — not sent yet
          </p>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-[#756360]">To</dt>
              <dd className="mt-1 break-all text-[#29201F]">{preview.to}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-[#756360]">Subject</dt>
              <dd className="mt-1 text-[#29201F]">{preview.subject}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-[#756360]">Website</dt>
              <dd className="mt-1 break-all text-[#29201F]">{preview.websiteUrl}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-[#756360]">Code</dt>
              <dd className="mt-1 break-all font-mono text-[#29201F]">{preview.code}</dd>
            </div>
          </dl>
          <pre className="mt-5 max-h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-[#F9F1EC] p-4 font-sans text-sm leading-7 text-[#756360]">
            {preview.body}
          </pre>

          <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-[#EFE0DA] pt-5">
            <PrimaryButton
              onClick={() => void handleSend()}
              disabled={!confirming || busy !== null}
            >
              {busy === 'send' ? 'Sending…' : 'Confirm and send invitation'}
            </PrimaryButton>
            <SecondaryButton
              onClick={() => setConfirming((value) => !value)}
              disabled={busy !== null}
            >
              {confirming ? 'Uncheck confirmation' : 'I confirm this email'}
            </SecondaryButton>
            <button
              type="button"
              onClick={() => {
                setPreview(null)
                setConfirming(false)
                setSuccess(null)
                setError(null)
              }}
              className="rounded-full px-4 py-2.5 text-sm font-semibold text-[#756360] transition hover:text-[#29201F]"
            >
              Discard preview
            </button>
          </div>
          {!confirming && (
            <p className="mt-3 text-xs text-[#756360]">
              Confirmation is required before the email can be sent.
            </p>
          )}
        </div>
      )}

      {success && <SuccessMessage>{success}</SuccessMessage>}
      {error && <ErrorMessage>{error}</ErrorMessage>}
    </section>
  )
}
