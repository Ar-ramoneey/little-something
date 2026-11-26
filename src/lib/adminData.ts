import type { SupabaseClient } from '@supabase/supabase-js'

export interface ResponseRow {
  id: string
  proposal_id: string
  response: string
  created_at: string
  updated_at: string
}

export interface HistoryRow {
  id: string
  previous_response: string | null
  new_response: string
  changed_at: string
}

export interface NotificationRow {
  id: string
  status: string
  occurred_at: string
  sent_at: string | null
  attempts: number
}

export interface AdminDashboardData {
  response: ResponseRow | null
  history: HistoryRow[]
  notifications: NotificationRow[]
}

const DEFAULT_PROPOSAL_ID = 'roqeebah-001'

// This is an identifier, not a secret. It must match the API's PROPOSAL_ID.
export function getAdminProposalId(): string {
  return import.meta.env.VITE_PROPOSAL_ID?.trim() || DEFAULT_PROPOSAL_ID
}

// All reads use the browser publishable key and are enforced by Supabase RLS.
// No admin role or secret key is trusted here.
export async function fetchAdminDashboardData(
  client: SupabaseClient,
): Promise<AdminDashboardData> {
  const { data: response, error: responseError } = await client
    .from('proposal_responses')
    .select('id, proposal_id, response, created_at, updated_at')
    .eq('proposal_id', getAdminProposalId())
    .maybeSingle()

  if (responseError) {
    throw new Error('Could not load the current response.')
  }

  if (!response) {
    return { response: null, history: [], notifications: [] }
  }

  const responseRow = response as ResponseRow

  const [historyResult, notificationResult] = await Promise.all([
    client
      .from('proposal_response_history')
      .select('id, previous_response, new_response, changed_at')
      .eq('response_id', responseRow.id)
      .order('changed_at', { ascending: true }),
    client
      .from('response_notifications')
      .select('id, status, occurred_at, sent_at, attempts')
      .eq('response_id', responseRow.id)
      .order('occurred_at', { ascending: true }),
  ])

  if (historyResult.error) {
    throw new Error('Could not load response history.')
  }
  if (notificationResult.error) {
    throw new Error('Could not load notification status.')
  }

  return {
    response: responseRow,
    history: (historyResult.data ?? []) as HistoryRow[],
    notifications: (notificationResult.data ?? []) as NotificationRow[],
  }
}
