"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { browserClient } from "@/lib/supabase/browser";
import { formatCents } from "@/lib/pricing";
import { advanceOrderStatus, setOrderStatusTo } from "@/actions/admin";
import type { Enums } from "@/types/supabase";

export type QueueOrder = {
  id: string;
  order_number: string;
  status: Enums<"order_status">;
  pickup_slot: string;
  total_cents: number;
  customer_name: string | null;
  items: { name: string; qty: number; note: string | null }[];
};

const STATUS_LABEL: Record<string, string> = {
  paid: "Payée",
  preparing: "En préparation",
  ready: "Prête",
};
const NEXT_LABEL: Record<string, string> = {
  paid: "→ En préparation",
  preparing: "→ Prête",
  ready: "→ Retirée",
};

export function OrdersBoard({
  cafeId,
  currency,
  timeZone,
  orders,
}: {
  cafeId: string;
  currency: string;
  timeZone: string;
  orders: QueueOrder[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [live, setLive] = useState(false);

  // Realtime : à chaque changement sur les commandes du café, on rafraîchit.
  useEffect(() => {
    const supabase = browserClient();
    const channel = supabase
      .channel(`orders-${cafeId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `cafe_id=eq.${cafeId}` },
        () => router.refresh(),
      )
      .subscribe((status) => setLive(status === "SUBSCRIBED"));
    return () => {
      supabase.removeChannel(channel);
    };
  }, [cafeId, router]);

  const fmt = (iso: string) =>
    new Intl.DateTimeFormat("fr-CH", {
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone,
    }).format(new Date(iso));

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
        <h1 style={{ margin: 0 }}>File des commandes</h1>
        <span className="badge" style={{ background: live ? "#2e7d32" : "#999", color: "#fff" }}>
          {live ? "Temps réel actif" : "Connexion…"}
        </span>
      </div>

      {orders.length === 0 && <div className="card">Aucune commande en cours.</div>}

      <div className="grid">
        {orders.map((o) => (
          <div key={o.id} className="card">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <strong>{o.order_number}</strong>
              <span className="badge">{STATUS_LABEL[o.status] ?? o.status}</span>
            </div>
            <div className="muted" style={{ fontSize: "0.9rem" }}>
              Retrait {fmt(o.pickup_slot)} · {o.customer_name ?? "—"} · {currency}{" "}
              {formatCents(o.total_cents)}
            </div>
            <ul style={{ margin: "8px 0", paddingLeft: 18 }}>
              {o.items.map((it, i) => (
                <li key={i}>
                  {it.qty} × {it.name}
                  {it.note ? <em className="muted"> — {it.note}</em> : null}
                </li>
              ))}
            </ul>
            <div className="row" style={{ gap: 8 }}>
              {NEXT_LABEL[o.status] && (
                <button
                  className="btn"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      await advanceOrderStatus(o.id);
                      router.refresh();
                    })
                  }
                >
                  {NEXT_LABEL[o.status]}
                </button>
              )}
              <button
                className="btn btn-ghost"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    await setOrderStatusTo(o.id, "cancelled");
                    router.refresh();
                  })
                }
              >
                Annuler
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
