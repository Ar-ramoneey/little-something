import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useAdminAuth } from '../../auth/useAdminAuth'
import { navigate } from '../../lib/router'

function AdminShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F9F1EC] px-6 py-16">
      <div className="w-full max-w-md rounded-2xl border border-[#EFE0DA] bg-[#FFFCF8] p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#873F50]">
          Private
        </p>
        <h1 className="mt-3 font-romantic text-3xl text-[#29201F]">{title}</h1>
        <div className="mt-6">{children}</div>
      </div>
    </main>
  )
}

const inputClass =
  'mt-2 w-full rounded-xl border border-[#EFE0DA] bg-white px-4 py-3 text-[#29201F] outline-none focus:border-[#873F50] focus:ring-2 focus:ring-[#873F50]/20'

export default function AdminLogin() {
  const { session, isAdmin, loading, configured, signIn, signOut } = useAdminAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!loading && session && isAdmin) {
      navigate('/admin', true)
    }
  }, [loading, session, isAdmin])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    const signInError = await signIn(email, password)

    setSubmitting(false)
    if (signInError) {
      setError(signInError)
      return
    }

    setPassword('')
    navigate('/admin', true)
  }

  if (!configured) {
    return (
      <AdminShell title="Admin sign-in is unavailable">
        <p className="text-sm leading-7 text-[#756360]">
          Set <code>VITE_SUPABASE_URL</code> and{' '}
          <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> to enable the private admin area. Use only
          the publishable key in the browser.
        </p>
      </AdminShell>
    )
  }

  if (!loading && session && !isAdmin) {
    return (
      <AdminShell title="This account is not authorized">
        <p className="text-sm leading-7 text-[#756360]">
          Admin access requires the trusted <code>app_metadata.role = admin</code> claim. Sign out
          and use the designated administrator account.
        </p>
        <button
          type="button"
          onClick={() => {
            void signOut()
            navigate('/admin/login', true)
          }}
          className="mt-6 rounded-full bg-[#873F50] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#6E3141]"
        >
          Log out
        </button>
      </AdminShell>
    )
  }

  return (
    <AdminShell title="Admin sign in">
      <p className="text-sm leading-7 text-[#756360]">
        This area is private. Accounts are created manually in Supabase; there is no public
        registration.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        <label className="block text-sm font-medium text-[#29201F]">
          Email
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={inputClass}
            placeholder="Email address"
          />
        </label>

        <label className="block text-sm font-medium text-[#29201F]">
          Password
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={inputClass}
          />
        </label>

        {error && (
          <p role="alert" className="rounded-xl bg-[#FBE9E9] px-4 py-3 text-sm text-[#873F50]">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting || loading}
          className="w-full rounded-full bg-[#873F50] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#6E3141] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </AdminShell>
  )
}
