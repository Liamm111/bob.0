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
  ready: "Prête à retirer",
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
              <a
                className="btn"
                href={`/api/wallet/apple/${token}`}
                style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
                  <path d="M16.365 1.43c0 1.14-.42 2.2-1.13 2.99-.79.87-2.08 1.54-3.14 1.46-.13-1.13.42-2.32 1.09-3.06.75-.83 2.09-1.45 3.18-1.39zM20.9 17.14c-.55 1.27-.82 1.84-1.53 2.97-1 1.56-2.4 3.5-4.14 3.51-1.55.02-1.95-1.01-4.05-1-2.1.01-2.54 1.02-4.09 1.01-1.74-.01-3.07-1.76-4.06-3.32C-.03 16.5-.26 11.14 1.87 8.36c1.15-1.5 2.96-2.45 4.66-2.45 1.73 0 2.82 1.01 4.25 1.01 1.39 0 2.24-1.01 4.24-1.01 1.51 0 3.11.82 4.25 2.24-3.73 2.04-3.13 7.37 1.63 8.99z" />
                </svg>
                Ajouter à Apple Wallet
              </a>
            )}
            {googleWalletConfigured() && (
              <a
                className="btn btn-ghost"
                href={`/api/wallet/google/${token}`}
                style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <path fill="#4285F4" d="M23 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.16c-.27 1.43-1.07 2.64-2.28 3.45v2.87h3.68C21.7 18.72 23 15.77 23 12.27z" />
                  <path fill="#34A853" d="M12 24c3.08 0 5.66-1.02 7.55-2.77l-3.68-2.87c-1.02.69-2.33 1.1-3.87 1.1-2.97 0-5.49-2.01-6.39-4.71H1.8v2.96C3.68 21.36 7.55 24 12 24z" />
                  <path fill="#FBBC05" d="M5.61 14.75c-.23-.69-.36-1.42-.36-2.18s.13-1.49.36-2.18V7.43H1.8A11.98 11.98 0 0 0 .53 12.57c0 1.94.46 3.77 1.27 5.14l3.81-2.96z" />
                  <path fill="#EA4335" d="M12 4.75c1.68 0 3.18.58 4.36 1.71l3.27-3.27C17.66 1.2 15.08 0 12 0 7.55 0 3.68 2.64 1.8 6.86l3.81 2.96C6.51 6.76 9.03 4.75 12 4.75z" />
                </svg>
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
