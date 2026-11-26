import { createContext } from 'react'
import type { Session } from '@supabase/supabase-js'

export interface AdminAuthContextValue {
  session: Session | null
  isAdmin: boolean
  loading: boolean
  configured: boolean
  signIn: (email: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
}

export const AdminAuthContext = createContext<AdminAuthContextValue | null>(null)
