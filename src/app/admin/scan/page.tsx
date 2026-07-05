"use client";

import { useState, useTransition } from "react";
import {
  lookupPass,
  redeemReward,
  adjustPoints,
  type ScanResult,
} from "@/actions/admin";

export default function ScanPage() {
  const [serial, setSerial] = useState("");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ScanResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function doLookup(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const r = await lookupPass(serial);
      setResult(r);
    });
  }

  function refreshLookup() {
    startTransition(async () => {
      const r = await lookupPass(serial);
      setResult(r);
    });
  }

  return (
    <div style={{ maxWidth: 520 }}>
      <h1>Scan fidélité</h1>
      <p className="muted">
        Scannez le QR du pass (ou saisissez le n° de série) pour afficher le
        solde et appliquer une récompense.
      </p>

      <form onSubmit={doLookup} className="row" style={{ gap: 8 }}>
        <input
          value={serial}
          onChange={(e) => setSerial(e.target.value)}
          placeholder="pass_serial (QR)"
          autoFocus
        />
        <button className="btn" type="submit" disabled={pending || !serial}>
          Chercher
        </button>
      </form>

      {message && (
        <div className="card" style={{ marginTop: 12, borderColor: "var(--brand-accent)" }}>
          {message}
        </div>
      )}

      {result && !result.ok && (
        <div className="card" style={{ marginTop: 12, borderColor: "#c0392b" }}>
          {result.error}
        </div>
      )}

      {result && result.ok && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <strong>{result.customer.name ?? "Client"}</strong>
            <span className="badge" style={{ fontSize: "1rem" }}>
              {result.customer.points_balance} pts
            </span>
          </div>

          <h3>Récompenses</h3>
          <div className="grid">
            {result.rewards.map((r) => (
              <div key={r.id} className="row" style={{ justifyContent: "space-between" }}>
                <span>
                  {r.name} · {r.cost_points} pts
                </span>
                <button
                  className="btn btn-accent"
                  disabled={!r.affordable || pending}
                  onClick={() =>
                    startTransition(async () => {
                      const res = await redeemReward(result.customer.id, r.id);
                      if (res.ok) {
                        setMessage(`« ${r.name} » appliquée. Nouveau solde : ${res.newBalance} pts.`);
                        refreshLookup();
                      } else {
                        setMessage(res.error);
                      }
                    })
                  }
                >
                  {r.affordable ? "Appliquer" : "Solde insuffisant"}
                </button>
              </div>
            ))}
          </div>

          <details style={{ marginTop: 16 }}>
            <summary className="muted">Ajustement manuel</summary>
            <AdjustControls
              customerId={result.customer.id}
              onDone={(msg) => {
                setMessage(msg);
                refreshLookup();
              }}
            />
          </details>
        </div>
      )}
    </div>
  );
}

function AdjustControls({
  customerId,
  onDone,
}: {
  customerId: string;
  onDone: (msg: string) => void;
}) {
  const [delta, setDelta] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <div className="row" style={{ gap: 8, marginTop: 8 }}>
      <input
        type="number"
        value={delta}
        onChange={(e) => setDelta(e.target.value)}
        placeholder="+/- points"
      />
      <button
        className="btn btn-ghost"
        disabled={pending || !delta}
        onClick={() =>
          startTransition(async () => {
            const res = await adjustPoints(customerId, Number(delta));
            onDone(res.ok ? `Solde ajusté : ${res.newBalance} pts.` : res.error);
            setDelta("");
          })
        }
      >
        Appliquer l'ajustement
      </button>
    </div>
  );
}
