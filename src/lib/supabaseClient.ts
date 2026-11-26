import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null
let initialized = false

// Browser-safe Supabase client. Only the publishable key is read here.
// The Supabase secret key must never be exposed with a VITE_ prefix.
export function getBrowserSupabase(): SupabaseClient | null {
  if (initialized) return client
  initialized = true

  const url = import.meta.env.VITE_SUPABASE_URL?.trim()
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()

  if (!url || !publishableKey) return null

  try {
    client = createClient(url, publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  } catch {
    client = null
  }

  return client
}
