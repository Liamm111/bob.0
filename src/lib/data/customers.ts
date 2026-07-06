import "server-only";
import { serviceClient } from "@/lib/supabase/service";
import type { Tables } from "@/types/supabase";

export type Customer = Tables<"customers">;

export type FindOrCreateInput = {
  cafeId: string;
  e164: string;
  display: string;
  name: string;
  email?: string | null;
  marketingConsent?: boolean;
};

/**
 * Trouve-ou-crée un client sur `(cafe_id, phone_e164)`. Zéro friction :
 * pas de compte, pas de mot de passe. Le compte fidélité EXISTE toujours
 * (décision verrouillée). Le consentement marketing est "sticky" : on ne le
 * rétrograde jamais, on ne le monte que sur opt-in explicite.
 *
 * Un client "dormant" (a déjà commandé sans pass) est retrouvé ici et hérite
 * de tout son solde quand il ajoutera un pass (même téléphone).
 */
export async function findOrCreateCustomer(
  input: FindOrCreateInput,
): Promise<Customer> {
  const supabase = serviceClient();

  const { data: existing, error: selErr } = await supabase
    .from("customers")
    .select("*")
    .eq("cafe_id", input.cafeId)
    .eq("phone_e164", input.e164)
    .maybeSingle();
  if (selErr) throw selErr;

  if (existing) {
    const patch: Partial<Tables<"customers">> = {};
    if (input.name && input.name !== existing.name) patch.name = input.name;
    if (input.display && input.display !== existing.phone_display)
      patch.phone_display = input.display;
    if (input.email && input.email !== existing.email) patch.email = input.email;
    if (input.marketingConsent && !existing.marketing_consent)
      patch.marketing_consent = true;

    if (Object.keys(patch).length === 0) return existing;

    const { data: updated, error: updErr } = await supabase
      .from("customers")
      .update(patch)
      .eq("id", existing.id)
      .select("*")
      .single();
    if (updErr) throw updErr;
    return updated;
  }

  const { data: created, error: insErr } = await supabase
    .from("customers")
    .insert({
      cafe_id: input.cafeId,
      phone_e164: input.e164,
      phone_display: input.display,
      name: input.name,
      email: input.email ?? null,
      marketing_consent: input.marketingConsent ?? false,
    })
    .select("*")
    .single();
  if (insErr) throw insErr;
  return created;
}

/** Recherche par téléphone normalisé, scopé par café. `null` si absent. */
export async function getCustomerByPhone(
  cafeId: string,
  e164: string,
): Promise<Customer | null> {
  const { data, error } = await serviceClient()
    .from("customers")
    .select("*")
    .eq("cafe_id", cafeId)
    .eq("phone_e164", e164)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getCustomerById(id: string): Promise<Customer | null> {
  const { data, error } = await serviceClient()
    .from("customers")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Recherche par pass_serial (scan en boutique). */
export async function getCustomerByPassSerial(
  passSerial: string,
): Promise<Customer | null> {
  const { data, error } = await serviceClient()
    .from("customers")
    .select("*")
    .eq("pass_serial", passSerial)
    .maybeSingle();
  if (error) throw error;
  return data;
}
