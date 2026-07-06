import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { getCafeBySlug, brandTokens } from "@/lib/cafe";
import { brandStyle } from "@/lib/brand";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * QR à imprimer et poser au comptoir. Il pointe vers la page d'inscription
 * `/[slug]/join`. Le client le scanne → crée sa carte en 15 secondes.
 */
export default async function JoinQrPage({
  params,
}: {
  params: Promise<{ cafeSlug: string }>;
}) {
  const { cafeSlug } = await params;
  const cafe = await getCafeBySlug(cafeSlug);
  if (!cafe) notFound();

  const joinUrl = `${env.appBaseUrl()}/${cafe.slug}/join`;
  const tokens = brandTokens(cafe);
  const svg = await QRCode.toString(joinUrl, {
    type: "svg",
    margin: 1,
    color: { dark: tokens.primary ?? "#26251f", light: "#00000000" },
  });

  return (
    <div
      style={{
        ...brandStyle(tokens),
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "var(--brand-bg)",
        padding: 24,
      }}
    >
      <div style={{ textAlign: "center", maxWidth: 420 }}>
        <div style={{ fontSize: "0.8rem", letterSpacing: "0.24em", textTransform: "uppercase", color: "var(--brand-accent)" }}>
          {tokens.logoText ?? cafe.name}
        </div>
        <h1 style={{ fontSize: "1.8rem", margin: "12px 0 4px" }}>Carte de fidélité</h1>
        <p className="muted" style={{ marginTop: 0 }}>Scannez pour créer la vôtre.</p>
        <div
          style={{
            width: 300,
            height: 300,
            margin: "16px auto",
            background: "var(--brand-surface)",
            borderRadius: 20,
            padding: 20,
            boxShadow: "0 20px 40px -24px rgba(0,0,0,.4)",
          }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
        <p className="muted" style={{ fontSize: "0.85rem" }}>
          1 point par franc · récompenses en boutique · Apple &amp; Google Wallet
        </p>
      </div>
    </div>
  );
}
