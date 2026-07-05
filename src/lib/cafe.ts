import "server-only";
import { serviceClient } from "@/lib/supabase/service";
import type { Tables } from "@/types/supabase";

export type Cafe = Tables<"cafes">;

/** Jetons de marque (couleurs, logo) — rien de codé en dur, tout vient de la base. */
export type BrandTokens = {
  primary?: string;
  accent?: string;
  bg?: string;
  logoText?: string;
  logoUrl?: string;
};

export function brandTokens(cafe: Cafe): BrandTokens {
  const t = cafe.brand_tokens;
  return (t && typeof t === "object" && !Array.isArray(t) ? t : {}) as BrandTokens;
}

/** Résout un slug public (`brume`, `geneve`…) vers son café. `null` si inconnu. */
export async function getCafeBySlug(slug: string): Promise<Cafe | null> {
  const { data, error } = await serviceClient()
    .from("cafes")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getCafeById(id: string): Promise<Cafe | null> {
  const { data, error } = await serviceClient()
    .from("cafes")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Préfixe de numéro de commande dérivé du slug (ex. "brume" → "BRU"). */
export function orderNumberPrefix(slug: string): string {
  return slug.slice(0, 3).toUpperCase();
}

/**
 * Compose un numéro de commande lisible : `BRU-2607-0042`
 * (préfixe café, année/mois YYMM, séquence sur 4 chiffres).
 */
export function formatOrderNumber(prefix: string, date: Date, seq: number): string {
  const yy = String(date.getUTCFullYear()).slice(-2);
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const seqStr = String(seq).padStart(4, "0");
  return `${prefix}-${yy}${mm}-${seqStr}`;
}
