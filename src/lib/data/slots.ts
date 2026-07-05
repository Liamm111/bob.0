import "server-only";
import { serviceClient } from "@/lib/supabase/service";
import {
  generateSlotTimes,
  buildSlotAvailability,
  SOFT_RESERVATION_MINUTES,
  type Slot,
  type SlotsConfigLike,
} from "@/lib/slots";
import type { Tables } from "@/types/supabase";

export type SlotsConfig = Tables<"slots_config">;

/** États de commande qui "tiennent" fermement une place. */
const FIRM_SEAT_STATUSES = ["paid", "preparing", "ready"] as const;

/**
 * Règle métier : on ne commande que pour le JOUR MÊME et au plus 2 h à
 * l'avance. (daysAhead = 1 → aujourd'hui uniquement ; plafond 120 min.)
 */
const MAX_ORDER_LEAD_MINUTES = 120;
const SAME_DAY_ONLY = 1;

async function getSlotsConfig(cafeId: string): Promise<SlotsConfig | null> {
  const { data, error } = await serviceClient()
    .from("slots_config")
    .select("*")
    .eq("cafe_id", cafeId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Compte les places prises par créneau (clé = ISO du pickup_slot) sur une
 * plage. Une place est prise si la commande est payée/en prépa/prête, OU si
 * c'est une réservation soft `pending_payment` de moins de 10 minutes.
 */
async function getTakenByIso(
  cafeId: string,
  fromIso: string,
  toIso: string,
  now: Date,
): Promise<Record<string, number>> {
  const { data, error } = await serviceClient()
    .from("orders")
    .select("pickup_slot, status, created_at")
    .eq("cafe_id", cafeId)
    .gte("pickup_slot", fromIso)
    .lte("pickup_slot", toIso)
    .in("status", ["paid", "preparing", "ready", "pending_payment"]);
  if (error) throw error;

  const softCutoff = now.getTime() - SOFT_RESERVATION_MINUTES * 60_000;
  const taken: Record<string, number> = {};

  for (const row of data ?? []) {
    const holdsSeat =
      (FIRM_SEAT_STATUSES as readonly string[]).includes(row.status) ||
      (row.status === "pending_payment" &&
        new Date(row.created_at).getTime() >= softCutoff);
    if (!holdsSeat) continue;
    const iso = new Date(row.pickup_slot).toISOString();
    taken[iso] = (taken[iso] ?? 0) + 1;
  }
  return taken;
}

export type AvailableSlotsResult = {
  orderingOpen: boolean;
  slots: Slot[];
};

/** Créneaux proposables au public (génération + disponibilité). */
export async function getAvailableSlots(
  cafeId: string,
  timeZone: string,
  now: Date = new Date(),
): Promise<AvailableSlotsResult> {
  const config = await getSlotsConfig(cafeId);
  if (!config) return { orderingOpen: false, slots: [] };
  if (!config.is_ordering_open) return { orderingOpen: false, slots: [] };

  const times = generateSlotTimes(config as SlotsConfigLike, {
    now,
    timeZone,
    daysAhead: SAME_DAY_ONLY,
    maxAheadMinutes: MAX_ORDER_LEAD_MINUTES,
  });
  if (times.length === 0) return { orderingOpen: true, slots: [] };

  const taken = await getTakenByIso(cafeId, times[0]!, times[times.length - 1]!, now);
  const slots = buildSlotAvailability(times, config.capacity_per_slot, taken);
  return { orderingOpen: true, slots };
}

/**
 * Re-vérifie côté serveur, au moment du checkout, qu'un créneau donné a encore
 * de la place (soft-reserve incluse). Utilisé avant d'insérer la commande.
 */
export async function slotHasCapacity(
  cafeId: string,
  pickupSlotIso: string,
  now: Date = new Date(),
): Promise<boolean> {
  const config = await getSlotsConfig(cafeId);
  if (!config || !config.is_ordering_open) return false;

  const iso = new Date(pickupSlotIso).toISOString();
  const taken = await getTakenByIso(cafeId, iso, iso, now);
  return (taken[iso] ?? 0) < config.capacity_per_slot;
}

/** Un créneau proposé est-il valide (dans la grille générée) ? */
export async function isValidSlot(
  cafeId: string,
  pickupSlotIso: string,
  timeZone: string,
  now: Date = new Date(),
): Promise<boolean> {
  const config = await getSlotsConfig(cafeId);
  if (!config) return false;
  const times = generateSlotTimes(config as SlotsConfigLike, {
    now,
    timeZone,
    daysAhead: SAME_DAY_ONLY,
    maxAheadMinutes: MAX_ORDER_LEAD_MINUTES,
  });
  const target = new Date(pickupSlotIso).toISOString();
  return times.some((t) => new Date(t).toISOString() === target);
}
