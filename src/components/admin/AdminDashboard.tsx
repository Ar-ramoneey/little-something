import { useState } from 'react'
import { useAdminAuth } from '../../auth/useAdminAuth'
import { navigate } from '../../lib/router'

export default function AdminDashboard() {
  const { signOut } = useAdminAuth()
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    setSigningOut(true)
    try {
      await signOut()
    } finally {
      navigate('/admin/login', true)
    }
  }

  return (
    <main className="min-h-screen bg-[#F9F1EC] px-6 py-16">
      <div className="mx-auto max-w-2xl rounded-2xl border border-[#EFE0DA] bg-[#FFFCF8] p-8 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#873F50]">
              Private
            </p>
            <h1 className="mt-3 font-romantic text-3xl text-[#29201F]">Admin dashboard</h1>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="rounded-full border border-[#873F50] px-6 py-3 text-sm font-semibold text-[#873F50] transition hover:bg-[#873F50] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {signingOut ? 'Logging out…' : 'Log out'}
          </button>
        </div>

        <p className="mt-8 text-sm leading-7 text-[#756360]">
          You are signed in as the designated administrator. The private response overview and
          history are available in the response dashboard.
        </p>
        <button
          type="button"
          onClick={() => navigate('/admin/responses', true)}
          className="mt-6 rounded-full bg-[#873F50] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#6E3141]"
        >
          Open response dashboard
        </button>
      </div>
    </main>
  )
}
