import "server-only";
import crypto from "node:crypto";
import { serviceClient } from "@/lib/supabase/service";
import { getCafeById, type Cafe } from "@/lib/cafe";
import { getCustomerById, getCustomerByPassSerial } from "@/lib/data/customers";
import { patchGooglePoints, issueGooglePass } from "@/lib/wallet/google";
import { buildPkpass, pushPassUpdate } from "@/lib/wallet/apple";
import {
  appleWalletConfigured,
  googleWalletConfigured,
} from "@/lib/env";
import type { Tables } from "@/types/supabase";

export type PassPlatform = Tables<"customers">["pass_platform"];

/**
 * Attribue un pass_serial (uuid) au client s'il n'en a pas, SANS fixer de
 * plateforme (l'inscription choisit Apple ou Google ensuite). Renvoie le serial.
 */
export async function mintPassSerial(customerId: string): Promise<string> {
  const customer = await getCustomerById(customerId);
  if (!customer) throw new Error("customer_not_found");
  if (customer.pass_serial) return customer.pass_serial;

  const serial = crypto.randomUUID();
  const { error } = await serviceClient()
    .from("customers")
    .update({ pass_serial: serial })
    .eq("id", customerId);
  if (error) throw error;
  return serial;
}

/** Attribue un pass_serial (uuid) au client si absent, et fixe la plateforme. */
export async function ensurePassSerial(
  customerId: string,
  platform: NonNullable<PassPlatform>,
): Promise<Tables<"customers">> {
  const supabase = serviceClient();
  const customer = await getCustomerById(customerId);
  if (!customer) throw new Error("customer_not_found");

  if (customer.pass_serial && customer.pass_platform === platform) return customer;

  const patch: Partial<Tables<"customers">> = { pass_platform: platform };
  if (!customer.pass_serial) patch.pass_serial = crypto.randomUUID();

  const { data, error } = await supabase
    .from("customers")
    .update(patch)
    .eq("id", customerId)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

/**
 * Pousse le solde à jour vers le(s) Wallet(s) du client. Appelé après TOUT
 * changement de solde (crédit au webhook, dépense au scan, expiration).
 * Tente Apple (APNs) ET Google (PATCH) ; chacun se désactive proprement si
 * non configuré / non applicable. Ne lève jamais.
 */
export async function syncPass(customerId: string): Promise<void> {
  try {
    const customer = await getCustomerById(customerId);
    if (!customer || !customer.pass_serial) return;

    const tasks: Promise<unknown>[] = [];
    if (googleWalletConfigured()) tasks.push(patchGooglePoints(customer));
    if (appleWalletConfigured()) tasks.push(pushPassUpdate(customer.pass_serial));

    const results = await Promise.allSettled(tasks);
    for (const r of results) {
      if (r.status === "rejected") {
        console.error("[wallet:syncPass] échec de propagation:", r.reason);
      }
    }
  } catch (err) {
    console.error("[wallet:syncPass] erreur:", err);
  }
}

/** Résout le client depuis le track_token d'une commande (émission de pass). */
export async function customerFromTrackToken(
  trackToken: string,
): Promise<{ cafe: Cafe; customer: Tables<"customers"> } | null> {
  const { data: order } = await serviceClient()
    .from("orders")
    .select("cafe_id, customer_id")
    .eq("track_token", trackToken)
    .maybeSingle();
  if (!order) return null;

  const customer = await getCustomerById(order.customer_id);
  const cafe = await getCafeById(order.cafe_id);
  if (!customer || !cafe) return null;
  return { cafe, customer };
}

/** Émet un pass Apple (.pkpass) pour le porteur d'un track_token. */
export async function issueAppleForToken(
  trackToken: string,
): Promise<{ cafe: Cafe; buffer: Buffer } | null> {
  const resolved = await customerFromTrackToken(trackToken);
  if (!resolved) return null;
  const customer = await ensurePassSerial(resolved.customer.id, "apple");
  const buffer = await buildPkpass(resolved.cafe, customer);
  return { cafe: resolved.cafe, buffer };
}

/** Émet un pass Google (lien "Save to Google Wallet") pour un track_token. */
export async function issueGoogleForToken(
  trackToken: string,
): Promise<string | null> {
  const resolved = await customerFromTrackToken(trackToken);
  if (!resolved) return null;
  const customer = await ensurePassSerial(resolved.customer.id, "google");
  return issueGooglePass(resolved.cafe, customer);
}

/** Résout le café + client à partir du pass_serial (émission hors commande). */
async function resolveBySerial(
  passSerial: string,
): Promise<{ cafe: Cafe; customer: Tables<"customers"> } | null> {
  const customer = await getCustomerByPassSerial(passSerial);
  if (!customer) return null;
  const cafe = await getCafeById(customer.cafe_id);
  if (!cafe) return null;
  return { cafe, customer };
}

/**
 * Émet un pass Apple pour un `pass_serial` (parcours d'inscription en boutique,
 * sans commande). Fixe la plateforme sur 'apple'.
 */
export async function issueAppleForSerial(
  passSerial: string,
): Promise<{ cafe: Cafe; buffer: Buffer } | null> {
  const resolved = await resolveBySerial(passSerial);
  if (!resolved) return null;
  const customer = await ensurePassSerial(resolved.customer.id, "apple");
  const buffer = await buildPkpass(resolved.cafe, customer);
  return { cafe: resolved.cafe, buffer };
}

/** Émet un pass Google pour un `pass_serial` (inscription en boutique). */
export async function issueGoogleForSerial(
  passSerial: string,
): Promise<string | null> {
  const resolved = await resolveBySerial(passSerial);
  if (!resolved) return null;
  const customer = await ensurePassSerial(resolved.customer.id, "google");
  return issueGooglePass(resolved.cafe, customer);
}
