import "server-only";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/supabase";
import { env } from "@/lib/env";

/**
 * Client Supabase authentifié STAFF (SSR, via cookies).
 *
 * Utilise la clé anon + la session du staff : toutes les requêtes passent
 * par la RLS (table `staff` + `is_cafe_staff`). Un membre ne voit donc que
 * SON café. C'est le client utilisé dans le back-office `/admin`.
 */
export async function staffClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(env.supabaseUrl(), env.supabaseAnonKey(), {
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
}
