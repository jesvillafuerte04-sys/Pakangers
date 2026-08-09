import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types.ts';

export type TypedSupabaseClient = SupabaseClient<Database>;

/** Safe to use in the browser — the anon/publishable key, gated entirely by RLS. */
export function createBrowserClient(url: string, anonKey: string): TypedSupabaseClient {
  return createClient<Database>(url, anonKey);
}

/**
 * Server-only. Holds the service role key, which bypasses every RLS policy in
 * this schema. Never import this in anything that ships to the browser — see
 * docs/08-deployment.md's secrets section.
 */
export function createServiceClient(url: string, serviceRoleKey: string): TypedSupabaseClient {
  if (typeof window !== 'undefined') {
    throw new Error('createServiceClient must never run in the browser — it holds the service role key.');
  }
  return createClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
