import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Read-only client for V1 — the old Lovable-owned Supabase project.
 *
 * We lost admin access to V1 (it lived in Lovable's organization and the Lovable
 * project was deleted), so it cannot be migrated wholesale: auth.users, and with it
 * every email and password hash, is unreachable without the service_role key.
 *
 * What still works is the anon key. So a returning user signs in against V1 with
 * their existing password, and that session — which does carry their email, and can
 * read their own profile/enrollments/progress under own-row RLS — is what we use to
 * rebuild them in V2. Each user migrates themselves, on their next login.
 *
 * This client is used ONLY during that handoff. Everything else in the app talks to
 * V2. Once a user has migrated they never touch V1 again.
 */

const LEGACY_URL = import.meta.env.VITE_LEGACY_SUPABASE_URL as string | undefined;
const LEGACY_KEY = import.meta.env.VITE_LEGACY_SUPABASE_ANON_KEY as string | undefined;

/** False once V1 is switched off, at which point the fallback simply stops running. */
export const legacyEnabled = Boolean(LEGACY_URL && LEGACY_KEY);

export function legacyClient(): SupabaseClient {
  if (!legacyEnabled) {
    throw new Error('Legacy project is not configured.');
  }
  return createClient(LEGACY_URL!, LEGACY_KEY!, {
    auth: {
      // Never let a V1 session become the app's session: it must not be written to
      // localStorage, and it must not be picked up on the next page load. It lives
      // just long enough to prove who the user is and hand their data to V2.
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
