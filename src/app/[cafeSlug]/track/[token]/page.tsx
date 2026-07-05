import Link from "next/link";
import { notFound } from "next/navigation";
import { getCafeBySlug } from "@/lib/cafe";
import { serviceClient } from "@/lib/supabase/service";
import { formatCents } from "@/lib/pricing";
import { appleWalletConfigured, googleWalletConfigured } from "@/lib/env";
import type { Enums } from "@/types/supabase";

const STATUS_LABEL: Record<Enums<"order_status">, string> = {
  pending_payment: "En attente de paiement",
  paid: "Payée — en file",
  preparing: "En préparation",
  ready: "Prête à retirer 🎉",
  collected: "Retirée",
  cancelled: "Annulée",
  refunded: "Remboursée",
};

type TrackedOrder = {
  order_number: string;
  status: Enums<"order_status">;
  pickup_slot: string;
  total_cents: number;
  items: { name: string; qty: number }[];
};

export default async function TrackPage({
  params,
  searchParams,
}: {
  params: Promise<{ cafeSlug: string; token: string }>;
  searchParams: Promise<{ redirect_status?: string }>;
}) {
  const { cafeSlug, token } = await params;
  const { redirect_status } = await searchParams;
  const cafe = await getCafeBySlug(cafeSlug);
  if (!cafe) notFound();

  const { data, error } = await serviceClient().rpc("get_order_by_token", {
    p_token: token,
  });
  if (error) throw error;

  const order = (data?.[0] as TrackedOrder | undefined) ?? null;
  if (!order) {
    return (
      <div className="card">
        Commande introuvable. Vérifiez votre lien de suivi.
      </div>
    );
  }

  const pickup = new Intl.DateTimeFormat("fr-CH", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: cafe.timezone,
  }).format(new Date(order.pickup_slot));

  return (
    <div>
      <h1>Commande {order.order_number}</h1>

      {redirect_status === "succeeded" && order.status === "pending_payment" && (
        <div className="card" style={{ borderColor: "var(--brand-accent)", marginBottom: 16 }}>
          Paiement reçu ! Nous confirmons votre commande, cette page se mettra à
          jour dans un instant.
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <span className="muted">Statut</span>
          <strong>{STATUS_LABEL[order.status]}</strong>
        </div>
        <div className="row" style={{ justifyContent: "space-between", marginTop: 8 }}>
          <span className="muted">Retrait</span>
          <strong>{pickup}</strong>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Détail</h3>
        {order.items.map((it, i) => (
          <div key={i} className="row" style={{ justifyContent: "space-between" }}>
            <span>
              {it.qty} × {it.name}
            </span>
          </div>
        ))}
        <div
          className="row"
          style={{ justifyContent: "space-between", fontWeight: 700, marginTop: 8 }}
        >
          <span>Total (TVA incluse)</span>
          <span>
            {cafe.currency} {formatCents(order.total_cents)}
          </span>
        </div>
      </div>

      {(appleWalletConfigured() || googleWalletConfigured()) && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginTop: 0 }}>Votre carte de fidélité</h3>
          <p className="muted" style={{ fontSize: "0.9rem" }}>
            Ajoutez votre carte au Wallet : vos points se mettent à jour tout
            seuls, présentez-la en boutique pour vos récompenses.
          </p>
          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            {appleWalletConfigured() && (
              <a className="btn" href={`/api/wallet/apple/${token}`}>
                 Ajouter à Apple Wallet
              </a>
            )}
            {googleWalletConfigured() && (
              <a className="btn btn-ghost" href={`/api/wallet/google/${token}`}>
                Ajouter à Google Wallet
              </a>
            )}
          </div>
        </div>
      )}

      <p className="muted" style={{ fontSize: "0.85rem" }}>
        Astuce : cette page se rafraîchit à chaque visite. Gardez le lien pour
        suivre l'avancement.
      </p>
      <p>
        <Link href={`/${cafe.slug}`} className="btn btn-ghost">
          Nouvelle commande
        </Link>
      </p>
    </div>
  );
}
