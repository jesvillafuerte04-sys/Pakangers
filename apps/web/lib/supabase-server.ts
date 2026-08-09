import "server-only";
import { createBrowserClient, createServiceClient, type TypedSupabaseClient } from "@pakangers/db";

/** Server-side, read-only equivalent of the anon client -- fine for any Server Component. */
export function getAnonSupabase(): TypedSupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  return createBrowserClient(url, anonKey);
}

/**
 * Bypasses every RLS policy. Only ever call this from a Server Action or
 * Route Handler that has already verified an organizer session -- never
 * from anything that could run in, or be imported by, the browser bundle.
 * The `server-only` import above makes an accidental client import a build
 * error, not just a runtime surprise.
 */
export function getServiceSupabase(): TypedSupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createServiceClient(url, serviceKey);
}
