"use client";

import { useMemo, useState } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { useCart } from "@/components/cart/CartContext";
import { formatCents } from "@/lib/pricing";
import { checkout, type CheckoutResult } from "@/actions/checkout";

function formatSlot(iso: string, timeZone: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("fr-CH", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(d);
}

export function CheckoutForm({
  cafeSlug,
  currency,
  timeZone,
  availableSlots,
}: {
  cafeSlug: string;
  currency: string;
  timeZone: string;
  availableSlots: string[];
}) {
  const cart = useCart();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [marketing, setMarketing] = useState(false);
  const [slot, setSlot] = useState(availableSlots[0] ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paid, setPaid] = useState<
    | null
    | (Extract<CheckoutResult, { ok: true }>)
  >(null);

  const stripePromise = useMemo<Promise<Stripe | null> | null>(() => {
    if (!paid?.publishableKey) return null;
    return loadStripe(paid.publishableKey);
  }, [paid?.publishableKey]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (cart.lines.length === 0) {
      setError("Votre panier est vide.");
      return;
    }
    setSubmitting(true);
    const res = await checkout({
      cafeSlug,
      name,
      phone,
      email,
      marketingConsent: marketing,
      pickupSlotIso: slot,
      cart: cart.lines.map((l) => ({
        menuItemId: l.menuItemId,
        qty: l.qty,
        note: l.note ?? null,
      })),
    });
    setSubmitting(false);

    if (!res.ok) {
      setError(res.error);
      return;
    }
    setPaid(res);
  }

  if (cart.lines.length === 0 && !paid) {
    return <div className="card">Votre panier est vide.</div>;
  }

  // Étape paiement : Stripe Elements montés avec le client_secret.
  if (paid && stripePromise) {
    return (
      <Elements
        stripe={stripePromise}
        options={{ clientSecret: paid.clientSecret, locale: "fr" }}
      >
        <PaymentStep
          cafeSlug={cafeSlug}
          currency={currency}
          totalCents={paid.totalCents}
          orderNumber={paid.orderNumber}
          trackToken={paid.trackToken}
          onClearCart={() => cart.clear()}
        />
      </Elements>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Récapitulatif panier */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Votre panier</h3>
        {cart.lines.map((l) => (
          <div key={l.menuItemId} style={{ marginBottom: 10 }}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span>
                {l.qty} × {l.name}
              </span>
              <span>
                {currency} {formatCents(l.unitPriceCents * l.qty)}
              </span>
            </div>
            <input
              placeholder="Note (ex. sans lactose)"
              value={l.note ?? ""}
              onChange={(e) => cart.setNote(l.menuItemId, e.target.value)}
              style={{ marginTop: 4 }}
            />
          </div>
        ))}
        <div
          className="row"
          style={{ justifyContent: "space-between", fontWeight: 700, marginTop: 8 }}
        >
          <span>Total (TVA incluse)</span>
          <span>
            {currency} {formatCents(cart.subtotalCents)}
          </span>
        </div>
      </div>

      {/* Créneau de retrait */}
      <div className="field">
        <label htmlFor="slot">Créneau de retrait</label>
        <select id="slot" value={slot} onChange={(e) => setSlot(e.target.value)} required>
          {availableSlots.map((s) => (
            <option key={s} value={s}>
              {formatSlot(s, timeZone)}
            </option>
          ))}
        </select>
      </div>

      {/* Coordonnées invité */}
      <div className="field">
        <label htmlFor="name">Prénom</label>
        <input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="given-name"
          required
        />
      </div>
      <div className="field">
        <label htmlFor="phone">Téléphone</label>
        <input
          id="phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          inputMode="tel"
          autoComplete="tel"
          placeholder="079 123 45 67"
          required
        />
        <small className="muted">
          Sert à retrouver votre carte de fidélité. Aucun mot de passe.
        </small>
      </div>
      <div className="field">
        <label htmlFor="email">Email (facultatif)</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          placeholder="pour recevoir la confirmation"
        />
      </div>

      <div className="field">
        <label className="row" style={{ fontWeight: 400 }}>
          <input
            type="checkbox"
            checked={marketing}
            onChange={(e) => setMarketing(e.target.checked)}
            style={{ width: "auto" }}
          />
          <span>
            J'accepte de recevoir des offres par SMS (facultatif, décochable à
            tout moment).
          </span>
        </label>
      </div>

      {error && (
        <div className="card" style={{ borderColor: "#c0392b", marginBottom: 12 }}>
          {error}
        </div>
      )}

      <button className="btn" type="submit" disabled={submitting}>
        {submitting ? "Préparation du paiement…" : "Passer au paiement"}
      </button>
    </form>
  );
}

function PaymentStep({
  cafeSlug,
  currency,
  totalCents,
  orderNumber,
  trackToken,
  onClearCart,
}: {
  cafeSlug: string;
  currency: string;
  totalCents: number;
  orderNumber: string;
  trackToken: string;
  onClearCart: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setProcessing(true);
    setError(null);

    const returnUrl = `${window.location.origin}/${cafeSlug}/track/${trackToken}`;
    const { error: stripeError } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
    });

    // Si on arrive ici, c'est qu'il y a eu une erreur immédiate (sinon redirection).
    if (stripeError) {
      setError(stripeError.message ?? "Le paiement a échoué.");
      setProcessing(false);
    } else {
      onClearCart();
    }
  }

  return (
    <form onSubmit={pay}>
      <div className="card" style={{ marginBottom: 16 }}>
        Commande <strong>{orderNumber}</strong> · à payer :{" "}
        <strong>
          {currency} {formatCents(totalCents)}
        </strong>
      </div>
      <PaymentElement />
      {error && (
        <div className="card" style={{ borderColor: "#c0392b", margin: "12px 0" }}>
          {error}
        </div>
      )}
      <button className="btn" type="submit" disabled={!stripe || processing} style={{ marginTop: 16 }}>
        {processing ? "Paiement en cours…" : `Payer ${currency} ${formatCents(totalCents)}`}
      </button>
      <p className="muted" style={{ fontSize: "0.8rem", marginTop: 8 }}>
        Paiement sécurisé par Stripe · TWINT et carte acceptés.
      </p>
    </form>
  );
}
