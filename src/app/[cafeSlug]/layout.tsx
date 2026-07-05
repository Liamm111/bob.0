import { notFound } from "next/navigation";
import Link from "next/link";
import { getCafeBySlug, brandTokens } from "@/lib/cafe";
import { brandStyle } from "@/lib/brand";

export default async function CafeLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ cafeSlug: string }>;
}) {
  const { cafeSlug } = await params;
  const cafe = await getCafeBySlug(cafeSlug);
  if (!cafe) notFound();

  const tokens = brandTokens(cafe);

  return (
    <div style={brandStyle(tokens)}>
      <header
        style={{
          background: "var(--brand-primary)",
          color: "#fff",
          padding: "14px 0",
        }}
      >
        <div
          className="container"
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
        >
          <Link
            href={`/${cafe.slug}`}
            style={{ fontWeight: 700, fontSize: "1.25rem", textDecoration: "none" }}
          >
            {tokens.logoText ?? cafe.name}
          </Link>
          <span className="badge" style={{ background: "rgba(255,255,255,0.15)", color: "#fff" }}>
            Click &amp; Collect
          </span>
        </div>
      </header>

      <main className="container" style={{ padding: "24px 20px 64px" }}>
        {children}
      </main>

      <footer className="container" style={{ padding: "24px 20px", fontSize: "0.8rem" }}>
        <p className="muted">
          {cafe.name} — commande en ligne, retrait en boutique. Vos données
          (prénom, téléphone) servent uniquement à traiter votre commande et
          votre carte de fidélité. Droit d'accès et de suppression sur simple
          demande (nLPD).
        </p>
      </footer>
    </div>
  );
}
