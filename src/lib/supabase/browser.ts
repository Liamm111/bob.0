"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/supabase";

/**
 * Client Supabase pour composants client (back-office). Utilisé uniquement
 * pour l'auth staff (login/logout) et les abonnements Realtime. Toutes les
 * lectures/écritures restent soumises à la RLS (clé anon + session staff).
 */
export function browserClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
