import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseConfig } from './env.js'

let cachedClient: SupabaseClient | null = null

export function getAdminClient(): SupabaseClient {
  if (!cachedClient) {
    const { url, secretKey } = getSupabaseConfig()

    cachedClient = createClient(url, secretKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: {
          'x-application-name': 'roqeebah-response-api',
        },
      },
    })
  }

  return cachedClient
}

export interface RpcResult {
  status?: unknown
  [key: string]: unknown
}

export async function callRpc<T = RpcResult>(
  name: string,
  args: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await getAdminClient().rpc(name, args)

  if (error) {
    throw error
  }

  if (data === null || data === undefined) {
    throw new Error(`RPC ${name} returned no data.`)
  }

  return data as T
}

export function statusOf(result: RpcResult): string {
  return typeof result.status === 'string' ? result.status : ''
}
