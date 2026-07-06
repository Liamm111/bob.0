"use server";

import { z } from "zod";
import { getCafeBySlug } from "@/lib/cafe";
import { normalizePhone } from "@/lib/phone";
import { findOrCreateCustomer, getCustomerByPhone } from "@/lib/data/customers";
import { mintPassSerial } from "@/lib/wallet";
import { appleWalletConfigured, googleWalletConfigured } from "@/lib/env";

const EnrollSchema = z.object({
  cafeSlug: z.string().min(1),
  name: z.string().trim().min(1, "Prénom requis").max(80),
  phone: z.string().min(3, "Téléphone requis").max(30),
  marketingConsent: z.boolean().default(false),
});

export type EnrollInput = z.infer<typeof EnrollSchema>;

export type EnrollResult =
  | {
      ok: true;
      passSerial: string;
      appleAvailable: boolean;
      googleAvailable: boolean;
      existing: boolean;
      pointsBalance: number;
    }
  | { ok: false; error: string; field?: string };

/**
 * Inscription fidélité self-service (QR au comptoir). Trouve-ou-crée le client
 * sur le téléphone normalisé, garantit un `pass_serial`, et renvoie de quoi
 * afficher les boutons « Ajouter au Wallet ». Zéro compte, zéro mot de passe.
 */
export async function enrollCustomer(raw: EnrollInput): Promise<EnrollResult> {
  const parsed = EnrollSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first?.message ?? "Saisie invalide", field: String(first?.path[0] ?? "") };
  }
  const input = parsed.data;

  const cafe = await getCafeBySlug(input.cafeSlug);
  if (!cafe) return { ok: false, error: "Café introuvable." };

  let phone;
  try {
    phone = normalizePhone(input.phone, cafe.country_default);
  } catch {
    return { ok: false, error: "Numéro de téléphone invalide.", field: "phone" };
  }

  // Le client existe-t-il déjà (points dormants) ?
  const before = await getCustomerByPhone(cafe.id, phone.e164);

  const customer = await findOrCreateCustomer({
    cafeId: cafe.id,
    e164: phone.e164,
    display: phone.display,
    name: input.name,
    marketingConsent: input.marketingConsent,
  });

  const passSerial = await mintPassSerial(customer.id);

  return {
    ok: true,
    passSerial,
    appleAvailable: appleWalletConfigured(),
    googleAvailable: googleWalletConfigured(),
    existing: Boolean(before),
    pointsBalance: customer.points_balance,
  };
}
