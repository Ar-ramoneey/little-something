import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { AdminAuthContext, type AdminAuthContextValue } from './adminAuthContext'
import { friendlyAuthError, isAdminSession } from '../lib/adminAuth'
import { getBrowserSupabase } from '../lib/supabaseClient'

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const client = getBrowserSupabase()
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(client !== null)

  useEffect(() => {
    if (!client) return

    let active = true

    client.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return
        setSession(data.session)
        setLoading(false)
      })
      .catch(() => {
        if (active) setLoading(false)
      })

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return
      setSession(nextSession)
      setLoading(false)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [client])

  const signIn = useCallback(
    async (email: string, password: string): Promise<string | null> => {
      if (!client) return 'Admin authentication is not configured.'

      const { error } = await client.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      return error ? friendlyAuthError(error.message) : null
    },
    [client],
  )

  const signOut = useCallback(async (): Promise<void> => {
    if (client) await client.auth.signOut()
  }, [client])

  const value = useMemo<AdminAuthContextValue>(
    () => ({
      session,
      isAdmin: isAdminSession(session),
      loading,
      configured: client !== null,
      signIn,
      signOut,
    }),
    [session, loading, client, signIn, signOut],
  )

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>
}
