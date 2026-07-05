"use server";

import { z } from "zod";
import { getCafeBySlug } from "@/lib/cafe";
import { normalizePhone } from "@/lib/phone";
import { priceOrder } from "@/lib/pricing";
import { getItemsForPricing } from "@/lib/data/menu";
import { findOrCreateCustomer } from "@/lib/data/customers";
import {
  createPendingOrder,
  attachPaymentIntent,
  type OrderLineInput,
} from "@/lib/data/orders";
import { isValidSlot, slotHasCapacity } from "@/lib/data/slots";
import { createOrderPaymentIntent } from "@/lib/stripe";
import { stripeConfigured, env } from "@/lib/env";

const CartLineSchema = z.object({
  menuItemId: z.string().uuid(),
  qty: z.number().int().min(1).max(50),
  note: z.string().max(280).optional().nullable(),
});

const CheckoutSchema = z.object({
  cafeSlug: z.string().min(1),
  name: z.string().trim().min(1, "Prénom requis").max(80),
  phone: z.string().min(3, "Téléphone requis").max(30),
  marketingConsent: z.boolean().default(false),
  pickupSlotIso: z.string().datetime(),
  cart: z.array(CartLineSchema).min(1, "Panier vide"),
});

export type CheckoutInput = z.infer<typeof CheckoutSchema>;

export type CheckoutResult =
  | {
      ok: true;
      clientSecret: string;
      publishableKey: string;
      orderId: string;
      orderNumber: string;
      trackToken: string;
      totalCents: number;
    }
  | { ok: false; error: string; field?: string };

/**
 * Checkout invité : prénom + téléphone. Recalcule TOUT côté serveur
 * (prix, TVA), trouve-ou-crée le client sur le téléphone normalisé, réserve
 * le créneau en soft (commande `pending_payment`), puis crée le PaymentIntent
 * Stripe (TWINT + carte). Ne renvoie jamais confiance aux montants du client.
 */
export async function checkout(raw: CheckoutInput): Promise<CheckoutResult> {
  const parsed = CheckoutSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first?.message ?? "Saisie invalide", field: String(first?.path[0] ?? "") };
  }
  const input = parsed.data;

  if (!stripeConfigured()) {
    return { ok: false, error: "Le paiement est momentanément indisponible." };
  }

  const cafe = await getCafeBySlug(input.cafeSlug);
  if (!cafe) return { ok: false, error: "Café introuvable." };

  // 1) Téléphone → E.164 (identité client).
  let phone;
  try {
    phone = normalizePhone(input.phone, cafe.country_default);
  } catch {
    return { ok: false, error: "Numéro de téléphone invalide.", field: "phone" };
  }

  // 2) Créneau : valide (dans la grille) ET encore de la place.
  if (!(await isValidSlot(cafe.id, input.pickupSlotIso, cafe.timezone))) {
    return { ok: false, error: "Ce créneau n'est plus proposé.", field: "pickupSlotIso" };
  }
  if (!(await slotHasCapacity(cafe.id, input.pickupSlotIso))) {
    return { ok: false, error: "Ce créneau est complet, choisissez-en un autre.", field: "pickupSlotIso" };
  }

  // 3) Prix/TVA recalculés serveur à partir des items refetchés.
  const itemIds = input.cart.map((c) => c.menuItemId);
  const items = await getItemsForPricing(cafe.id, itemIds);

  const lines: OrderLineInput[] = [];
  for (const c of input.cart) {
    const item = items.get(c.menuItemId);
    if (!item) {
      return { ok: false, error: "Un article de votre panier n'existe plus." };
    }
    if (!item.is_available) {
      return { ok: false, error: `« ${item.name} » est en rupture.` };
    }
    lines.push({
      menuItemId: item.id,
      nameSnapshot: item.name,
      unitPriceCents: item.price_cents,
      vatRate: item.vat_rate,
      qty: c.qty,
      note: c.note ?? null,
    });
  }

  const priced = priceOrder(
    lines.map((l) => ({ unitPriceCents: l.unitPriceCents, vatRate: l.vatRate, qty: l.qty })),
  );

  // 4) Client trouvé-ou-créé (téléphone normalisé).
  const customer = await findOrCreateCustomer({
    cafeId: cafe.id,
    e164: phone.e164,
    display: phone.display,
    name: input.name,
    marketingConsent: input.marketingConsent,
  });

  // 5) Commande pending_payment (réservation soft du créneau).
  const order = await createPendingOrder({
    cafeId: cafe.id,
    slug: cafe.slug,
    customerId: customer.id,
    pickupSlotIso: new Date(input.pickupSlotIso).toISOString(),
    subtotalCents: priced.subtotalCents,
    totalCents: priced.totalCents,
    vatBreakdown: priced.vatBreakdown,
    lines,
  });

  // 6) PaymentIntent Stripe (idempotent, TWINT + carte).
  try {
    const { clientSecret, paymentIntentId } = await createOrderPaymentIntent({
      orderId: order.id,
      cafeId: cafe.id,
      amountCents: priced.totalCents,
      currency: cafe.currency,
      customerPhone: phone.e164,
      orderNumber: order.order_number,
    });
    await attachPaymentIntent(order.id, paymentIntentId);

    return {
      ok: true,
      clientSecret,
      publishableKey: env.stripePublishableKey() ?? "",
      orderId: order.id,
      orderNumber: order.order_number,
      trackToken: order.track_token,
      totalCents: priced.totalCents,
    };
  } catch (err) {
    // Le paiement n'a pas pu démarrer → on libère le créneau.
    await import("@/lib/data/orders").then(({ setOrderStatus }) =>
      setOrderStatus(order.id, "cancelled"),
    );
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Erreur de paiement.",
    };
  }
}
