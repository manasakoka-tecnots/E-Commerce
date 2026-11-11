// src/lib/supabase/server.ts
import { createClient } from "@supabase/supabase-js";

/**
 * Supabase client with service‑role key for server‑side operations.
 * Uses env vars defined in .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL – public URL
 *   SUPABASE_SERVICE_ROLE_KEY – admin key (never exposed to client)
 */
export const supabaseAdmin = process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
  : null;
