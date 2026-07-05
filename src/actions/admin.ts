"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/staff";
import { staffClient } from "@/lib/supabase/server";
import { serviceClient } from "@/lib/supabase/service";
import { getCustomerByPassSerial } from "@/lib/data/customers";
import { sendOrderEmail } from "@/lib/email/send";
import { syncPass } from "@/lib/wallet";
import type { Enums, TablesInsert } from "@/types/supabase";

/**
 * Server actions du back-office. Chacune part de `requireStaff()` → le café
 * du staff. Les écritures scopées passent par le client RLS (staffClient) ;
 * les RPC fidélité passent par le service role APRÈS vérification du café.
 */

// ---------- Statuts de commande ----------
const NEXT_STATUS: Record<string, Enums<"order_status"> | undefined> = {
  paid: "preparing",
  preparing: "ready",
  ready: "collected",
};

export async function advanceOrderStatus(orderId: string): Promise<void> {
  const staff = await requireStaff();
  const supabase = await staffClient();

  const { data: order } = await supabase
    .from("orders")
    .select("id, status, cafe_id")
    .eq("id", orderId)
    .single();
  if (!order || order.cafe_id !== staff.cafe.id) throw new Error("introuvable");

  const next = NEXT_STATUS[order.status];
  if (!next) throw new Error("transition_invalide");

  const { error } = await supabase.from("orders").update({ status: next }).eq("id", orderId);
  if (error) throw error;

  // Email "c'est prêt" au passage en ready.
  if (next === "ready") await sendOrderEmail(orderId, "ready");

  revalidatePath("/admin/orders");
}

export async function setOrderStatusTo(
  orderId: string,
  status: Enums<"order_status">,
): Promise<void> {
  const staff = await requireStaff();
  const supabase = await staffClient();
  const { data: order } = await supabase
    .from("orders")
    .select("id, cafe_id")
    .eq("id", orderId)
    .single();
  if (!order || order.cafe_id !== staff.cafe.id) throw new Error("introuvable");

  const { error } = await supabase.from("orders").update({ status }).eq("id", orderId);
  if (error) throw error;
  revalidatePath("/admin/orders");
}

// ---------- Rush stop ----------
export async function setOrderingOpen(open: boolean): Promise<void> {
  const staff = await requireStaff();
  const supabase = await staffClient();
  const { error } = await supabase
    .from("slots_config")
    .update({ is_ordering_open: open })
    .eq("cafe_id", staff.cafe.id);
  if (error) throw error;
  revalidatePath("/admin/slots");
  revalidatePath("/admin");
}

// ---------- Menu CRUD ----------
const MenuItemSchema = z.object({
  id: z.string().uuid().optional(),
  category_id: z.string().uuid().nullable().optional(),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  price_cents: z.number().int().min(0),
  vat_rate: z.number(),
  is_available: z.boolean(),
  sort_order: z.number().int().optional(),
});

export async function upsertMenuItem(
  input: z.infer<typeof MenuItemSchema>,
): Promise<void> {
  const staff = await requireStaff();
  const parsed = MenuItemSchema.parse(input);
  const supabase = await staffClient();

  const row: TablesInsert<"menu_items"> = {
    cafe_id: staff.cafe.id,
    name: parsed.name,
    description: parsed.description ?? null,
    price_cents: parsed.price_cents,
    vat_rate: parsed.vat_rate,
    is_available: parsed.is_available,
    category_id: parsed.category_id ?? null,
    sort_order: parsed.sort_order ?? 0,
  };
  if (parsed.id) row.id = parsed.id;

  const { error } = await supabase.from("menu_items").upsert(row);
  if (error) throw error;
  revalidatePath("/admin/menu");
}

export async function toggleItemAvailability(
  itemId: string,
  available: boolean,
): Promise<void> {
  const staff = await requireStaff();
  const supabase = await staffClient();
  const { error } = await supabase
    .from("menu_items")
    .update({ is_available: available })
    .eq("id", itemId)
    .eq("cafe_id", staff.cafe.id);
  if (error) throw error;
  revalidatePath("/admin/menu");
}

