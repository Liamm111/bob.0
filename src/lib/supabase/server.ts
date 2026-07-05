import "server-only";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "@/types/supabase";
import { env } from "@/lib/env";

/**
 * Client Supabase authentifié STAFF (SSR, via cookies).
 *
 * Utilise la clé anon + la session du staff : toutes les requêtes passent
 * par la RLS (table `staff` + `is_cafe_staff`). Un membre ne voit donc que
 * SON café. C'est le client utilisé dans le back-office `/admin`.
 *
 * NB : `@supabase/ssr` ne propage pas le générique `Database` au typage des
 * requêtes `.from()/.rpc()` (versions internes de postgrest-js divergentes).
 * On caste vers `SupabaseClient<Database>` de `@supabase/supabase-js` — le
 * runtime est identique (createServerClient enveloppe createClient).
 */
export async function staffClient(): Promise<SupabaseClient<Database>> {
  const cookieStore = await cookies();
  const client = createServerClient<Database>(env.supabaseUrl(), env.supabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(
        cookiesToSet: {
          name: string;
          value: string;
          options: CookieOptions;
        }[],
      ) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Appelé depuis un Server Component : le middleware rafraîchit la session.
        }
      },
    },
  });
  return client as unknown as SupabaseClient<Database>;
}
