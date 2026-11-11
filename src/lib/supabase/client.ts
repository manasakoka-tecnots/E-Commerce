// src/lib/supabase/client.ts
import { createClient } from "@supabase/supabase-js";

/**
 * Supabase client used throughout the app.
 *
 * NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
 * are defined in .env (or .env.local). They are safe to expose to the
 * browser because they are the public, client‑side credentials.
 */
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * Helper for server‑side code to retrieve the current session.
 * Returns the session object (or null) without exposing the service‑role key.
 */
export async function getServerSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) console.error("Supabase session error:", error);
  return data.session ?? null;
}
