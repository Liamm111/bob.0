import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { constructWebhookEvent } from "@/lib/stripe";
import { serviceClient } from "@/lib/supabase/service";
import { setOrderStatus } from "@/lib/data/orders";
import { sendOrderEmail } from "@/lib/email/send";
import { syncPass } from "@/lib/wallet";
import { captureException, captureMessage } from "@/lib/monitoring/sentry";

export const runtime = "nodejs";
// Corps brut requis pour la vérification de signature.
export const dynamic = "force-dynamic";

/**
 * Webhook Stripe — SOURCE DE VÉRITÉ. Vérifié par signature.
 *  - payment_intent.succeeded → confirm_order_paid (statut paid + décompte
 *    créneau + crédit points, en UNE transaction, idempotent) → sync Wallet
 *    → email de confirmation.
 *  - payment_intent.payment_failed / canceled → commande cancelled (libère
 *    le créneau).
 *  - charge.refunded → commande refunded + email.
 */
export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "signature manquante" }, { status: 400 });
  }

  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = constructWebhookEvent(rawBody, signature);
  } catch (err) {
    return NextResponse.json(
      { error: `signature invalide: ${err instanceof Error ? err.message : "?"}` },
      { status: 400 },
    );
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        await handleSucceeded(pi);
        break;
      }
      case "payment_intent.payment_failed":
      case "payment_intent.canceled": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const orderId = pi.metadata?.order_id;
        if (orderId) await setOrderStatus(orderId, "cancelled");
        break;
      }
      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const orderId =
          (charge.metadata?.order_id as string | undefined) ??
          (typeof charge.payment_intent === "string"
            ? await orderIdFromPaymentIntent(charge.payment_intent)
            : undefined);
        if (orderId) {
          await setOrderStatus(orderId, "refunded");
          await sendOrderEmail(orderId, "cancelled", { refunded: true });
        }
        break;
      }
      default:
        // Événements non gérés : on acquitte pour éviter les retries inutiles.
        break;
    }
  } catch (err) {
    captureException(err);
    // 500 → Stripe réessaie ; nos opérations sont idempotentes.
    return NextResponse.json({ error: "processing_error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function handleSucceeded(pi: Stripe.PaymentIntent): Promise<void> {
  const orderId = pi.metadata?.order_id;
  if (!orderId) {
    captureMessage(`payment_intent.succeeded sans order_id (pi ${pi.id})`);
    return;
  }

  const { data, error } = await serviceClient().rpc("confirm_order_paid", {
    p_order_id: orderId,
    p_payment_intent: pi.id,
  });
  if (error) throw error;

  const result = data?.[0];
  if (!result) return;

  if (result.overbooked) {
    captureMessage(
      `Créneau en surréservation honorée pour la commande ${orderId} (paiement encaissé).`,
    );
  }

  // Nouvelle confirmation (pas un retry) → sync Wallet + email.
  if (!result.already_confirmed) {
    await syncPass(result.customer_id);
    await sendOrderEmail(orderId, "confirmation");
  }
}

async function orderIdFromPaymentIntent(
  paymentIntentId: string,
): Promise<string | undefined> {
  const { data } = await serviceClient()
    .from("orders")
    .select("id")
    .eq("stripe_payment_intent", paymentIntentId)
    .maybeSingle();
  return data?.id;
}
