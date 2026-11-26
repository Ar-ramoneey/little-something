import { useEffect, type ReactNode } from 'react'
import { useAdminAuth } from '../../auth/useAdminAuth'
import { navigate } from '../../lib/router'

function StatusCard({ title, message }: { title: string; message: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F9F1EC] px-6 py-16">
      <div className="w-full max-w-md rounded-2xl border border-[#EFE0DA] bg-[#FFFCF8] p-8 text-center shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#873F50]">
          Private
        </p>
        <h1 className="mt-3 font-romantic text-3xl text-[#29201F]">{title}</h1>
        <p className="mt-4 text-sm leading-7 text-[#756360]">{message}</p>
        <button
          type="button"
          onClick={() => navigate('/admin/login', true)}
          className="mt-6 rounded-full bg-[#873F50] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#6E3141]"
        >
          Go to admin sign in
        </button>
      </div>
    </main>
  )
}

export default function ProtectedAdminRoute({ children }: { children: ReactNode }) {
  const { session, isAdmin, loading, configured } = useAdminAuth()

  useEffect(() => {
    if (loading) return
    if (!configured || !session || !isAdmin) {
      navigate('/admin/login', true)
    }
  }, [loading, configured, session, isAdmin])

  if (loading) {
    return <StatusCard title="Checking admin access" message="Verifying your session…" />
  }

  if (!configured) {
    return (
      <StatusCard
        title="Admin authentication is not configured"
        message="Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to enable this area."
      />
    )
  }

  if (!session || !isAdmin) {
    return <StatusCard title="Redirecting to sign in" message="Admin access is required." />
  }

  return <>{children}</>
}
