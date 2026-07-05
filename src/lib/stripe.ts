import "server-only";
import Stripe from "stripe";
import { env, stripeConfigured } from "@/lib/env";

/**
 * Intégration Stripe — env-gated. Paiements TWINT + carte, en click & collect
 * (payé d'avance). Le PaymentIntent est créé côté SERVEUR avec un montant
 * calculé serveur et une clé d'idempotence par commande. Le webhook (vérifié
 * par signature) est la SOURCE DE VÉRITÉ pour confirmer la commande.
 */

let cached: Stripe | null = null;

export function stripeClient(): Stripe {
  if (!stripeConfigured()) {
    throw new Error(
      "Stripe non configuré (STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET). Voir .env.example.",
    );
  }
  if (!cached) {
    cached = new Stripe(env.stripeSecretKey()!, {
      // Version d'API épinglée pour la stabilité.
      apiVersion: "2024-12-18.acacia" as Stripe.LatestApiVersion,
      typescript: true,
    });
  }
  return cached;
}

export type CreateIntentInput = {
  orderId: string;
  cafeId: string;
  amountCents: number;
  currency: string; // "chf"
  customerPhone: string;
  orderNumber: string;
};

/**
 * Crée (idempotemment) le PaymentIntent d'une commande. TWINT + carte activés.
 * La clé d'idempotence = orderId : un double submit ne crée pas deux intents.
 */
export async function createOrderPaymentIntent(
  input: CreateIntentInput,
): Promise<{ clientSecret: string; paymentIntentId: string }> {
  const stripe = stripeClient();
  const intent = await stripe.paymentIntents.create(
    {
      amount: input.amountCents,
      currency: input.currency.toLowerCase(),
      // TWINT (Suisse) + carte. `automatic_payment_methods` pourrait suffire,
      // mais on liste explicitement pour garantir TWINT.
      payment_method_types: ["card", "twint"],
      metadata: {
        order_id: input.orderId,
        cafe_id: input.cafeId,
        order_number: input.orderNumber,
        customer_phone: input.customerPhone,
      },
    },
    { idempotencyKey: `order_${input.orderId}` },
  );

  if (!intent.client_secret) {
    throw new Error("Stripe n'a pas renvoyé de client_secret.");
  }
  return { clientSecret: intent.client_secret, paymentIntentId: intent.id };
}

/** Vérifie la signature du webhook et renvoie l'événement typé. */
export function constructWebhookEvent(
  rawBody: string | Buffer,
  signature: string,
): Stripe.Event {
  const stripe = stripeClient();
  return stripe.webhooks.constructEvent(
    rawBody,
    signature,
    env.stripeWebhookSecret()!,
  );
}
