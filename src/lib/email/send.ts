import "server-only";
import { render } from "@react-email/render";
import { Resend } from "resend";
import { env, resendConfigured } from "@/lib/env";
import { serviceClient } from "@/lib/supabase/service";
import { brandTokens, type Cafe } from "@/lib/cafe";
import { formatCents } from "@/lib/pricing";
import {
  OrderConfirmationEmail,
  OrderReadyEmail,
  OrderCancelledEmail,
  type EmailBrand,
  type EmailOrder,
} from "@/lib/email/templates/OrderEmails";
import type { Tables } from "@/types/supabase";

function emailBrand(cafe: Cafe): EmailBrand {
  const t = brandTokens(cafe);
  return {
    cafeName: cafe.name,
    primary: t.primary ?? "#2f3a33",
    accent: t.accent ?? "#c9a26b",
    logoText: t.logoText ?? cafe.name,
  };
}

function buildEmailOrder(
  cafe: Cafe,
  order: Tables<"orders">,
  items: Tables<"order_items">[],
): EmailOrder {
  const vat = (order.vat_breakdown ?? {}) as Record<string, number>;
  const pickupLabel = new Intl.DateTimeFormat("fr-CH", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: cafe.timezone,
  }).format(new Date(order.pickup_slot));

  return {
    orderNumber: order.order_number,
    pickupLabel,
    currency: cafe.currency,
    totalLabel: formatCents(order.total_cents),
    items: items.map((i) => ({ name: i.name_snapshot, qty: i.qty })),
    vatBreakdown: Object.entries(vat).map(([rate, amount]) => ({
      rate,
      amountLabel: formatCents(amount),
    })),
    trackUrl: `${env.appBaseUrl()}/${cafe.slug}/track/${order.track_token}`,
  };
}

type EmailKind = "confirmation" | "ready" | "cancelled";

/**
 * Envoie un email transactionnel pour une commande, si :
 *  - Resend est configuré (sinon no-op silencieux, log console) ;
 *  - le client a fourni un email (facultatif au checkout).
 * Ne lève jamais : un échec d'email ne doit pas casser le webhook Stripe.
 */
export async function sendOrderEmail(
  orderId: string,
  kind: EmailKind,
  opts: { refunded?: boolean } = {},
): Promise<{ sent: boolean; reason?: string }> {
  try {
    const supabase = serviceClient();
    const { data: order } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .maybeSingle();
    if (!order) return { sent: false, reason: "order_not_found" };

    const { data: customer } = await supabase
      .from("customers")
      .select("email")
      .eq("id", order.customer_id)
      .maybeSingle();
    if (!customer?.email) return { sent: false, reason: "no_email" };

    const { data: cafe } = await supabase
      .from("cafes")
      .select("*")
      .eq("id", order.cafe_id)
      .maybeSingle();
    if (!cafe) return { sent: false, reason: "cafe_not_found" };

    const { data: items } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", orderId);

    const brand = emailBrand(cafe);
    const emailOrder = buildEmailOrder(cafe, order, items ?? []);

    let element: React.ReactElement;
    let subject: string;
    if (kind === "confirmation") {
      element = OrderConfirmationEmail({ brand, order: emailOrder });
      subject = `Commande ${order.order_number} confirmée — ${cafe.name}`;
    } else if (kind === "ready") {
      element = OrderReadyEmail({ brand, order: emailOrder });
      subject = `C'est prêt ! Commande ${order.order_number} — ${cafe.name}`;
    } else {
      element = OrderCancelledEmail({ brand, order: emailOrder, refunded: !!opts.refunded });
      subject = `Commande ${order.order_number} annulée — ${cafe.name}`;
    }

    if (!resendConfigured()) {
      console.info(`[email:${kind}] Resend non configuré — email ignoré pour ${order.order_number}`);
      return { sent: false, reason: "resend_not_configured" };
    }

    const html = await render(element);
    const resend = new Resend(env.resendApiKey()!);
    await resend.emails.send({
      from: env.emailFrom(),
      to: customer.email,
      subject,
      html,
    });
    return { sent: true };
  } catch (err) {
    console.error(`[email:${kind}] échec:`, err);
    return { sent: false, reason: "error" };
  }
}
