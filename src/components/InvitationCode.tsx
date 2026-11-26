import { useState, type FormEvent } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Heart } from 'lucide-react'
import { apiErrorMessage, verifyInvitation } from '../api/responses'

interface InvitationCodeProps {
  onVerified: () => void | Promise<void>
  initialError?: string | null
  onBack?: () => void
}

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1]

export default function InvitationCode({ onVerified, initialError, onBack }: InvitationCodeProps) {
  const prefersReducedMotion = useReducedMotion()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(initialError ?? null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (loading) return

    const submitted = code.trim()
    if (!submitted) {
      setError('Please enter your invitation code.')
      return
    }

    // The code lives only in this request. It is never written to browser storage.
    setCode('')
    setError(null)
    setLoading(true)

    let succeeded = false
    try {
      await verifyInvitation(submitted)
      await onVerified()
      succeeded = true
    } catch (submitError) {
      setError(apiErrorMessage(submitError))
    } finally {
      if (!succeeded) setLoading(false)
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#F9F1EC] px-6 py-14 sm:px-8">
      <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-[#E8C5C5]/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 -right-24 h-80 w-80 rounded-full bg-[#873F50]/10 blur-3xl" />

      <motion.section
        initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.6, ease: EASE }}
        className="relative z-10 w-full max-w-lg"
      >
        <div className="rounded-3xl border border-[#EFE0DA] bg-[#FFFCF8] p-7 shadow-[0_24px_60px_-38px_rgba(76,36,45,0.5)] sm:p-10">
          <div className="flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-[#E8C5C5] bg-white/80">
              <Heart size={26} strokeWidth={1.4} className="fill-[#E8C5C5] text-[#873F50]" />
            </div>
          </div>

          <p className="mt-8 text-center text-xs font-medium uppercase tracking-[0.3em] text-[#873F50]">
            Just for you
          </p>
          <h1 className="mt-3 text-center font-romantic text-3xl leading-tight text-[#29201F] sm:text-4xl">
            One small step before your answer
          </h1>
          <div className="my-7 flex items-center justify-center gap-3">
            <div className="h-px w-12 bg-[#D9B4B4]" />
            <Heart size={13} className="fill-[#873F50] text-[#873F50]" />
            <div className="h-px w-12 bg-[#D9B4B4]" />
          </div>

          <p className="mx-auto max-w-sm text-center text-sm leading-7 text-[#756360]">
            Please enter the private invitation code I gave you. It keeps this little moment
            between us.
          </p>

          <form onSubmit={handleSubmit} className="mt-8" aria-busy={loading}>
            <label
              htmlFor="invitation-code"
              className="block text-xs font-semibold uppercase tracking-[0.18em] text-[#873F50]"
            >
              Invitation code
            </label>
            <input
              id="invitation-code"
              name="invitationCode"
              type="password"
              value={code}
              onChange={(event) => {
                setCode(event.target.value)
                if (error) setError(null)
              }}
              disabled={loading}
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="Enter your code"
              aria-describedby={error ? 'invitation-error' : 'invitation-help'}
              className="mt-3 w-full rounded-full border border-[#E8C5C5] bg-white px-5 py-4 text-center text-sm tracking-[0.12em] text-[#29201F] outline-none transition placeholder:tracking-normal placeholder:text-[#A99592] focus:border-[#873F50] focus:ring-2 focus:ring-[#873F50]/20 disabled:cursor-not-allowed disabled:opacity-60"
            />

            {error ? (
              <p id="invitation-error" role="alert" className="mt-3 text-center text-sm text-[#873F50]">
                {error}
              </p>
            ) : (
              <p id="invitation-help" className="mt-3 text-center text-xs leading-5 text-[#756360]">
                If you opened this in another browser or cleared your cookies, you may need to
                verify your invitation again.
              </p>
            )}

            <motion.button
              type="submit"
              disabled={loading}
              whileHover={prefersReducedMotion || loading ? undefined : { scale: 1.02 }}
              whileTap={prefersReducedMotion || loading ? undefined : { scale: 0.98 }}
              className="mt-7 w-full rounded-full bg-[#873F50] px-8 py-4 text-sm font-medium text-white shadow-lg shadow-[#873F50]/20 transition-colors hover:bg-[#713343] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#873F50] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FFFCF8] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Verifying…' : 'Continue'}
            </motion.button>
          </form>

          {onBack && (
            <button
              type="button"
              onClick={onBack}
              disabled={loading}
              className="mt-5 w-full rounded-full py-2 text-xs font-medium uppercase tracking-[0.18em] text-[#756360] transition hover:text-[#873F50] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Back to the letter
            </button>
          )}
        </div>
      </motion.section>
    </main>
  )
}
