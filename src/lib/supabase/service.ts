import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { env } from "@/lib/env";

/**
 * Client Supabase "service role" — RÉSERVÉ AU SERVEUR.
 *
 * Contourne la RLS : c'est le seul moyen par lequel les opérations CLIENT
 * (menu public, checkout, crédit de points) touchent la base, TOUJOURS
 * scopées par `cafe_id` dans le code. Ne JAMAIS importer côté client
 * (`import "server-only"` fait échouer le build si c'est tenté).
 */
let cached: SupabaseClient<Database> | null = null;

export function serviceClient(): SupabaseClient<Database> {
  if (cached) return cached;
  cached = createClient<Database>(env.supabaseUrl(), env.supabaseServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
