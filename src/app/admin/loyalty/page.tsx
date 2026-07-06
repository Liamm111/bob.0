"use client";

import { useState, useTransition } from "react";
import {
  findLoyaltyByPhone,
  createLoyaltyCustomer,
  creditInStorePurchase,
  type LoyaltyLookup,
} from "@/actions/admin";

type Customer = { id: string; name: string | null; points_balance: number };

export default function LoyaltyCounterPage() {
  const [phone, setPhone] = useState("");
  const [pending, startTransition] = useTransition();
  const [lookup, setLookup] = useState<LoyaltyLookup | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [newName, setNewName] = useState("");
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  function reset() {
    setLookup(null);
    setCustomer(null);
    setNewName("");
    setAmount("");
    setMessage(null);
  }

  function doLookup(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setCustomer(null);
    startTransition(async () => {
      const r = await findLoyaltyByPhone(phone);
      setLookup(r);
      if (r.ok && r.found && r.customer) setCustomer(r.customer);
    });
  }

  function createCard() {
    startTransition(async () => {
      const r = await createLoyaltyCustomer(phone, newName);
      if (r.ok) {
        setCustomer(r.customer);
        setMessage(`Carte créée pour ${r.customer.name}.`);
      } else {
        setMessage(r.error);
      }
    });
  }

  function credit() {
    if (!customer) return;
    const cents = Math.round(parseFloat(amount.replace(",", ".")) * 100);
    startTransition(async () => {
      const r = await creditInStorePurchase(customer.id, cents);
      if (r.ok) {
        setCustomer({ ...customer, points_balance: r.newBalance });
        setMessage(`Points crédités. Nouveau solde : ${r.newBalance} pts.`);
        setAmount("");
      } else {
        setMessage(r.error);
      }
    });
  }

  const previewPts =
    amount && !Number.isNaN(parseFloat(amount.replace(",", ".")))
      ? Math.floor(parseFloat(amount.replace(",", ".")))
      : null;

  return (
    <div style={{ maxWidth: 520 }}>
      <h1>Fidélité en caisse</h1>
      <p className="muted">
        Le client a payé au comptoir ? Saisissez son téléphone, puis le montant —
        les points se créditent automatiquement (1 pt / CHF).
      </p>

      <form onSubmit={doLookup} className="row" style={{ gap: 8 }}>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          inputMode="tel"
          placeholder="Téléphone du client"
          autoFocus
        />
        <button className="btn" type="submit" disabled={pending || !phone}>
          Chercher
        </button>
        {(customer || lookup) && (
          <button type="button" className="btn btn-ghost" onClick={reset}>
            Nouveau
          </button>
        )}
      </form>

      {message && (
        <div className="card" style={{ marginTop: 12, borderColor: "var(--brand-accent)" }}>
          {message}
        </div>
      )}

      {lookup && !lookup.ok && (
        <div className="card" style={{ marginTop: 12, borderColor: "#c0392b" }}>{lookup.error}</div>
      )}

      {/* Client inconnu → proposer de créer la carte */}
      {lookup && lookup.ok && !customer && (
        <div className="card" style={{ marginTop: 16 }}>
          <p style={{ marginTop: 0 }}>
            Aucune carte pour <strong>{lookup.display}</strong>. En créer une ?
          </p>
          <div className="row" style={{ gap: 8 }}>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Prénom"
            />
            <button className="btn" onClick={createCard} disabled={pending || !newName}>
              Créer la carte
            </button>
          </div>
        </div>
      )}

      {/* Client connu (ou créé) → créditer un achat */}
      {customer && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <strong>{customer.name ?? "Client"}</strong>
            <span className="badge" style={{ fontSize: "1rem" }}>
              {customer.points_balance} pts
            </span>
          </div>

          <div className="field" style={{ marginTop: 12 }}>
            <label htmlFor="amount">Montant de l'achat (CHF)</label>
            <input
              id="amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              placeholder="ex. 12.50"
            />
          </div>
          {previewPts !== null && previewPts > 0 && (
            <p className="muted" style={{ marginTop: 0 }}>
              → <strong>{previewPts} point{previewPts > 1 ? "s" : ""}</strong> seront crédités.
            </p>
          )}
          <button
            className="btn"
            onClick={credit}
            disabled={pending || !previewPts || previewPts <= 0}
          >
            Créditer les points
          </button>
        </div>
      )}
    </div>
  );
}
