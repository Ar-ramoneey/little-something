import AdminDashboard from './AdminDashboard'
import AdminLogin from './AdminLogin'
import ProtectedAdminRoute from './ProtectedAdminRoute'
import ResponseDashboard from './ResponseDashboard'
import { isAdminLogin, isAdminResponses, navigate } from '../../lib/router'

function AdminNotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F9F1EC] px-6 py-16">
      <div className="w-full max-w-md rounded-2xl border border-[#EFE0DA] bg-[#FFFCF8] p-8 text-center shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#873F50]">
          Private
        </p>
        <h1 className="mt-3 font-romantic text-3xl text-[#29201F]">Page not found</h1>
        <p className="mt-4 text-sm leading-7 text-[#756360]">
          This admin page does not exist.
        </p>
        <button
          type="button"
          onClick={() => navigate('/admin/responses', true)}
          className="mt-6 rounded-full bg-[#873F50] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#6E3141]"
        >
          Go to responses
        </button>
      </div>
    </main>
  )
}

export default function AdminApp({ path }: { path: string }) {
  if (isAdminLogin(path)) {
    return <AdminLogin />
  }

  if (isAdminResponses(path)) {
    return (
      <ProtectedAdminRoute>
        <ResponseDashboard />
      </ProtectedAdminRoute>
    )
  }

  if (path === '/admin') {
    return (
      <ProtectedAdminRoute>
        <AdminDashboard />
      </ProtectedAdminRoute>
    )
  }

  return (
    <ProtectedAdminRoute>
      <AdminNotFound />
    </ProtectedAdminRoute>
  )
}
