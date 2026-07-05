import "server-only";
import { serviceClient } from "@/lib/supabase/service";
import { formatOrderNumber, orderNumberPrefix } from "@/lib/cafe";
import type { Tables } from "@/types/supabase";
import type { Json } from "@/types/supabase";

export type Order = Tables<"orders">;
export type OrderItem = Tables<"order_items">;

export type OrderLineInput = {
  menuItemId: string;
  nameSnapshot: string;
  unitPriceCents: number;
  vatRate: number;
  qty: number;
  note?: string | null;
};

export type CreatePendingOrderInput = {
  cafeId: string;
  slug: string;
  customerId: string;
  pickupSlotIso: string;
  subtotalCents: number;
  totalCents: number;
  vatBreakdown: Record<string, number>;
  lines: OrderLineInput[];
};

/** Séquence de numéro pour le café sur le mois courant (YYMM). */
async function nextSeq(cafeId: string, prefix: string, now: Date): Promise<number> {
  const yy = String(now.getUTCFullYear()).slice(-2);
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const like = `${prefix}-${yy}${mm}-%`;
  const { count, error } = await serviceClient()
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("cafe_id", cafeId)
    .like("order_number", like);
  if (error) throw error;
  return (count ?? 0) + 1;
}

/**
 * Crée une commande en `pending_payment` (réservation soft du créneau) + ses
 * lignes figées (name_snapshot / unit_price_cents / vat_rate). Les montants
 * sont ceux calculés SERVEUR. Réessaie si collision sur le numéro de commande.
 */
export async function createPendingOrder(
  input: CreatePendingOrderInput,
): Promise<Order> {
  const supabase = serviceClient();
  const now = new Date();
  const prefix = orderNumberPrefix(input.slug);
  let seq = await nextSeq(input.cafeId, prefix, now);

  for (let attempt = 0; attempt < 5; attempt++) {
    const orderNumber = formatOrderNumber(prefix, now, seq);
    const { data: order, error } = await supabase
      .from("orders")
      .insert({
        cafe_id: input.cafeId,
        customer_id: input.customerId,
        order_number: orderNumber,
        status: "pending_payment",
        pickup_slot: input.pickupSlotIso,
        subtotal_cents: input.subtotalCents,
        total_cents: input.totalCents,
        vat_breakdown: input.vatBreakdown as Json,
      })
      .select("*")
      .single();

    if (error) {
      // 23505 = collision sur (cafe_id, order_number) → on incrémente et on réessaie.
      if (error.code === "23505") {
        seq += 1;
        continue;
      }
      throw error;
    }

    const { error: itemsErr } = await supabase.from("order_items").insert(
      input.lines.map((l) => ({
        order_id: order.id,
        menu_item_id: l.menuItemId,
        name_snapshot: l.nameSnapshot,
        qty: l.qty,
        unit_price_cents: l.unitPriceCents,
        vat_rate: l.vatRate,
        note: l.note ?? null,
      })),
    );
    if (itemsErr) {
      // Nettoyage best-effort : on ne laisse pas une commande sans lignes.
      await supabase.from("orders").delete().eq("id", order.id);
      throw itemsErr;
    }

    return order;
  }

  throw new Error("Impossible de générer un numéro de commande unique.");
}

export async function getOrderById(id: string): Promise<Order | null> {
  const { data, error } = await serviceClient()
    .from("orders")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getOrderItems(orderId: string): Promise<OrderItem[]> {
  const { data, error } = await serviceClient()
    .from("order_items")
    .select("*")
    .eq("order_id", orderId);
  if (error) throw error;
  return data ?? [];
}

export async function setOrderStatus(
  orderId: string,
  status: Tables<"orders">["status"],
): Promise<void> {
  const { error } = await serviceClient()
    .from("orders")
    .update({ status })
    .eq("id", orderId);
  if (error) throw error;
}

export async function attachPaymentIntent(
  orderId: string,
  paymentIntentId: string,
): Promise<void> {
  const { error } = await serviceClient()
    .from("orders")
    .update({ stripe_payment_intent: paymentIntentId })
    .eq("id", orderId);
  if (error) throw error;
}
