import { notFound } from "next/navigation";
import Link from "next/link";
import { getCafeBySlug } from "@/lib/cafe";
import { getAvailableSlots } from "@/lib/data/slots";
import { stripeConfigured } from "@/lib/env";
import { CartProvider } from "@/components/cart/CartContext";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ cafeSlug: string }>;
}) {
  const { cafeSlug } = await params;
  const cafe = await getCafeBySlug(cafeSlug);
  if (!cafe) notFound();

  const { orderingOpen, slots } = await getAvailableSlots(cafe.id, cafe.timezone);
  const availableSlots = slots.filter((s) => s.available).map((s) => s.at);

  return (
    <CartProvider cafeSlug={cafe.slug}>
      <p>
        <Link href={`/${cafe.slug}`} className="muted">
          ← Retour à la carte
        </Link>
      </p>
      <h1 style={{ marginTop: 8 }}>Finaliser la commande</h1>

      {!stripeConfigured() && (
        <div className="card" style={{ borderColor: "#e0a458", marginBottom: 16 }}>
          Le paiement n'est pas configuré sur cet environnement (variables Stripe
          absentes). Le tunnel s'affiche mais le paiement est désactivé.
        </div>
      )}

      {!orderingOpen ? (
        <div className="card">
          Les commandes en ligne sont momentanément fermées. Merci de revenir
          plus tard.
        </div>
      ) : availableSlots.length === 0 ? (
        <div className="card">
          Aucun créneau de retrait disponible pour le moment.
        </div>
      ) : (
        <CheckoutForm
          cafeSlug={cafe.slug}
          currency={cafe.currency}
          timeZone={cafe.timezone}
          availableSlots={availableSlots}
        />
      )}
    </CartProvider>
  );
}
