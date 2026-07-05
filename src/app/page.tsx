import Link from "next/link";
import { serviceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let cafes: { name: string; slug: string }[] = [];
  try {
    const { data } = await serviceClient()
      .from("cafes")
      .select("name, slug")
      .order("name");
    cafes = data ?? [];
  } catch {
    cafes = [];
  }

  return (
    <main className="container" style={{ padding: "48px 20px" }}>
      <h1>Click &amp; Collect</h1>
      <p className="muted">Choisissez votre café :</p>
      <div className="grid">
        {cafes.map((c) => (
          <Link key={c.slug} href={`/${c.slug}`} className="card" style={{ textDecoration: "none" }}>
            <strong>{c.name}</strong>
            <div className="muted">/{c.slug}</div>
          </Link>
        ))}
        {cafes.length === 0 && (
          <p className="muted">
            Aucun café configuré (base non connectée sur cet environnement).
          </p>
        )}
      </div>
    </main>
  );
}