// ---------- Créneaux ----------
const SlotsSchema = z.object({
  open_time: z.string(),
  close_time: z.string(),
  slot_minutes: z.number().int().min(1),
  capacity_per_slot: z.number().int().min(1),
  min_prep_minutes: z.number().int().min(0),
});

export async function updateSlotsConfig(
  input: z.infer<typeof SlotsSchema>,
): Promise<void> {
  const staff = await requireStaff();
  const parsed = SlotsSchema.parse(input);
  const supabase = await staffClient();
  const { error } = await supabase
    .from("slots_config")
    .update(parsed)
    .eq("cafe_id", staff.cafe.id);
  if (error) throw error;
  revalidatePath("/admin/slots");
}

// ---------- Scan + fidélité ----------
export type ScanResult =
  | {
      ok: true;
      customer: { id: string; name: string | null; points_balance: number };
      rewards: { id: string; name: string; cost_points: number; affordable: boolean }[];
    }
  | { ok: false; error: string };

/** Lit un pass_serial scanné → client + solde + récompenses éligibles. */
export async function lookupPass(passSerial: string): Promise<ScanResult> {
  const staff = await requireStaff();
  const customer = await getCustomerByPassSerial(passSerial.trim());
  if (!customer || customer.cafe_id !== staff.cafe.id) {
    return { ok: false, error: "Pass inconnu pour ce café." };
  }

  const { data: rewards } = await serviceClient()
    .from("rewards")
    .select("id, name, cost_points")
    .eq("cafe_id", staff.cafe.id)
    .eq("is_active", true)
    .order("sort_order");

  return {
    ok: true,
    customer: {
      id: customer.id,
      name: customer.name,
      points_balance: customer.points_balance,
    },
    rewards: (rewards ?? []).map((r) => ({
      ...r,
      affordable: customer.points_balance >= r.cost_points,
    })),
  };
}

export type RedeemResult =
  | { ok: true; newBalance: number }
  | { ok: false; error: string };

/** Débite une récompense (transaction en base) puis pousse le pass. */
export async function redeemReward(
  customerId: string,
  rewardId: string,
): Promise<RedeemResult> {
  const staff = await requireStaff();

  // Vérifie que le client appartient bien au café du staff (service role
  // contourne la RLS → on scope ici).
  const { data: customer } = await serviceClient()
    .from("customers")
    .select("cafe_id")
    .eq("id", customerId)
    .maybeSingle();
  if (!customer || customer.cafe_id !== staff.cafe.id) {
    return { ok: false, error: "Client hors de votre café." };
  }

  const { data, error } = await serviceClient().rpc("redeem_reward", {
    p_customer_id: customerId,
    p_reward_id: rewardId,
  });
  if (error) return { ok: false, error: "Solde insuffisant ou récompense invalide." };

  await syncPass(customerId);
  return { ok: true, newBalance: data?.[0]?.points_balance ?? 0 };
}

/** Correction manuelle de points par le staff (reason='adjust'). */
export async function adjustPoints(
  customerId: string,
  delta: number,
): Promise<RedeemResult> {
  const staff = await requireStaff();
  const { data: customer } = await serviceClient()
    .from("customers")
    .select("cafe_id")
    .eq("id", customerId)
    .maybeSingle();
  if (!customer || customer.cafe_id !== staff.cafe.id) {
    return { ok: false, error: "Client hors de votre café." };
  }

  const { data, error } = await serviceClient().rpc("adjust_points", {
    p_customer_id: customerId,
    p_delta: Math.trunc(delta),
  });
  if (error) return { ok: false, error: "Ajustement impossible (solde négatif ?)." };

  await syncPass(customerId);
  return { ok: true, newBalance: data?.[0]?.points_balance ?? 0 };
}
