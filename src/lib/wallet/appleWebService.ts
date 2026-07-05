import "server-only";
import { serviceClient } from "@/lib/supabase/service";
import { getCafeById } from "@/lib/cafe";
import { getCustomerByPassSerial } from "@/lib/data/customers";
import { buildPkpass } from "@/lib/wallet/apple";

/**
 * Implémentation du web service PassKit (protocole Apple Wallet).
 * L'authentification se fait par le header `Authorization: ApplePass <token>`,
 * où le token = pass_serial (fixé dans pass.json). Tout tourne côté serveur
 * avec le service role.
 */

/** Vérifie que le token d'auth correspond bien au serial demandé. */
export function checkAuth(authHeader: string | null, serialNumber: string): boolean {
  if (!authHeader) return false;
  const [scheme, token] = authHeader.split(" ");
  return scheme === "ApplePass" && token === serialNumber;
}

export async function registerDevice(input: {
  deviceLibraryId: string;
  serialNumber: string;
  pushToken: string;
}): Promise<"created" | "exists" | "not_found"> {
  const customer = await getCustomerByPassSerial(input.serialNumber);
  if (!customer || !customer.pass_serial) return "not_found";

  const supabase = serviceClient();
  const { data: existing } = await supabase
    .from("apple_wallet_registrations")
    .select("id")
    .eq("device_library_id", input.deviceLibraryId)
    .eq("pass_serial", customer.pass_serial)
    .maybeSingle();

  if (existing) return "exists";

  const { error } = await supabase.from("apple_wallet_registrations").insert({
    cafe_id: customer.cafe_id,
    customer_id: customer.id,
    pass_serial: customer.pass_serial,
    device_library_id: input.deviceLibraryId,
    push_token: input.pushToken,
  });
  if (error) throw error;
  return "created";
}

export async function unregisterDevice(input: {
  deviceLibraryId: string;
  serialNumber: string;
}): Promise<void> {
  await serviceClient()
    .from("apple_wallet_registrations")
    .delete()
    .eq("device_library_id", input.deviceLibraryId)
    .eq("pass_serial", input.serialNumber);
}

/** Sérials à jour pour un appareil (protocole : liste + lastUpdated). */
export async function listSerials(
  deviceLibraryId: string,
): Promise<{ serialNumbers: string[]; lastUpdated: string }> {
  const { data } = await serviceClient()
    .from("apple_wallet_registrations")
    .select("pass_serial")
    .eq("device_library_id", deviceLibraryId);
  return {
    serialNumbers: (data ?? []).map((r) => r.pass_serial),
    lastUpdated: String(Math.floor(Date.now() / 1000)),
  };
}

/** Génère le .pkpass à jour pour un serial (GET latest pass). */
export async function latestPass(serialNumber: string): Promise<Buffer | null> {
  const customer = await getCustomerByPassSerial(serialNumber);
  if (!customer) return null;
  const cafe = await getCafeById(customer.cafe_id);
  if (!cafe) return null;
  return buildPkpass(cafe, customer);
}
