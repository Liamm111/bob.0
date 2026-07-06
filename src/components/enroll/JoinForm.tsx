"use client";

import { useState } from "react";
import { enrollCustomer, type EnrollResult } from "@/actions/enroll";

export function JoinForm({ cafeSlug }: { cafeSlug: string }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [marketing, setMarketing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Extract<EnrollResult, { ok: true }> | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = await enrollCustomer({ cafeSlug, name, phone, marketingConsent: marketing });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setDone(res);
  }

  if (done) {
    return (
      <div>
        <h1 style={{ marginTop: 0 }}>Bienvenue, {name} !</h1>
        <p className="muted">
          Votre carte de fidélité est prête
          {done.existing && done.pointsBalance > 0
            ? ` — vous avez déjà ${done.pointsBalance} point${done.pointsBalance > 1 ? "s" : ""}.`
            : "."}
        </p>

        {done.appleAvailable || done.googleAvailable ? (
          <div className="card" style={{ marginTop: 16 }}>
            <h3 style={{ marginTop: 0 }}>Ajoutez-la à votre téléphone</h3>
            <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
              {done.appleAvailable && (
                <a
                  className="btn"
                  href={`/api/wallet/apple/serial/${done.passSerial}`}
                  style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
                    <path d="M16.365 1.43c0 1.14-.42 2.2-1.13 2.99-.79.87-2.08 1.54-3.14 1.46-.13-1.13.42-2.32 1.09-3.06.75-.83 2.09-1.45 3.18-1.39zM20.9 17.14c-.55 1.27-.82 1.84-1.53 2.97-1 1.56-2.4 3.5-4.14 3.51-1.55.02-1.95-1.01-4.05-1-2.1.01-2.54 1.02-4.09 1.01-1.74-.01-3.07-1.76-4.06-3.32C-.03 16.5-.26 11.14 1.87 8.36c1.15-1.5 2.96-2.45 4.66-2.45 1.73 0 2.82 1.01 4.25 1.01 1.39 0 2.24-1.01 4.24-1.01 1.51 0 3.11.82 4.25 2.24-3.73 2.04-3.13 7.37 1.63 8.99z" />
                  </svg>
                  Apple Wallet
                </a>
              )}
              {done.googleAvailable && (
                <a
                  className="btn btn-ghost"
                  href={`/api/wallet/google/serial/${done.passSerial}`}
                  style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                    <path fill="#4285F4" d="M23 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.16c-.27 1.43-1.07 2.64-2.28 3.45v2.87h3.68C21.7 18.72 23 15.77 23 12.27z" />
                    <path fill="#34A853" d="M12 24c3.08 0 5.66-1.02 7.55-2.77l-3.68-2.87c-1.02.69-2.33 1.1-3.87 1.1-2.97 0-5.49-2.01-6.39-4.71H1.8v2.96C3.68 21.36 7.55 24 12 24z" />
                    <path fill="#FBBC05" d="M5.61 14.75A7.2 7.2 0 0 1 5.25 12.5c0-.76.13-1.49.36-2.18V7.36H1.8A12 12 0 0 0 .53 12.5c0 1.94.46 3.77 1.27 5.14l3.81-2.89z" />
                    <path fill="#EA4335" d="M12 4.75c1.68 0 3.18.58 4.36 1.71l3.27-3.27C17.66 1.2 15.08 0 12 0 7.55 0 3.68 2.64 1.8 6.86l3.81 2.89C6.51 6.76 9.03 4.75 12 4.75z" />
                  </svg>
                  Google Wallet
                </a>
              )}
            </div>
          </div>
        ) : (
          <div className="card" style={{ marginTop: 16 }}>
            Votre carte est enregistrée. L'ajout au Wallet n'est pas configuré sur
            cet environnement.
          </div>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit}>
      <h1 style={{ marginTop: 0 }}>Votre carte de fidélité</h1>
      <p className="muted">
        Un point par franc, une récompense qui vous attend. Pas de compte, pas de
        mot de passe — votre téléphone suffit.
      </p>

      <div className="field">
        <label htmlFor="name">Prénom</label>
        <input id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" required />
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
      </div>
      <div className="field">
        <label className="row" style={{ fontWeight: 400 }}>
          <input
            type="checkbox"
            checked={marketing}
            onChange={(e) => setMarketing(e.target.checked)}
            style={{ width: "auto" }}
          />
          <span>J'accepte de recevoir des offres par SMS (facultatif).</span>
        </label>
      </div>

      {error && (
        <div className="card" style={{ borderColor: "#c0392b", marginBottom: 12 }}>
          {error}
        </div>
      )}

      <button className="btn" type="submit" disabled={submitting}>
        {submitting ? "Création…" : "Créer ma carte"}
      </button>
    </form>
  );
}
