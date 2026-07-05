"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { browserClient } from "@/lib/supabase/browser";

export default function AdminLoginPage() {
  const router = useRouter();
  const search = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await browserClient().auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError("Identifiants invalides.");
      return;
    }
    router.push(search.get("next") ?? "/admin");
    router.refresh();
  }

  return (
    <main className="container" style={{ maxWidth: 400, padding: "64px 20px" }}>
      <h1>Back-office</h1>
      <p className="muted">Connexion réservée au personnel.</p>
      <form onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="password">Mot de passe</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && (
          <div className="card" style={{ borderColor: "#c0392b", marginBottom: 12 }}>
            {error}
          </div>
        )}
        <button className="btn" type="submit" disabled={loading}>
          {loading ? "Connexion…" : "Se connecter"}
        </button>
      </form>
    </main>
  );
}
